package diagnostics

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	retention  = 30 * 24 * time.Hour
	dateFormat = "2006-01-02"
)

type Log struct {
	root        *os.Root
	warnings    io.Writer
	mu          sync.Mutex
	file        *os.File
	name        string
	writeFailed bool
	closed      bool
	stop        chan struct{}
	done        chan struct{}
}

func Open(dir string, warnings io.Writer) (*Log, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	info, err := os.Lstat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() || info.Mode().Perm()&0o077 != 0 {
		return nil, fmt.Errorf("log directory must be private: %s (expected permissions 0700)", dir)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}

	log := &Log{root: root, warnings: warnings, stop: make(chan struct{}), done: make(chan struct{})}
	now := time.Now()
	if err := log.rotate(now); err != nil {
		_ = root.Close()
		return nil, err
	}
	log.purge(now)
	go log.maintain()
	return log, nil
}

func (log *Log) Write(record []byte) (int, error) {
	log.mu.Lock()
	defer log.mu.Unlock()
	if log.closed {
		return 0, io.ErrClosedPipe
	}

	n, err := 0, log.rotate(time.Now())
	if err == nil {
		n, err = log.file.Write(record)
	}
	if err != nil && !log.writeFailed {
		fmt.Fprintln(log.warnings, "warning: could not write Diffx diagnostics:", err)
	}
	log.writeFailed = err != nil
	return n, err
}

func (log *Log) Close() error {
	log.mu.Lock()
	if log.closed {
		log.mu.Unlock()
		return nil
	}
	log.closed = true
	log.mu.Unlock()
	close(log.stop)
	<-log.done
	log.mu.Lock()
	defer log.mu.Unlock()
	return errors.Join(log.file.Close(), log.root.Close())
}

func (log *Log) rotate(now time.Time) error {
	name := "diffx-" + now.UTC().Format(dateFormat) + ".jsonl"
	if log.name == name {
		return nil
	}

	info, err := log.root.Lstat(name)
	if err == nil && (!info.Mode().IsRegular() || info.Mode().Perm()&0o077 != 0) {
		return fmt.Errorf("expected a private regular log file: %s", filepath.Join(log.root.Name(), name))
	}
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	file, err := log.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	if log.file != nil {
		_ = log.file.Close()
	}
	log.file, log.name = file, name
	return nil
}

func (log *Log) maintain() {
	defer close(log.done)
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-log.stop:
			return
		case now := <-ticker.C:
			log.purge(now)
		}
	}
}

func (log *Log) purge(now time.Time) {
	if err := purgeExpired(log.root, now); err != nil {
		log.mu.Lock()
		defer log.mu.Unlock()
		fmt.Fprintln(log.warnings, "warning: could not purge expired Diffx logs:", err)
	}
}

func purgeExpired(root *os.Root, now time.Time) error {
	entries, err := fs.ReadDir(root.FS(), ".")
	if err != nil {
		return err
	}
	var errs []error
	cutoff := now.Add(-retention)
	today := now.UTC().Format(dateFormat)
	for _, entry := range entries {
		name := entry.Name()
		date, ok := strings.CutPrefix(name, "diffx-")
		if !ok {
			continue
		}
		date, ok = strings.CutSuffix(date, ".jsonl")
		if !ok {
			continue
		}
		if _, err := time.Parse(dateFormat, date); err != nil || date == today {
			continue
		}
		info, err := entry.Info()
		if err == nil && info.Mode().IsRegular() && info.ModTime().Before(cutoff) {
			err = root.Remove(name)
		}
		if err != nil && !errors.Is(err, fs.ErrNotExist) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func NewLogger(output io.Writer) *slog.Logger {
	return slog.New(slog.NewJSONHandler(output, &slog.HandlerOptions{
		Level:       slog.LevelDebug,
		ReplaceAttr: scrubLogAttr,
	}))
}
