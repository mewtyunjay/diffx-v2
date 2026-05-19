package server

import "net/http"

func (a *App) handleAppConfig(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	writeJSON(w, http.StatusOK, a.appConfig)
}
