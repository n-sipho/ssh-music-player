package scanner

import (
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dhowden/tag"
	"github.com/google/uuid"
	"github.com/tcolgate/mp3"
	"homemusic-server/internal/db"
	"homemusic-server/internal/sources"
	"homemusic-server/internal/types"
)

var musicExtensions = map[string]bool{
	".mp3":  true,
	".flac": true,
	".m4a":  true,
	".ogg":  true,
	".wav":  true,
	".aac":  true,
}

func isMusicFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return musicExtensions[ext]
}

type musicFile struct {
	path  string
	mtime time.Time
}

func getString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func ScanSource(sourceID string) error {
	source, err := db.GetSource(sourceID)
	if err != nil {
		return err
	}
	if source == nil {
		return fmt.Errorf("source not found")
	}

	log.Printf("[Scanner] Starting scan for source: %s", source.Name)
	updateStatus(sourceID, "scanning", 0, 0, 0, nil)

	var musicFiles []musicFile
	var scanErr error

	var smbClient *sources.SMBClient
	var sshClient *sources.SSHClient

	if source.Type == types.SourceTypeSMB {
		smbClient = sources.NewSMBClient(sources.SMBConfig{
			Host:     source.Host,
			Share:    getString(source.Share),
			Username: getString(source.Username),
			Password: getString(source.Password),
			Domain:   getString(source.Domain),
		})
		if err := smbClient.Connect(); err != nil {
			scanErr = err
		} else {
			defer smbClient.Close()
			basePath := "."
			if source.BasePath != nil && *source.BasePath != "" {
				basePath = *source.BasePath
			}
			scanErr = walkSMB(smbClient, basePath, &musicFiles)
		}
	} else if source.Type == types.SourceTypeSSH {
		sshClient = sources.NewSSHClient(sources.SSHConfig{
			Host:     source.Host,
			Port:     source.Port,
			Username: getString(source.Username),
			Password: getString(source.Password),
		})
		if err := sshClient.Connect(); err != nil {
			scanErr = err
		} else {
			defer sshClient.Close()
			basePath := "/"
			if source.BasePath != nil && *source.BasePath != "" {
				basePath = *source.BasePath
			}
			scanErr = walkSSH(sshClient, basePath, &musicFiles)
		}
	}

	if scanErr != nil {
		errStr := scanErr.Error()
		updateStatus(sourceID, "error", 0, 0, 0, &errStr)
		return scanErr
	}

	total := len(musicFiles)
	log.Printf("[Scanner] Found %d music files in %s", total, source.Name)
	updateStatus(sourceID, "scanning", 5, total, 0, nil)

	for i, mf := range musicFiles {
		processed := i + 1
		path := mf.path
		log.Printf("[Scanner] Processing (%d/%d): %s", processed, total, path)
		
		var reader io.ReadSeeker
		if source.Type == types.SourceTypeSMB {
			f, err := smbClient.Open(path)
			if err != nil {
				log.Printf("[Scanner] Failed to open SMB file %s: %v", path, err)
			} else {
				defer f.Close()
				reader = f
			}
		} else {
			f, err := sshClient.Open(path)
			if err != nil {
				log.Printf("[Scanner] Failed to open SSH file %s: %v", path, err)
			} else {
				defer f.Close()
				reader = f
			}
		}

		if reader != nil {
			// Try to calculate duration for MP3
			duration := 0.0
			if strings.ToLower(filepath.Ext(path)) == ".mp3" {
				d := mp3.NewDecoder(reader)
				var f mp3.Frame
				var skipped int
				for {
					if err := d.Decode(&f, &skipped); err != nil {
						if err == io.EOF {
							break
						}
						break
					}
					duration += f.Duration().Seconds()
				}
				// Reset reader for metadata extraction
				if seeker, ok := reader.(io.Seeker); ok {
					seeker.Seek(0, io.SeekStart)
				}
			}

			metadata, err := tag.ReadFrom(reader)
			if err != nil {
				log.Printf("[Scanner] Failed to extract metadata for %s: %v", path, err)
				upsertBasicInfo(sourceID, path, mf.mtime, duration)
			} else {
				upsertMetadata(sourceID, path, metadata, mf.mtime, duration)
			}
		}

		if i%10 == 0 || processed == total {
			progress := 5 + (float64(processed)/float64(total))*95
			updateStatus(sourceID, "scanning", progress, total, processed, nil)
		}
	}

	now := time.Now()
	updateStatus(sourceID, "complete", 100, total, total, nil)
	db.DB.Exec("UPDATE source_status SET last_scan = ? WHERE source_id = ?", now, sourceID)

	return nil
}

