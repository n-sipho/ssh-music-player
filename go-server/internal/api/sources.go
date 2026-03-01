package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
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
	r.Patch("/sources/{id}", handleUpdateSource)
	r.Delete("/sources/{id}", handleDeleteSource)
	r.Post("/sources/{id}/test", handleTestExistingSource)
	r.Post("/sources/test", handleTestNewSource)
	r.Post("/sources/{id}/scan", handleScanSource)
	r.Post("/scan", handleScanAll)
	r.Get("/sources/{id}/status", handleGetSourceStatus)
	r.Post("/smb/enumerate-shares", handleEnumerateShares)
	r.Get("/discover", handleDiscover)
}

func handleUpdateSource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := db.UpdateSource(id, updates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	s, _ := db.GetSource(id)
	json.NewEncoder(w).Encode(s)
}

func handleTestExistingSource(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	source, err := db.GetSource(id)
	if err != nil || source == nil {
		http.Error(w, "Source not found", http.StatusNotFound)
		return
	}
	
	err = testConnection(source)
	success := err == nil
	msg := "Connection successful"
	if err != nil {
		msg = err.Error()
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{"success": success, "message": msg})
}

func handleTestNewSource(w http.ResponseWriter, r *http.Request) {
	var source types.Source
	if err := json.NewDecoder(r.Body).Decode(&source); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	err := testConnection(&source)
	success := err == nil
	msg := "Connection successful"
	if err != nil {
		msg = err.Error()
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{"success": success, "message": msg})
}

func getString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func testConnection(s *types.Source) error {
	if s.Type == types.SourceTypeSMB {
		share := getString(s.Share)
		if share == "" {
			return fmt.Errorf("SMB share name is required for testing")
		}
		client := sources.NewSMBClient(sources.SMBConfig{
			Host:     s.Host,
			Share:    share,
			Username: getString(s.Username),
			Password: getString(s.Password),
			Domain:   getString(s.Domain),
		})
		if err := client.Connect(); err != nil {
			return err
		}
		defer client.Close()
		_, err := client.ReadDir(".")
		return err
	} else if s.Type == types.SourceTypeSSH {
		client := sources.NewSSHClient(sources.SSHConfig{
			Host:     s.Host,
			Port:     s.Port,
			Username: getString(s.Username),
			Password: getString(s.Password),
		})
		if err := client.Connect(); err != nil {
			return err
		}
		defer client.Close()
		_, err := client.ReadDir("/")
		return err
	}
	return fmt.Errorf("unsupported source type")
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
	log.Printf("[API] Getting discovered services")
	services := scanner.GlobalDiscoveryManager.GetServices()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
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
		log.Printf("[API] Failed to get sources: %v", err)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
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

	// Automatically start scan for the new source
	go func() {
		if err := scanner.ScanSource(s.ID); err != nil {
			log.Printf("[API] Automatic initial scan failed for source %s: %v", s.ID, err)
		}
	}()

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
	// Read body for logging
	bodyBytes, _ := io.ReadAll(r.Body)
	log.Printf("[SMB] Raw request body: %s", string(bodyBytes))
	
	// Restore body for decoder
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	var req EnumerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[SMB] Attempting share enumeration on %s for user: %s (domain: '%s')", req.Host, req.Username, req.Domain)

	shares, err := sources.EnumerateShares(req.Host, req.Username, req.Password, req.Domain)
	if err != nil {
		log.Printf("[SMB] Enumerate failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		
		errMsg := err.Error()
		status := http.StatusInternalServerError
		
		if strings.Contains(errMsg, "logon is invalid") || strings.Contains(errMsg, "authentication") {
			status = http.StatusUnauthorized
			errMsg = "Logon failure: Check your username and password. If using a Mac, try leaving the Domain field blank."
		}
		
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]string{"error": errMsg})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shares)
}
