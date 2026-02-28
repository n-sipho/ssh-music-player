package db

import (
	"database/sql"
	"homemusic-server/internal/types"
)

func GetAllSources() ([]types.Source, error) {
	rows, err := DB.Query("SELECT id, name, type, host, port, username, password, domain, share, base_path, enabled, created_at, updated_at FROM sources")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sources := []types.Source{} // Initialize as empty slice, not nil
	for rows.Next() {
		var s types.Source
		err := rows.Scan(&s.ID, &s.Name, &s.Type, &s.Host, &s.Port, &s.Username, &s.Password, &s.Domain, &s.Share, &s.BasePath, &s.Enabled, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		sources = append(sources, s)
	}
	return sources, nil
}

func GetSource(id string) (*types.Source, error) {
	var s types.Source
	err := DB.QueryRow("SELECT id, name, type, host, port, username, password, domain, share, base_path, enabled, created_at, updated_at FROM sources WHERE id = ?", id).
		Scan(&s.ID, &s.Name, &s.Type, &s.Host, &s.Port, &s.Username, &s.Password, &s.Domain, &s.Share, &s.BasePath, &s.Enabled, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

func CreateSource(s types.Source) error {
	_, err := DB.Exec(`INSERT INTO sources (id, name, type, host, port, username, password, domain, share, base_path, enabled) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.Name, s.Type, s.Host, s.Port, s.Username, s.Password, s.Domain, s.Share, s.BasePath, s.Enabled)
	if err != nil {
		return err
	}

	_, err = DB.Exec("INSERT INTO source_status (source_id, status) VALUES (?, ?)", s.ID, "starting")
	return err
}

func DeleteSource(id string) error {
	_, err := DB.Exec("DELETE FROM sources WHERE id = ?", id)
	return err
}

func GetSourceStatus(sourceID string) (*types.SourceStatus, error) {
	var s types.SourceStatus
	err := DB.QueryRow("SELECT source_id, status, progress, total_files, scanned_files, last_error, last_scan FROM source_status WHERE source_id = ?", sourceID).
		Scan(&s.SourceID, &s.Status, &s.Progress, &s.TotalFiles, &s.ScannedFiles, &s.LastError, &s.LastScan)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}
