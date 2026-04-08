package main

import (
	"fmt"
	"io"
	"os/exec"
	"runtime"
)

func tryOpenBrowser(targetURL string, stderr io.Writer) {
	command, args, ok := browserOpenCommand(targetURL)
	if !ok {
		return
	}

	if _, err := exec.LookPath(command); err != nil {
		return
	}

	cmd := exec.Command(command, args...)
	if err := cmd.Start(); err != nil && stderr != nil {
		fmt.Fprintf(stderr, "warning: failed to open browser: %v\n", err)
	}
}

func browserOpenCommand(targetURL string) (string, []string, bool) {
	switch runtime.GOOS {
	case "darwin":
		return "open", []string{targetURL}, true
	case "linux":
		return "xdg-open", []string{targetURL}, true
	case "windows":
		return "cmd", []string{"/c", "start", "", targetURL}, true
	default:
		return "", nil, false
	}
}
