package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

func openBrowser(targetURL string) error {
	command, args, ok := browserOpenCommand(targetURL)
	if !ok {
		return fmt.Errorf("no browser opener for %s", runtime.GOOS)
	}

	return exec.Command(command, args...).Run()
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
