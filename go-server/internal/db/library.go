package db

import (
	"database/sql"
	"homemusic-server/internal/types"
)

func GetAllArtists() ([]types.Artist, error) {
	rows, err := DB.Query("SELECT id, name, created_at FROM artists ORDER BY name ASC")
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
	rows, err := DB.Query("SELECT id, title, artist, album, duration, track_number, year, path, source_id, album_id, artist_id, created_at FROM tracks ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, nil
}

func GetTracksByAlbum(albumID string) ([]types.Track, error) {
	rows, err := DB.Query("SELECT id, title, artist, album, duration, track_number, year, path, source_id, album_id, artist_id, created_at FROM tracks WHERE album_id = ? ORDER BY track_number ASC", albumID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}
	return tracks, nil
}
