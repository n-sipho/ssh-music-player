package db

import (
	"database/sql"
	"homemusic-server/internal/types"
)

func GetAllSources() ([]map[string]interface{}, error) {
	query := `
		SELECT s.id, s.name, s.type, s.host, s.port, s.username, s.domain, s.share, s.base_path, s.enabled, s.created_at, s.updated_at,
		       st.status, st.progress, st.total_files, st.scanned_files, st.last_error, st.last_scan
		FROM sources s
		LEFT JOIN source_status st ON s.id = st.source_id
		ORDER BY s.name ASC
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sources := []map[string]interface{}{}
	for rows.Next() {
		var s types.Source
		var st types.SourceStatus
		var lastError, lastScan sql.NullString
		
		err := rows.Scan(
			&s.ID, &s.Name, &s.Type, &s.Host, &s.Port, &s.Username, &s.Domain, &s.Share, &s.BasePath, &s.Enabled, &s.CreatedAt, &s.UpdatedAt,
			&st.Status, &st.Progress, &st.TotalFiles, &st.ScannedFiles, &lastError, &lastScan,
		)
		if err != nil {
			return nil, err
		}

		sourceMap := map[string]interface{}{
			"id":        s.ID,
			"name":      s.Name,
			"type":      s.Type,
			"host":      s.Host,
			"port":      s.Port,
			"username":  s.Username,
			"domain":    s.Domain,
			"share":     s.Share,
			"basePath":  s.BasePath,
			"enabled":   s.Enabled,
			"createdAt": s.CreatedAt,
			"updatedAt": s.UpdatedAt,
			"status": map[string]interface{}{
				"status":       st.Status,
				"progress":     st.Progress,
				"totalFiles":   st.TotalFiles,
				"scannedFiles": st.ScannedFiles,
			},
		}
		
		if lastError.Valid {
			sourceMap["status"].(map[string]interface{})["lastError"] = lastError.String
		}
		if lastScan.Valid {
			sourceMap["status"].(map[string]interface{})["lastScan"] = lastScan.String
		}

		sources = append(sources, sourceMap)
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
