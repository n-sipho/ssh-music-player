package db

import (
	"database/sql"
	"homemusic-server/internal/types"
)

func GetTrack(id string) (*types.Track, error) {
	var t types.Track
	err := DB.QueryRow("SELECT id, title, artist, album, duration, track_number, year, path, folder_path, image_url, source_mtime, artists_display, source_id, album_id, artist_id, created_at FROM tracks WHERE id = ?", id).
		Scan(&t.ID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.TrackNumber, &t.Year, &t.Path, &t.FolderPath, &t.ImageUrl, &t.SourceMtime, &t.ArtistsDisplay, &t.SourceID, &t.AlbumID, &t.ArtistID, &t.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}
