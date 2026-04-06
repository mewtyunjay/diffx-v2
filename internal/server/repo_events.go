package server

import (
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

const repoEventsKeepAliveInterval = 15 * time.Second

type repoChangeKind string

const (
	repoChangeWorktree repoChangeKind = "worktree"
	repoChangeGit      repoChangeKind = "git"
)

type repoChangedEvent struct {
	Kind repoChangeKind `json:"kind"`
}

type repoEventHub struct {
	mu          sync.Mutex
	nextID      int
	closed      bool
	subscribers map[int]chan repoChangedEvent
}

func newRepoEventHub() *repoEventHub {
	return &repoEventHub{
		subscribers: make(map[int]chan repoChangedEvent),
	}
}

func (h *repoEventHub) Subscribe() (<-chan repoChangedEvent, func()) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		closedCh := make(chan repoChangedEvent)
		close(closedCh)
		return closedCh, func() {}
	}

	id := h.nextID
	h.nextID++

	ch := make(chan repoChangedEvent, 1)
	h.subscribers[id] = ch

	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()

		subscriber, ok := h.subscribers[id]
		if !ok {
			return
		}

		delete(h.subscribers, id)
		close(subscriber)
	}
}

func (h *repoEventHub) Publish(event repoChangedEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		return
	}

	for _, subscriber := range h.subscribers {
		deliverRepoEvent(subscriber, event)
	}
}

func (h *repoEventHub) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.closed {
		return nil
	}

	h.closed = true
	for id, subscriber := range h.subscribers {
		delete(h.subscribers, id)
		close(subscriber)
	}

	return nil
}

func deliverRepoEvent(subscriber chan repoChangedEvent, event repoChangedEvent) {
	select {
	case subscriber <- event:
		return
	default:
	}

	select {
	case <-subscriber:
	default:
	}

	select {
	case subscriber <- event:
	default:
	}
}

func (a *App) handleEvents(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming is not supported", http.StatusInternalServerError)
		return
	}

	events, unsubscribe := a.repoEvents.Subscribe()
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	if _, err := io.WriteString(w, ": connected\n\n"); err != nil {
		return
	}
	flusher.Flush()

	keepAliveTicker := time.NewTicker(repoEventsKeepAliveInterval)
	defer keepAliveTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := writeRepoChangedEvent(w, event); err != nil {
				return
			}
			flusher.Flush()
		case <-keepAliveTicker.C:
			if _, err := io.WriteString(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func writeRepoChangedEvent(w io.Writer, event repoChangedEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	if _, err := io.WriteString(w, "event: repo-changed\n"); err != nil {
		return err
	}
	if _, err := io.WriteString(w, "data: "); err != nil {
		return err
	}
	if _, err := w.Write(payload); err != nil {
		return err
	}
	_, err = io.WriteString(w, "\n\n")

	return err
}
