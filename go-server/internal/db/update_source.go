package db

import (
	"time"
)

func UpdateSource(id string, updates map[string]interface{}) error {
	query := "UPDATE sources SET updated_at = ?"
	args := []interface{}{time.Now()}

	for k, v := range updates {
		// Only allow updating specific fields
		if k == "name" || k == "host" || k == "port" || k == "username" || k == "password" || k == "domain" || k == "share" || k == "base_path" || k == "enabled" {
			query += ", " + k + " = ?"
			args = append(args, v)
		}
	}

	query += " WHERE id = ?"
	args = append(args, id)

	_, err := DB.Exec(query, args...)
	return err
}
