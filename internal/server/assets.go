package server

import (
	"fmt"
	"io/fs"
)

func loadAssets(embeddedAssets fs.FS) (fs.FS, error) {
	assets, err := fs.Sub(embeddedAssets, "dist")
	if err != nil {
		return nil, missingEmbeddedAssetsError(err)
	}

	if _, err := fs.ReadFile(assets, "index.html"); err != nil {
		return nil, missingEmbeddedAssetsError(err)
	}

	return assets, nil
}

func missingEmbeddedAssetsError(err error) error {
	return fmt.Errorf(
		"embedded frontend assets are missing dist/index.html; run `go generate ./frontend` before `go build ./cmd/diffx`, or use `diffx --dev` while developing: %w",
		err,
	)
}
