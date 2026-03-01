package db

import (
	"database/sql"
	"path/filepath"
	"homemusic-server/internal/types"
)

func GetAllArtists() ([]types.Artist, error) {
	// Group by name to collapse duplicates and only show artists with tracks
	query := `
		SELECT a.id, a.name, a.created_at 
		FROM artists a
		JOIN tracks t ON a.id = t.artist_id
		GROUP BY UPPER(TRIM(a.name))
		ORDER BY a.name ASC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	artists := []types.Artist{}
	for rows.Next() {
		var a types.Artist
		err := rows.Scan(&a.ID, &a.Name, &a.CreatedAt)
		if err != nil {
			return nil, err
		}
		artists = append(artists, a)
	}
	return artists, nil
}

func GetArtist(id string) (*types.Artist, error) {
	var a types.Artist
	err := DB.QueryRow("SELECT id, name, created_at FROM artists WHERE id = ?", id).
		Scan(&a.ID, &a.Name, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func GetAllAlbums() ([]map[string]interface{}, error) {
	query := `
		SELECT a.id, a.name, ar.name as artist_name, a.image_url, COUNT(t.id) as track_count
		FROM albums a
		LEFT JOIN artists ar ON a.artist_id = ar.id
		LEFT JOIN tracks t ON a.id = t.album_id
		GROUP BY a.id
		ORDER BY a.name ASC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	albums := []map[string]interface{}{}
	for rows.Next() {
		var id, name, artistName string
		var imageUrl sql.NullString
		var trackCount int
		err := rows.Scan(&id, &name, &artistName, &imageUrl, &trackCount)
		if err != nil {
			return nil, err
		}
		
		album := map[string]interface{}{
			"id":         id,
			"name":       name,
			"artist":     artistName,
			"trackCount": trackCount,
		}
		if imageUrl.Valid {
			album["imageUrl"] = imageUrl.String
		}
		albums = append(albums, album)
	}
	return albums, nil
}

func GetAlbum(id string) (map[string]interface{}, error) {
	var albumName, artistName string
	var imageUrl sql.NullString
	err := DB.QueryRow(`
		SELECT a.name, ar.name as artist_name, a.image_url
		FROM albums a
		JOIN artists ar ON a.artist_id = ar.id
		WHERE a.id = ?`, id).Scan(&albumName, &artistName, &imageUrl)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	tracks, err := GetTracksByAlbum(id)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"id":     id,
		"name":   albumName,
		"artist": map[string]string{"name": artistName},
		"tracks": tracks,
	}
	if imageUrl.Valid {
		result["imageUrl"] = imageUrl.String
	}
	
	return result, nil
}

func GetAllTracks() ([]types.Track, error) {
	rows, err := DB.Query("SELECT id, title, artist, album, duration, track_number, year, path, folder_path, image_url, source_mtime, artists_display, source_id, album_id, artist_id, created_at FROM tracks ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.FolderPath, &t.ImageUrl, &t.SourceMtime, &t.ArtistsDisplay, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, nil
}

func GetTracksByAlbum(albumID string) ([]types.Track, error) {
	rows, err := DB.Query("SELECT id, title, artist, album, duration, track_number, year, path, folder_path, image_url, source_mtime, artists_display, source_id, album_id, artist_id, created_at FROM tracks WHERE album_id = ? ORDER BY track_number ASC", albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.FolderPath, &t.ImageUrl, &t.SourceMtime, &t.ArtistsDisplay, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, nil
}

func GetFolders() ([]map[string]interface{}, error) {
	query := `
		SELECT folder_path, COUNT(id) as track_count
		FROM tracks
		WHERE folder_path IS NOT NULL
		GROUP BY folder_path
		ORDER BY folder_path ASC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	folders := []map[string]interface{}{}
	for rows.Next() {
		var path string
		var count int
		if err := rows.Scan(&path, &count); err != nil {
			return nil, err
		}
		
		// Find a sample track from this folder to get an image
		var imageUrl sql.NullString
		DB.QueryRow(`
			SELECT COALESCE(t.image_url, a.image_url) 
			FROM tracks t 
			LEFT JOIN albums a ON t.album_id = a.id 
			WHERE t.folder_path = ? AND (t.image_url IS NOT NULL OR a.image_url IS NOT NULL) 
			LIMIT 1`, path).Scan(&imageUrl)

		folders = append(folders, map[string]interface{}{
			"id":         path,
			"name":       filepath.Base(path),
			"trackCount": count,
			"imageUrl":   imageUrl.String,
		})
	}
	return folders, nil
}

func GetTracksByFolder(path string) ([]types.Track, error) {
	rows, err := DB.Query("SELECT id, title, artist, album, duration, track_number, year, path, folder_path, image_url, source_mtime, artists_display, source_id, album_id, artist_id, created_at FROM tracks WHERE folder_path = ? ORDER BY track_number ASC, title ASC", path)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.FolderPath, &t.ImageUrl, &t.SourceMtime, &t.ArtistsDisplay, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, nil
}
