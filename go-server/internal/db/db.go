package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB(dbPath string) error {
	var err error
	// Add WAL mode and busy timeout to the connection string
	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", dbPath)
	DB, err = sql.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	log.Println("🗄️  Database initialized (WAL mode enabled)")
	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS sources (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		host TEXT NOT NULL,
		port INTEGER NOT NULL,
		username TEXT,
		password TEXT,
		domain TEXT,
		share TEXT,
		base_path TEXT,
		enabled INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS source_status (
		source_id TEXT PRIMARY KEY,
		status TEXT NOT NULL,
		progress REAL DEFAULT 0,
		total_files INTEGER DEFAULT 0,
		scanned_files INTEGER DEFAULT 0,
		last_error TEXT,
		last_scan DATETIME,
		FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS artists (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS albums (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		artist_id TEXT NOT NULL,
		image_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(name, artist_id),
		FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS tracks (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		artist TEXT NOT NULL,
		album TEXT NOT NULL,
		duration REAL NOT NULL,
		track_number INTEGER,
		year INTEGER,
		path TEXT NOT NULL,
		folder_path TEXT,
		image_url TEXT,
		source_mtime DATETIME,
		artists_display TEXT,
		source_id TEXT NOT NULL,
		album_id TEXT,
		artist_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(path, source_id),
		FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
		FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE SET NULL,
		FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS playlists (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS playlist_items (
		id TEXT PRIMARY KEY,
		playlist_id TEXT NOT NULL,
		track_id TEXT NOT NULL,
		"order" INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
		FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
	);
	`
	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// Manual migration for existing databases
	_, _ = DB.Exec("ALTER TABLE tracks ADD COLUMN folder_path TEXT")
	_, _ = DB.Exec("ALTER TABLE tracks ADD COLUMN image_url TEXT")
	_, _ = DB.Exec("ALTER TABLE tracks ADD COLUMN source_mtime DATETIME")
	_, _ = DB.Exec("ALTER TABLE tracks ADD COLUMN artists_display TEXT")
	
	return nil
}
