package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"homemusic-server/internal/api"
	"homemusic-server/internal/db"
	"homemusic-server/internal/scanner"
)

func main() {
	// Initialize database
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "music.db"
	}
	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Start Network Discovery
	scanner.GlobalDiscoveryManager.Start(context.Background())

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		api.RegisterSourceRoutes(r)
		api.RegisterLibraryRoutes(r)
		api.RegisterPlaylistRoutes(r)
		api.RegisterStreamRoutes(r)
		
		// Serve Album Artwork under /api/art/
		artPath := filepath.Join("public", "art")
		os.MkdirAll(artPath, 0755)
		
		// Correctly handle the prefix for artwork
		fs := http.FileServer(http.Dir(artPath))
		r.Handle("/art/*", http.StripPrefix("/api/art/", fs))

		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("ok"))
		})
	})

	// Serve Frontend Static Files & SPA Catch-all
	distPath := filepath.Join("..", "client", "dist")
	if _, err := os.Stat(distPath); err == nil {
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path
			
			// Exclude internal routes from SPA fallback
			if strings.HasPrefix(path, "/api") {
				http.NotFound(w, r)
				return
			}

			// Check if file exists in dist
			fullPath := filepath.Join(distPath, path)
			if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
				http.ServeFile(w, r, fullPath)
				return
			}

			// Fallback to index.html for SPA
			http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Printf("🎵 HomeMusic Go Server running at http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
