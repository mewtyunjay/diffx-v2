package server

import (
	"context"
	"errors"
	"strings"
	"sync"
)

var (
	ErrReviewFeedbackDisabled         = errors.New("review feedback is not enabled")
	ErrReviewFeedbackAlreadySubmitted = errors.New("review feedback was already submitted")
	ErrReviewFeedbackClosed           = errors.New("review feedback channel closed")
)

type ReviewFeedback struct {
	Approved    bool   `json:"approved"`
	Feedback    string `json:"feedback"`
	Annotations []any  `json:"annotations,omitempty"`
}

type reviewFeedbackCoordinator struct {
	enabled bool
	once    sync.Once
	mu      sync.Mutex
	ch      chan ReviewFeedback
}

func newReviewFeedbackCoordinator(enabled bool) *reviewFeedbackCoordinator {
	return &reviewFeedbackCoordinator{
		enabled: enabled,
		ch:      make(chan ReviewFeedback, 1),
	}
}

func (c *reviewFeedbackCoordinator) Enabled() bool {
	return c != nil && c.enabled
}

func (c *reviewFeedbackCoordinator) Submit(feedback ReviewFeedback) error {
	if !c.Enabled() {
		return ErrReviewFeedbackDisabled
	}

	feedback.Feedback = strings.TrimSpace(feedback.Feedback)

	submitted := false
	c.once.Do(func() {
		submitted = true
		c.ch <- feedback
		close(c.ch)
	})
	if !submitted {
		return ErrReviewFeedbackAlreadySubmitted
	}

	return nil
}

func (c *reviewFeedbackCoordinator) Wait(ctx context.Context) (ReviewFeedback, error) {
	if !c.Enabled() {
		return ReviewFeedback{}, ErrReviewFeedbackDisabled
	}

	select {
	case <-ctx.Done():
		return ReviewFeedback{}, ctx.Err()
	case feedback, ok := <-c.ch:
		if !ok {
			return ReviewFeedback{}, ErrReviewFeedbackClosed
		}
		return feedback, nil
	}
}

func (c *reviewFeedbackCoordinator) Close() {
	if c == nil {
		return
	}

	c.once.Do(func() {
		close(c.ch)
	})
}
