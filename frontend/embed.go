package frontend

import "embed"

// Dist contains the Vite production build output served by the Go binary.
//
//go:embed all:dist
var Dist embed.FS
