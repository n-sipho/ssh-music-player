package scanner

import (
	"fmt"
	"io"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/dhowden/tag"
	"github.com/google/uuid"
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

	var musicFiles []string
	var scanErr error

	var smbClient *sources.SMBClient
	var sshClient *sources.SSHClient

	if source.Type == types.SourceTypeSMB {
		smbClient = sources.NewSMBClient(sources.SMBConfig{
			Host:     source.Host,
			Share:    *source.Share,
			Username: *source.Username,
			Password: *source.Password,
			Domain:   *source.Domain,
		})
		if err := smbClient.Connect(); err != nil {
			scanErr = err
		} else {
			defer smbClient.Close()
			basePath := "\\"
			if source.BasePath != nil && *source.BasePath != "" {
				basePath = *source.BasePath
			}
			scanErr = walkSMB(smbClient, basePath, &musicFiles)
		}
	} else if source.Type == types.SourceTypeSSH {
		sshClient = sources.NewSSHClient(sources.SSHConfig{
			Host:     source.Host,
			Port:     source.Port,
			Username: *source.Username,
			Password: *source.Password,
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

	for i, path := range musicFiles {
		processed := i + 1
		
		var reader io.ReadSeeker
		if source.Type == types.SourceTypeSMB {
			f, err := smbClient.Open(path)
			if err == nil {
				defer f.Close()
				reader = f
			}
		} else {
			f, err := sshClient.Open(path)
			if err == nil {
				defer f.Close()
				reader = f
			}
		}

		if reader != nil {
			metadata, err := tag.ReadFrom(reader)
			if err == nil {
				upsertMetadata(sourceID, path, metadata)
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

func upsertMetadata(sourceID, path string, metadata tag.Metadata) {
	artistName := "Unknown Artist"
	if metadata.Artist() != "" {
		artistName = metadata.Artist()
	}

	albumName := "Unknown Album"
	if metadata.Album() != "" {
		albumName = metadata.Album()
	}

	title := filepath.Base(path)
	if metadata.Title() != "" {
		title = metadata.Title()
	}

	artistID := uuid.New().String()
	_, err := db.DB.Exec("INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)", artistID, artistName)
	if err == nil {
		db.DB.QueryRow("SELECT id FROM artists WHERE name = ?", artistName).Scan(&artistID)
	}

	albumID := uuid.New().String()
	_, err = db.DB.Exec("INSERT OR IGNORE INTO albums (id, name, artist_id) VALUES (?, ?, ?)", albumID, albumName, artistID)
	if err == nil {
		db.DB.QueryRow("SELECT id FROM albums WHERE name = ? AND artist_id = ?", albumName, artistID).Scan(&albumID)
	}

	trackID := uuid.New().String()
	trackNum, _ := metadata.Track()
	year := metadata.Year()
	
	// Get duration if possible, some formats might not provide it via tag reader easily
	duration := 0.0 

	_, err = db.DB.Exec(`INSERT OR REPLACE INTO tracks 
		(id, title, artist, album, duration, track_number, year, path, source_id, album_id, artist_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		trackID, title, artistName, albumName, duration, trackNum, year, path, sourceID, albumID, artistID)
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

func walkSMB(client *sources.SMBClient, path string, files *[]string) error {
	entries, err := client.ReadDir(path)
	if err != nil {
		log.Printf("[Scanner] Error reading SMB dir %s: %v", path, err)
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." || strings.HasPrefix(name, "._") {
			continue
		}

		fullPath := filepath.Join(path, name)
		if entry.IsDir() {
			if err := walkSMB(client, fullPath, files); err != nil {
				return err
			}
		} else if isMusicFile(name) {
			*files = append(*files, fullPath)
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
		if s.Enabled {
			// Run each scan in its own goroutine
			go func(id string) {
				if err := ScanSource(id); err != nil {
					log.Printf("[Scanner] Background scan failed for %s: %v", id, err)
				}
			}(s.ID)
		}
	}
	return nil
}

func walkSSH(client *sources.SSHClient, path string, files *[]string) error {
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
			*files = append(*files, fullPath)
		}
	}

	return nil
}
