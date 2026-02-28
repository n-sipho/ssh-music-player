package api

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"homemusic-server/internal/db"
	"homemusic-server/internal/sources"
	"homemusic-server/internal/types"
)

func RegisterStreamRoutes(r chi.Router) {
	r.Get("/stream/{trackId}", handleStreamTrack)
}

func handleStreamTrack(w http.ResponseWriter, r *http.Request) {
	trackID := chi.URLParam(r, "trackId")
	track, err := db.GetTrack(trackID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if track == nil {
		http.Error(w, "Track not found", http.StatusNotFound)
		return
	}

	source, err := db.GetSource(track.SourceID)
	if err != nil || source == nil {
		http.Error(w, "Source not found", http.StatusNotFound)
		return
	}

	var reader io.ReadSeeker
	var closeFunc func()

	if source.Type == types.SourceTypeSMB {
		client := sources.NewSMBClient(sources.SMBConfig{
			Host:     source.Host,
			Share:    *source.Share,
			Username: *source.Username,
			Password: *source.Password,
			Domain:   *source.Domain,
		})
		if err := client.Connect(); err != nil {
			http.Error(w, "Failed to connect to SMB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		
		f, err := client.Open(track.Path)
		if err != nil {
			client.Close()
			http.Error(w, "Failed to open remote file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		
		reader = f
		closeFunc = func() {
			f.Close()
			client.Close()
		}
	} else if source.Type == types.SourceTypeSSH {
		client := sources.NewSSHClient(sources.SSHConfig{
			Host:     source.Host,
			Port:     source.Port,
			Username: *source.Username,
			Password: *source.Password,
		})
		if err := client.Connect(); err != nil {
			http.Error(w, "Failed to connect to SSH: "+err.Error(), http.StatusInternalServerError)
			return
		}
		
		f, err := client.Open(track.Path)
		if err != nil {
			client.Close()
			http.Error(w, "Failed to open remote file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// SFTP files implement ReadSeeker
		reader = f
		closeFunc = func() {
			f.Close()
			client.Close()
		}
	}

	if reader == nil {
		http.Error(w, "Unsupported source type", http.StatusInternalServerError)
		return
	}
	defer closeFunc()

	// Use http.ServeContent to handle Range requests automatically
	http.ServeContent(w, r, track.Title, track.CreatedAt, reader)
}
