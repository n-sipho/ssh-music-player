package db

import (
	"database/sql"
	"homemusic-server/internal/types"
)

func GetTrack(id string) (*types.Track, error) {
	var t types.Track
	err := DB.QueryRow("SELECT id, title, artist, album, duration, track_number, year, path, source_id, album_id, artist_id, created_at FROM tracks WHERE id = ?", id).
		Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}
