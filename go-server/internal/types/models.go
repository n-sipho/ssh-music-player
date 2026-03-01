package types

import (
	"time"
)

type SourceType string

const (
	SourceTypeSMB SourceType = "smb"
	SourceTypeSSH SourceType = "ssh"
)

type Source struct {
	ID        string     `json:"id" db:"id"`
	Name      string     `json:"name" db:"name"`
	Type      SourceType `json:"type" db:"type"`
	Host      string     `json:"host" db:"host"`
	Port      int        `json:"port" db:"port"`
	Username  *string    `json:"username,omitempty" db:"username"`
	Password  *string    `json:"password,omitempty" db:"password"`
	Domain    *string    `json:"domain,omitempty" db:"domain"`
	Share     *string    `json:"share,omitempty" db:"share"`
	BasePath  *string    `json:"basePath,omitempty" db:"base_path"`
	Enabled   bool       `json:"enabled" db:"enabled"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time  `json:"updatedAt" db:"updated_at"`
}

type SourceStatus struct {
	SourceID     string     `json:"sourceId" db:"source_id"`
	Status       string     `json:"status" db:"status"` // "scanning", "complete", "error"
	Progress     float64    `json:"progress" db:"progress"`
	TotalFiles   int        `json:"totalFiles" db:"total_files"`
	ScannedFiles int        `json:"scannedFiles" db:"scanned_files"`
	LastError    *string    `json:"lastError,omitempty" db:"last_error"`
	LastScan     *time.Time `json:"lastScan,omitempty" db:"last_scan"`
}

type Artist struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type Album struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	ArtistID  string    `json:"artistId" db:"artist_id"`
	ImageUrl  *string   `json:"imageUrl,omitempty" db:"image_url"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type Track struct {
	ID          string    `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Artist      string    `json:"artist" db:"artist"`
	Album       string    `json:"album" db:"album"`
	Duration    float64   `json:"duration" db:"duration"`
	TrackNumber *int      `json:"trackNumber,omitempty" db:"track_number"`
	Year        *int      `json:"year,omitempty" db:"year"`
	Path        string    `json:"path" db:"path"`
	FolderPath  *string   `json:"folderPath,omitempty" db:"folder_path"`
	ImageUrl    *string   `json:"imageUrl,omitempty" db:"image_url"`
	SourceMtime *time.Time `json:"sourceMtime,omitempty" db:"source_mtime"`
	ArtistsDisplay *string `json:"artistsDisplay,omitempty" db:"artists_display"`
	SourceID    string    `json:"sourceId" db:"source_id"`
	AlbumID     *string   `json:"albumId,omitempty" db:"album_id"`
	ArtistID    *string   `json:"artistId,omitempty" db:"artist_id"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

type Playlist struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type PlaylistItem struct {
	ID         string    `json:"id" db:"id"`
	PlaylistID string    `json:"playlistId" db:"playlist_id"`
	TrackID    string    `json:"trackId" db:"track_id"`
	Order      int       `json:"order" db:"order"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}
