package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func helloHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]string{
		"message": "Hello from Go backend",
	}
	json.NewEncoder(w).Encode(resp)
}

func main() {
	r := chi.NewRouter()
	r.Use(corsMiddleware)
	r.Get("/api/hello", helloHandler)

	println("Server running on :8080")
	http.ListenAndServe(":8080", r)
}
