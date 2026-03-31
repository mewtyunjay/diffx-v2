package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"diffx/devrunner"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := devrunner.Run(ctx, devrunner.Options{}); err != nil {
		fmt.Fprintf(os.Stderr, "Backend runner failed: %v\n", err)
		os.Exit(1)
	}
}