func upsertMetadata(sourceID, path string, metadata tag.Metadata, mtime time.Time, duration float64) {
	artistTag := metadata.Artist()
	if artistTag == "" {
		artistTag = "Unknown Artist"
	}

	// Split by common separators and take the first one as primary
	// Examples: "Artist A / Artist B", "Artist A; Artist B"
	primaryArtist := artistTag
	separators := []string{" / ", "/", "; ", ";", ", "}
	for _, sep := range separators {
		if strings.Contains(primaryArtist, sep) {
			parts := strings.Split(primaryArtist, sep)
			if len(parts) > 0 {
				primaryArtist = strings.TrimSpace(parts[0])
				break
			}
		}
	}

	artistName := primaryArtist
	albumName := "Unknown Album"
	if metadata.Album() != "" {
		albumName = metadata.Album()
	}

	title := filepath.Base(path)
	if metadata.Title() != "" {
		title = metadata.Title()
	}

	folderPath := filepath.Dir(path)
	
	// Create display artist string (comma separated)
	displayArtist := artistTag
	separators = []string{" / ", "/", "; ", ";"}
	for _, sep := range separators {
		if strings.Contains(displayArtist, sep) {
			displayArtist = strings.ReplaceAll(displayArtist, sep, ", ")
		}
	}

	// 1. Handle Artwork
	artworkURL := ""
	if p := metadata.Picture(); p != nil {
		hash := md5.Sum([]byte(artistName + albumName))
		filename := fmt.Sprintf("%x.%s", hash, p.Ext)
		savePath := filepath.Join("public", "art", filename)
		
		if _, err := os.Stat(savePath); os.IsNotExist(err) {
			os.MkdirAll(filepath.Dir(savePath), 0755)
			if err := os.WriteFile(savePath, p.Data, 0644); err == nil {
				artworkURL = "/api/art/" + filename
			}
		} else {
			artworkURL = "/api/art/" + filename
		}
	}

	artistID := uuid.New().String()
	_, err := db.DB.Exec("INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)", artistID, artistName)
	if err == nil {
		db.DB.QueryRow("SELECT id FROM artists WHERE name = ?", artistName).Scan(&artistID)
	}

	albumID := uuid.New().String()
	_, err = db.DB.Exec("INSERT OR IGNORE INTO albums (id, name, artist_id, image_url) VALUES (?, ?, ?, ?)", albumID, albumName, artistID, artworkURL)
	if err != nil {
		if artworkURL != "" {
			db.DB.Exec("UPDATE albums SET image_url = ? WHERE name = ? AND artist_id = ? AND (image_url IS NULL OR image_url = '')", artworkURL, albumName, artistID)
		}
		db.DB.QueryRow("SELECT id FROM albums WHERE name = ? AND artist_id = ?", albumName, artistID).Scan(&albumID)
	}

	trackID := uuid.New().String()
	trackNum, _ := metadata.Track()
	year := metadata.Year()

	_, err = db.DB.Exec(`INSERT OR REPLACE INTO tracks 
		(id, title, artist, album, duration, track_number, year, path, folder_path, image_url, source_mtime, artists_display, source_id, album_id, artist_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		trackID, title, artistName, albumName, duration, trackNum, year, path, folderPath, artworkURL, mtime, displayArtist, sourceID, albumID, artistID)
	
	if err != nil {
		log.Printf("[Scanner] Database error for %s: %v", path, err)
	}
}

func upsertBasicInfo(sourceID, path string, mtime time.Time, duration float64) {
	artistName := "Unknown Artist"
	albumName := "Unknown Album"
	title := filepath.Base(path)
	folderPath := filepath.Dir(path)

	artistID := uuid.New().String()
	_, _ = db.DB.Exec("INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)", artistID, artistName)
	db.DB.QueryRow("SELECT id FROM artists WHERE name = ?", artistName).Scan(&artistID)

	albumID := uuid.New().String()
	_, _ = db.DB.Exec("INSERT OR IGNORE INTO albums (id, name, artist_id) VALUES (?, ?, ?)", albumID, albumName, artistID)
	db.DB.QueryRow("SELECT id FROM albums WHERE name = ? AND artist_id = ?", albumName, artistID).Scan(&albumID)

	trackID := uuid.New().String()
	_, err := db.DB.Exec(`INSERT OR REPLACE INTO tracks 
		(id, title, artist, album, duration, path, folder_path, source_mtime, artists_display, source_id, album_id, artist_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		trackID, title, artistName, albumName, duration, path, folderPath, mtime, artistName, sourceID, albumID, artistID)
	
	if err != nil {
		log.Printf("[Scanner] Database error (basic) for %s: %v", path, err)
	}
}

func updateStatus(sourceID string, status string, progress float64, total, scanned int, lastErr *string) {
	_, err := db.DB.Exec(`UPDATE source_status SET 
		status = ?, progress = ?, total_files = ?, scanned_files = ?, last_error = ?
		WHERE source_id = ?`,
		status, progress, total, scanned, lastErr, sourceID)
	if err != nil {
		log.Printf("[Scanner] Failed to update status: %v", err)
	}
}

func walkSMB(client *sources.SMBClient, path string, files *[]musicFile) error {
	// Clean the path for go-smb2: remove leading slashes and use backslashes internally if needed
	// But go-smb2 usually likes '.' for root and 'Folder/Subfolder' for children
	smbPath := strings.TrimPrefix(path, "/")
	smbPath = strings.TrimPrefix(smbPath, "\\")
	if smbPath == "" {
		smbPath = "."
	}

	log.Printf("[Scanner] Walking SMB path: %s (internal: %s)", path, smbPath)
	entries, err := client.ReadDir(smbPath)
	if err != nil {
		log.Printf("[Scanner] Error reading SMB dir %s: %v", smbPath, err)
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." || strings.HasPrefix(name, "._") || strings.HasPrefix(name, "$") {
			continue
		}

		// Construct the path for the NEXT level
		var nextPath string
		if smbPath == "." {
			nextPath = name
		} else {
			nextPath = smbPath + "/" + name
		}

		if entry.IsDir() {
			if err := walkSMB(client, nextPath, files); err != nil {
				return err
			}
		} else if isMusicFile(name) {
			log.Printf("[Scanner] Found music file: %s", nextPath)
			*files = append(*files, musicFile{
				path:  nextPath,
				mtime: entry.ModTime(),
			})
		}
	}

	return nil
}

func ScanAllSources() error {
	sources, err := db.GetAllSources()
	if err != nil {
		return err
	}

	for _, s := range sources {
		enabled, ok := s["enabled"].(bool)
		if ok && enabled {
			id := s["id"].(string)
			// Run each scan in its own goroutine
			go func(sourceID string) {
				if err := ScanSource(sourceID); err != nil {
					log.Printf("[Scanner] Background scan failed for %s: %v", sourceID, err)
				}
			}(id)
		}
	}
	return nil
}

func walkSSH(client *sources.SSHClient, path string, files *[]musicFile) error {
	entries, err := client.ReadDir(path)
	if err != nil {
		log.Printf("[Scanner] Error reading SSH dir %s: %v", path, err)
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." || strings.HasPrefix(name, "._") {
			continue
		}

		fullPath := filepath.Join(path, name)
		if entry.IsDir() {
			if err := walkSSH(client, fullPath, files); err != nil {
				return err
			}
		} else if isMusicFile(name) {
			*files = append(*files, musicFile{
				path:  fullPath,
				mtime: entry.ModTime(),
			})
		}
	}

	return nil
}
