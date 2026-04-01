package frontend

import "embed"

// Dist contains the Vite production build output served by the Go binary.
//
//go:generate npm install
//go:generate npm run build
//go:embed all:dist
var Dist embed.FS
