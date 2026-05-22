package main

import (
	"flag"
	"fmt"
	"io"
	"strings"
	"time"
)

const (
	defaultAddress       = "127.0.0.1"
	defaultPort          = 8080
	defaultFrontendURL   = "http://127.0.0.1:5173"
	portFallbackWindow   = 100
	defaultReviewTimeout = 30 * time.Minute
)

type config struct {
	address       string
	port          int
	explicitPort  bool
	openBrowser   bool
	reviewTimeout time.Duration
	dev           bool
	debug         bool
	reviewMode    bool
	font          string
	targetPath    string
}

func parseConfig(args []string, stderr io.Writer) (config, error) {
	cfg := config{
		address:       defaultAddress,
		port:          defaultPort,
		openBrowser:   true,
		reviewTimeout: defaultReviewTimeout,
		targetPath:    ".",
	}

	if len(args) > 0 && args[0] == "review" {
		cfg.reviewMode = true
		args = args[1:]
	}

	flagSet := flag.NewFlagSet("diffx", flag.ContinueOnError)
	flagSet.SetOutput(stderr)
	flagSet.StringVar(&cfg.address, "a", cfg.address, "HTTP address to bind")
	flagSet.StringVar(&cfg.address, "address", cfg.address, "HTTP address to bind")
	flagSet.IntVar(&cfg.port, "p", cfg.port, "HTTP port to bind")
	flagSet.IntVar(&cfg.port, "port", cfg.port, "HTTP port to bind")
	flagSet.BoolVar(&cfg.openBrowser, "open-browser", cfg.openBrowser, "Open the app URL in your browser on startup")
	noBrowser := false
	flagSet.BoolVar(&noBrowser, "no-browser", false, "Do not open the app URL in your browser")
	flagSet.BoolVar(&cfg.dev, "dev", cfg.dev, "Start the Vite dev server for frontend development")
	flagSet.BoolVar(&cfg.debug, "debug", cfg.debug, "Print structured backend debug logs")
	flagSet.StringVar(&cfg.font, "font", cfg.font, "Code font family to try before the default JetBrains Mono stack")
	flagSet.DurationVar(&cfg.reviewTimeout, "review-timeout", cfg.reviewTimeout, "Max time to keep `diffx review` waiting for feedback (0 disables timeout)")
	flagSet.Usage = func() {
		fmt.Fprintln(flagSet.Output(), "Usage: diffx [review] [path] [-a 127.0.0.1] [-p 8080] [--dev] [--debug] [--font \"Berkeley Mono Variable\"] [--no-browser] [--review-timeout 30m]")
		flagSet.PrintDefaults()
	}

	normalizedArgs := reorderFlagsBeforePositionals(normalizeFlagAliases(args))
	if err := flagSet.Parse(normalizedArgs); err != nil {
		return config{}, err
	}
	flagSet.Visit(func(f *flag.Flag) {
		if f.Name == "p" || f.Name == "port" {
			cfg.explicitPort = true
		}
	})

	if cfg.port < 0 || cfg.port > 65535 {
		return config{}, fmt.Errorf("invalid port %d", cfg.port)
	}
	if noBrowser {
		cfg.openBrowser = false
	}
	cfg.font = strings.TrimSpace(cfg.font)

	remainingArgs := flagSet.Args()
	if len(remainingArgs) > 1 {
		return config{}, fmt.Errorf("expected at most one path argument")
	}
	if len(remainingArgs) == 1 {
		cfg.targetPath = remainingArgs[0]
	}

	return cfg, nil
}

func normalizeFlagAliases(args []string) []string {
	normalized := make([]string, len(args))
	for index, arg := range args {
		switch {
		case arg == "-host":
			normalized[index] = "-address"
		case arg == "--host":
			normalized[index] = "--address"
		case strings.HasPrefix(arg, "-host="):
			normalized[index] = "-address=" + strings.TrimPrefix(arg, "-host=")
		case strings.HasPrefix(arg, "--host="):
			normalized[index] = "--address=" + strings.TrimPrefix(arg, "--host=")
		default:
			normalized[index] = arg
		}
	}

	return normalized
}

func reorderFlagsBeforePositionals(args []string) []string {
	flags := make([]string, 0, len(args))
	positionals := make([]string, 0, len(args))

	for index := 0; index < len(args); index++ {
		arg := args[index]
		if arg == "--" {
			positionals = append(positionals, args[index+1:]...)
			break
		}
		if !strings.HasPrefix(arg, "-") || arg == "-" {
			positionals = append(positionals, arg)
			continue
		}

		flags = append(flags, arg)
		if flagExpectsValue(arg) && !strings.Contains(arg, "=") && index+1 < len(args) {
			index++
			flags = append(flags, args[index])
		}
	}

	return append(flags, positionals...)
}

func flagExpectsValue(arg string) bool {
	name := strings.TrimLeft(arg, "-")
	if before, _, ok := strings.Cut(name, "="); ok {
		name = before
	}

	switch name {
	case "a", "address", "p", "port", "font", "review-timeout":
		return true
	default:
		return false
	}
}
