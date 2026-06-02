package frontend

import "embed"

// Dist contains the Vite production build output served by the Go binary.
//
//go:generate npm ci
//go:generate npm run build
//go:generate sh -c "mkdir -p dist && touch dist/.keep"
//go:embed all:dist
var Dist embed.FS
