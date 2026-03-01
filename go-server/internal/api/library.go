package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"homemusic-server/internal/db"
)

func RegisterLibraryRoutes(r chi.Router) {
	r.Get("/tracks", handleGetTracks)
	r.Get("/albums", handleGetAlbums)
	r.Get("/albums/{id}", handleGetAlbum)
	r.Get("/artists", handleGetArtists)
	r.Get("/artists/{id}", handleGetArtist)
	r.Get("/folders", handleGetFolders)
	r.Get("/folders/tracks", handleGetTracksByFolder)
}

func handleGetFolders(w http.ResponseWriter, r *http.Request) {
	folders, err := db.GetFolders()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(folders)
}

func handleGetTracksByFolder(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "Path is required", http.StatusBadRequest)
		return
	}

	tracks, err := db.GetTracksByFolder(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(tracks)
}

func handleGetTracks(w http.ResponseWriter, r *http.Request) {
	tracks, err := db.GetAllTracks()
	if err != nil {
		log.Printf("[API] Failed to get tracks: %v", err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tracks)
}

func handleGetAlbums(w http.ResponseWriter, r *http.Request) {
	albums, err := db.GetAllAlbums()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(albums)
}

func handleGetAlbum(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	album, err := db.GetAlbum(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if album == nil {
		http.Error(w, "Album not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(album)
}

func handleGetArtists(w http.ResponseWriter, r *http.Request) {
	artists, err := db.GetAllArtists()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(artists)
}

func handleGetArtist(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	artist, err := db.GetArtist(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if artist == nil {
		http.Error(w, "Artist not found", http.StatusNotFound)
		return
	}
	
	// For artist details, we might want to include albums and top tracks
	// Placeholder for now as the original Node API does more complex joins
	json.NewEncoder(w).Encode(artist)
}
