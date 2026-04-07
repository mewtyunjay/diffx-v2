package server

import (
	"net/http"
	"strings"
)

func (a *App) suppressRepoWatcherGitEventsMiddleware(next http.Handler) http.Handler {
	if a.repoWatcher == nil {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api/events" {
			next.ServeHTTP(w, r)
			return
		}

		release := a.repoWatcher.suppressGitEvents()
		defer release()

		next.ServeHTTP(w, r)
	})
}
