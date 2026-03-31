package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestParseCommand(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		args    []string
		want    command
		wantErr bool
	}{
		{name: "default help", args: nil, want: commandHelp},
		{name: "dev", args: []string{"dev"}, want: commandDev},
		{name: "install", args: []string{"install"}, want: commandInstall},
		{name: "build", args: []string{"build"}, want: commandBuild},
		{name: "help flag", args: []string{"--help"}, want: commandHelp},
		{name: "unknown", args: []string{"unknown"}, wantErr: true},
		{name: "extra args", args: []string{"dev", "now"}, wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseCommand(tt.args)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %v, got %v", tt.want, got)
			}
		})
	}
}

func TestWaitForHealthyServer(t *testing.T) {
	t.Parallel()

	var ready atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ready.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	go func() {
		time.Sleep(300 * time.Millisecond)
		ready.Store(true)
	}()

	if err := waitForHealthyServer(context.Background(), server.URL, 2*time.Second); err != nil {
		t.Fatalf("expected healthy server, got %v", err)
	}
}

func TestWaitForHealthyServerTimeout(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	err := waitForHealthyServer(context.Background(), server.URL, 200*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded, got %v", err)
	}
}
