package server

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"strings"
)

func loadAssets(embeddedAssets fs.FS) (fs.FS, error) {
	assets, err := fs.Sub(embeddedAssets, "dist")
	if err == nil {
		if _, readErr := fs.ReadFile(assets, "index.html"); readErr == nil {
			return assets, nil
		}
	}

	return loadLocalAssets()
}

func loadLocalAssets() (fs.FS, error) {
	if _, err := os.Stat("frontend/package.json"); err != nil {
		return nil, fmt.Errorf(
			"embedded frontend assets are missing index.html and no local frontend workspace was found: %w",
			err,
		)
	}

	assets := os.DirFS("frontend/dist")
	if _, err := fs.ReadFile(assets, "index.html"); err == nil {
		return assets, nil
	}

	if err := buildLocalAssets(); err != nil {
		return nil, err
	}

	if _, err := fs.ReadFile(assets, "index.html"); err != nil {
		return nil, fmt.Errorf("frontend build completed without dist/index.html: %w", err)
	}

	return assets, nil
}

func buildLocalAssets() error {
	command := exec.Command("npm", "run", "build")
	command.Dir = "frontend"

	var output bytes.Buffer
	command.Stdout = &output
	command.Stderr = &output

	if err := command.Run(); err != nil {
		return fmt.Errorf(
			"embedded frontend assets are missing index.html and automatic `npm run build` failed:\n%s",
			strings.TrimSpace(output.String()),
		)
	}

	return nil
}
