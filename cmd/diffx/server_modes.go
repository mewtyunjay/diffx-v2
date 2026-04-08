package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"diffx/internal/server"
)

const shutdownTimeout = 5 * time.Second

func runReviewSession(
	ctx context.Context,
	stdout io.Writer,
	app *server.App,
	httpServer *http.Server,
	serverErrCh <-chan error,
) error {
	type feedbackResult struct {
		feedback server.ReviewFeedback
		err      error
	}

	feedbackCh := make(chan feedbackResult, 1)
	go func() {
		feedback, err := app.WaitForReviewFeedback(ctx)
		feedbackCh <- feedbackResult{
			feedback: feedback,
			err:      err,
		}
	}()

	select {
	case <-ctx.Done():
		if err := shutdownHTTPServer(app, httpServer, serverErrCh); err != nil {
			return err
		}
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			fmt.Fprintln(stdout, "Code review session timed out before feedback was submitted.")
			return nil
		}
		return nil
	case result := <-feedbackCh:
		if result.err != nil {
			return result.err
		}
		if err := shutdownHTTPServer(app, httpServer, serverErrCh); err != nil {
			return err
		}

		if result.feedback.Approved {
			fmt.Fprintln(stdout, "Code review completed — no changes requested.")
			return nil
		}

		if result.feedback.Feedback == "" {
			fmt.Fprintln(stdout, "Code review completed — feedback was empty.")
			return nil
		}

		fmt.Fprintln(stdout, result.feedback.Feedback)
		fmt.Fprintln(stdout)
		fmt.Fprintln(stdout, "Intent routing:")
		fmt.Fprintln(stdout, "- If the user is asking a question or asking why something changed, answer directly and do not edit files.")
		fmt.Fprintln(stdout, "- Only make code edits when the user explicitly asks for an edit or implementation.")
		return nil
	case err := <-serverErrCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve http: %w", err)
	}
}

func runServerUntilShutdown(
	ctx context.Context,
	app *server.App,
	httpServer *http.Server,
	serverErrCh <-chan error,
) error {
	select {
	case <-ctx.Done():
		return shutdownHTTPServer(app, httpServer, serverErrCh)
	case err := <-serverErrCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve http: %w", err)
	}
}

func shutdownHTTPServer(
	app *server.App,
	httpServer *http.Server,
	serverErrCh <-chan error,
) error {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown server: %w", err)
	}

	if err := <-serverErrCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve http: %w", err)
	}

	return nil
}
