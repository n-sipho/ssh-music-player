package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"homemusic-server/internal/db"
	"homemusic-server/internal/scanner"
	"homemusic-server/internal/sources"
	"homemusic-server/internal/types"
)

func RegisterSourceRoutes(r chi.Router) {
	r.Get("/sources", handleGetSources)
	r.Post("/sources", handleCreateSource)
	r.Get("/sources/{id}", handleGetSource)
	r.Delete("/sources/{id}", handleDeleteSource)
	r.Post("/sources/{id}/scan", handleScanSource)
	r.Post("/scan", handleScanAll)
	r.Get("/sources/{id}/status", handleGetSourceStatus)
	r.Post("/smb/enumerate-shares", handleEnumerateShares)
	r.Get("/discover", handleDiscover)
}

func handleScanAll(w http.ResponseWriter, r *http.Request) {
	if err := scanner.ScanAllSources(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"message": "Scan started for all enabled sources"})
}

func handleDiscover(w http.ResponseWriter, r *http.Request) {
	// Placeholder for mDNS discovery
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte("[]"))
}

func handleScanSource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	
	// Run scan in background
	go func() {
		if err := scanner.ScanSource(id); err != nil {
			log.Printf("[API] Scan failed for source %s: %v", id, err)
		}
	}()

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"message": "Scan started"})
}

func handleGetSources(w http.ResponseWriter, r *http.Request) {
	s, err := db.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(s)
}

func handleCreateSource(w http.ResponseWriter, r *http.Request) {
	var s types.Source
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = time.Now()
	s.UpdatedAt = time.Now()

	if err := db.CreateSource(s); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

func handleGetSource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := db.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if s == nil {
		http.Error(w, "Source not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(s)
}

func handleDeleteSource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := db.DeleteSource(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleGetSourceStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := db.GetSourceStatus(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if s == nil {
		http.Error(w, "Status not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(s)
}

type EnumerateRequest struct {
	Host     string `json:"host"`
	Username string `json:"username"`
	Password string `json:"password"`
	Domain   string `json:"domain"`
}

func handleEnumerateShares(w http.ResponseWriter, r *http.Request) {
	var req EnumerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	shares, err := sources.EnumerateShares(req.Host, req.Username, req.Password, req.Domain)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shares)
}
