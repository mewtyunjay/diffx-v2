package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"diffx/gitstatus"
)

type config struct {
	cwd     string
	host    string
	port    int
	webRoot string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	config, err := parseConfig()
	if err != nil {
		return err
	}

	target, err := gitstatus.ResolveWorkspaceTarget(config.cwd)
	if err != nil {
		return err
	}

	service := gitstatus.NewService(target.RepoRoot, target.ScopePath)
	router := newRouter(service, config.webRoot)

	address := fmt.Sprintf("%s:%d", config.host, config.port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", address, err)
	}
	defer listener.Close()

	println("Server running on http://" + listener.Addr().String())
	return http.Serve(listener, router)
}

func parseConfig() (config, error) {
	defaultCWD, err := os.Getwd()
	if err != nil {
		return config{}, fmt.Errorf("read working directory: %w", err)
	}

	var parsedConfig config
	flag.StringVar(&parsedConfig.cwd, "cwd", defaultCWD, "working directory to open")
	flag.StringVar(&parsedConfig.host, "host", "127.0.0.1", "host to bind the server to")
	flag.IntVar(&parsedConfig.port, "port", 8080, "port to bind the server to")
	flag.StringVar(&parsedConfig.webRoot, "web-root", "", "directory containing built frontend assets")
	flag.Parse()

	if parsedConfig.port < 0 || parsedConfig.port > 65535 {
		return config{}, fmt.Errorf("port must be between 0 and 65535")
	}

	if parsedConfig.webRoot == "" {
		return parsedConfig, nil
	}

	absoluteWebRoot, err := filepath.Abs(parsedConfig.webRoot)
	if err != nil {
		return config{}, fmt.Errorf("resolve web root: %w", err)
	}
	info, err := os.Stat(absoluteWebRoot)
	if err != nil {
		return config{}, fmt.Errorf("stat web root: %w", err)
	}
	if !info.IsDir() {
		return config{}, fmt.Errorf("web root must be a directory")
	}

	parsedConfig.webRoot = absoluteWebRoot
	return parsedConfig, nil
}
