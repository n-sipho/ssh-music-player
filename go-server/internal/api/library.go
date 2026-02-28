package api

import (
	"encoding/json"
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
}

func handleGetTracks(w http.ResponseWriter, r *http.Request) {
	tracks, err := db.GetAllTracks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
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
