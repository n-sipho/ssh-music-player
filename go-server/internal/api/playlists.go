package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"homemusic-server/internal/db"
)

func RegisterPlaylistRoutes(r chi.Router) {
	r.Get("/playlists", handleGetPlaylists)
	r.Post("/playlists", handleCreatePlaylist)
	r.Get("/playlists/{id}", handleGetPlaylist)
	r.Delete("/playlists/{id}", handleDeletePlaylist)
	r.Post("/playlists/{id}/tracks", handleAddTrackToPlaylist)
	r.Delete("/playlists/{id}/tracks/{trackId}", handleRemoveTrackFromPlaylist)
}

func handleGetPlaylists(w http.ResponseWriter, r *http.Request) {
	playlists, err := db.GetAllPlaylists()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(playlists)
}

func handleCreatePlaylist(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	p, err := db.CreatePlaylist(req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func handleGetPlaylist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	playlist, err := db.GetPlaylist(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if playlist == nil {
		http.Error(w, "Playlist not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(playlist)
}

func handleDeletePlaylist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := db.DeletePlaylist(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleAddTrackToPlaylist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		TrackID string `json:"trackId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := db.AddTrackToPlaylist(id, req.TrackID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleRemoveTrackFromPlaylist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	trackID := chi.URLParam(r, "trackId")

	if err := db.RemoveTrackFromPlaylist(id, trackID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
