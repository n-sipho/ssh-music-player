package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"homemusic-server/internal/types"
)

func GetAllPlaylists() ([]map[string]interface{}, error) {
	query := `
		SELECT p.id, p.name, COUNT(pi.id) as track_count
		FROM playlists p
		LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
		GROUP BY p.id
		ORDER BY p.name ASC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	playlists := []map[string]interface{}{}
	for rows.Next() {
		var id, name string
		var count int
		if err := rows.Scan(&id, &name, &count); err != nil {
			return nil, err
		}
		playlists = append(playlists, map[string]interface{}{
			"id":         id,
			"name":       name,
			"trackCount": count,
		})
	}
	return playlists, nil
}

func GetPlaylist(id string) (map[string]interface{}, error) {
	var name string
	err := DB.QueryRow("SELECT name FROM playlists WHERE id = ?", id).Scan(&name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Get tracks in playlist
	query := `
		SELECT t.id, t.title, t.artist, t.album, t.duration, t.track_number, t.year, t.path, t.source_id, t.album_id, t.artist_id
		FROM tracks t
		JOIN playlist_items pi ON t.id = pi.track_id
		WHERE pi.playlist_id = ?
		ORDER BY pi."order" ASC
	`
	rows, err := DB.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tracks := []types.Track{}
	for rows.Next() {
		var t types.Track
		err := rows.Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.SourceID, &t.AlbumID, &t.ArtistID)
		if err != nil {
			return nil, err
		}
		tracks = append(tracks, t)
	}

	return map[string]interface{}{
		"id":     id,
		"name":   name,
		"tracks": tracks,
	}, nil
}

func CreatePlaylist(name string) (*types.Playlist, error) {
	p := &types.Playlist{
		ID:        uuid.New().String(),
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := DB.Exec("INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
		p.ID, p.Name, p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func AddTrackToPlaylist(playlistID, trackID string) error {
	// Get current max order
	var maxOrder int
	err := DB.QueryRow("SELECT COALESCE(MAX(\"order\"), -1) FROM playlist_items WHERE playlist_id = ?", playlistID).Scan(&maxOrder)
	if err != nil {
		return err
	}

	_, err = DB.Exec("INSERT INTO playlist_items (id, playlist_id, track_id, \"order\") VALUES (?, ?, ?, ?)",
		uuid.New().String(), playlistID, trackID, maxOrder+1)
	return err
}

func RemoveTrackFromPlaylist(playlistID, trackID string) error {
	_, err := DB.Exec("DELETE FROM playlist_items WHERE playlist_id = ? AND track_id = ?", playlistID, trackID)
	return err
}

func DeletePlaylist(id string) error {
	_, err := DB.Exec("DELETE FROM playlist_items WHERE playlist_id = ?", id)
	if err != nil {
		return err
	}
	_, err = DB.Exec("DELETE FROM playlists WHERE id = ?", id)
	return err
}
