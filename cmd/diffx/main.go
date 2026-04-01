package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"diffx/internal/gitstatus"
	"diffx/internal/server"
)

const shutdownTimeout = 5 * time.Second

type config struct {
	host       string
	port       int
	targetPath string
}

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string, stdout, stderr io.Writer) error {
	cfg, err := parseConfig(args, stderr)
	if err != nil {
		return err
	}

	workspace, err := gitstatus.ResolveWorkspaceTarget(cfg.targetPath)
	if err != nil {
		return err
	}

	app, err := server.New(server.Config{
		Workspace: workspace,
	})
	if err != nil {
		return err
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(cfg.host, strconv.Itoa(cfg.port)))
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer listener.Close()

	httpServer := &http.Server{
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrCh := make(chan error, 1)
	go func() {
		serverErrCh <- httpServer.Serve(listener)
	}()

	fmt.Fprintf(
		stdout,
		"diffx serving %s\nrepo: %s\nscope: %s\n",
		serverURL(listener.Addr()),
		workspace.RepoRoot,
		workspace.ScopePath,
	)

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown server: %w", err)
		}

		if err := <-serverErrCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("serve http: %w", err)
		}

		return nil
	case err := <-serverErrCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve http: %w", err)
	}
}

func parseConfig(args []string, stderr io.Writer) (config, error) {
	cfg := config{
		host:       "127.0.0.1",
		port:       8080,
		targetPath: ".",
	}

	flagSet := flag.NewFlagSet("diffx", flag.ContinueOnError)
	flagSet.SetOutput(stderr)
	flagSet.StringVar(&cfg.host, "host", cfg.host, "HTTP host to bind")
	flagSet.IntVar(&cfg.port, "port", cfg.port, "HTTP port to bind")
	flagSet.Usage = func() {
		fmt.Fprintln(flagSet.Output(), "Usage: diffx [path] [-host 127.0.0.1] [-port 8080]")
		flagSet.PrintDefaults()
	}

	if err := flagSet.Parse(args); err != nil {
		return config{}, err
	}

	if cfg.port < 0 || cfg.port > 65535 {
		return config{}, fmt.Errorf("invalid port %d", cfg.port)
	}

	remainingArgs := flagSet.Args()
	if len(remainingArgs) > 1 {
		return config{}, fmt.Errorf("expected at most one path argument")
	}
	if len(remainingArgs) == 1 {
		cfg.targetPath = remainingArgs[0]
	}

	return cfg, nil
}

func serverURL(addr net.Addr) string {
	tcpAddr, ok := addr.(*net.TCPAddr)
	if !ok {
		return addr.String()
	}

	host := tcpAddr.IP.String()
	switch host {
	case "", "0.0.0.0", "::":
		host = "127.0.0.1"
	}

	return (&url.URL{
		Scheme: "http",
		Host:   net.JoinHostPort(host, strconv.Itoa(tcpAddr.Port)),
	}).String()
}
