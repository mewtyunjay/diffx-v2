package main

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

type releaseConfig struct {
	yes           bool
	dryRun        bool
	remote        string
	allowDirty    bool
	allowNonMain  bool
	skipFetchTags bool
}

func runRelease(args []string, stdout, stderr io.Writer) error {
	cfg, versionArg, err := parseReleaseConfig(args, stderr)
	if err != nil {
		return err
	}

	if _, err := exec.LookPath("git"); err != nil {
		return fmt.Errorf("git is required: %w", err)
	}

	repoRoot, err := runGit("rev-parse", "--show-toplevel")
	if err != nil {
		return fmt.Errorf("not inside a git repository: %w", err)
	}

	branch, err := runGit("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return err
	}
	if branch != "main" && !cfg.allowNonMain {
		return fmt.Errorf("release must run from branch main (current: %s). Use --allow-non-main to override", branch)
	}

	if !cfg.allowDirty {
		status, err := runGit("status", "--porcelain")
		if err != nil {
			return err
		}
		if strings.TrimSpace(status) != "" {
			return errors.New("working tree is not clean. Commit or stash changes, or use --allow-dirty")
		}
	}

	if !cfg.skipFetchTags {
		fmt.Fprintf(stdout, "release: fetching tags from %s...\n", cfg.remote)
		if _, err := runGit("fetch", "--tags", cfg.remote); err != nil {
			return err
		}
	}

	tag, err := resolveReleaseTag(versionArg)
	if err != nil {
		return err
	}

	exists, err := gitTagExists(tag)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("tag %s already exists", tag)
	}

	fmt.Fprintf(stdout, "release: repository: %s\n", repoRoot)
	fmt.Fprintf(stdout, "release: branch: %s\n", branch)
	fmt.Fprintf(stdout, "release: tag: %s\n", tag)
	fmt.Fprintf(stdout, "release: remote: %s\n", cfg.remote)

	if cfg.dryRun {
		fmt.Fprintf(stdout, "\nrelease: dry-run, would execute:\n")
		fmt.Fprintf(stdout, "  git tag -a %s -m \"Release %s\"\n", tag, tag)
		fmt.Fprintf(stdout, "  git push %s %s\n", cfg.remote, tag)
		return nil
	}

	if !cfg.yes {
		confirmed, err := confirmRelease(stdout, tag)
		if err != nil {
			return err
		}
		if !confirmed {
			return errors.New("release cancelled")
		}
	}

	if _, err := runGit("tag", "-a", tag, "-m", "Release "+tag); err != nil {
		return err
	}
	if _, err := runGit("push", cfg.remote, tag); err != nil {
		return err
	}

	fmt.Fprintf(stdout, "release: created and pushed %s\n", tag)
	fmt.Fprintln(stdout, "release: GitHub Actions will publish release assets for installer downloads.")

	return nil
}

func parseReleaseConfig(args []string, stderr io.Writer) (releaseConfig, string, error) {
	cfg := releaseConfig{
		remote: "origin",
	}

	versionArgs := make([]string, 0, 1)

	for index := 0; index < len(args); index++ {
		arg := args[index]

		switch {
		case arg == "--yes":
			cfg.yes = true
		case arg == "--dry-run":
			cfg.dryRun = true
		case arg == "--allow-dirty":
			cfg.allowDirty = true
		case arg == "--allow-non-main":
			cfg.allowNonMain = true
		case arg == "--skip-fetch-tags":
			cfg.skipFetchTags = true
		case arg == "--remote":
			if index+1 >= len(args) {
				return releaseConfig{}, "", errors.New("missing value for --remote")
			}
			index++
			cfg.remote = strings.TrimSpace(args[index])
		case strings.HasPrefix(arg, "--remote="):
			cfg.remote = strings.TrimSpace(strings.TrimPrefix(arg, "--remote="))
		case strings.HasPrefix(arg, "-"):
			fmt.Fprintln(stderr, releaseUsageText)
			return releaseConfig{}, "", fmt.Errorf("unknown flag: %s", arg)
		default:
			versionArgs = append(versionArgs, arg)
		}
	}

	if cfg.remote == "" {
		return releaseConfig{}, "", errors.New("remote must not be empty")
	}
	if len(versionArgs) != 1 {
		fmt.Fprintln(stderr, releaseUsageText)
		return releaseConfig{}, "", errors.New("expected exactly one release version argument: major/minor/patch")
	}

	return cfg, versionArgs[0], nil
}

func parseReleaseTag(versionArg string) (string, error) {
	normalized := strings.TrimSpace(versionArg)
	normalized = strings.TrimPrefix(normalized, "v")

	var parts []string
	switch {
	case strings.Count(normalized, "/") == 2:
		parts = strings.Split(normalized, "/")
	case strings.Count(normalized, ".") == 2:
		parts = strings.Split(normalized, ".")
	default:
		return "", fmt.Errorf("invalid version %q. Expected major/minor/patch", versionArg)
	}

	if len(parts) != 3 {
		return "", fmt.Errorf("invalid version %q. Expected major/minor/patch", versionArg)
	}

	values := make([]int, 3)
	for index, part := range parts {
		value, err := strconv.Atoi(part)
		if err != nil || value < 0 {
			return "", fmt.Errorf("invalid version component %q in %q", part, versionArg)
		}
		values[index] = value
	}

	return fmt.Sprintf("v%d.%d.%d", values[0], values[1], values[2]), nil
}

func resolveReleaseTag(versionArg string) (string, error) {
	normalized := strings.TrimSpace(strings.ToLower(versionArg))
	switch normalized {
	case "major", "minor", "patch":
		tags, err := listSemverTags()
		if err != nil {
			return "", err
		}
		return nextTagForBump(tags, normalized)
	default:
		return parseReleaseTag(versionArg)
	}
}

func confirmRelease(stdout io.Writer, tag string) (bool, error) {
	if !isInteractiveTerminal() {
		return false, errors.New("non-interactive terminal. Use --yes to confirm release creation")
	}

	fmt.Fprintf(stdout, "Confirm release %s? This will create and push the tag. [y/N]: ", tag)

	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false, err
	}

	switch strings.ToLower(strings.TrimSpace(response)) {
	case "y", "yes":
		return true, nil
	default:
		return false, nil
	}
}

func gitTagExists(tag string) (bool, error) {
	output, err := runGit("tag", "-l", tag)
	if err != nil {
		return false, err
	}

	return strings.TrimSpace(output) == tag, nil
}

func listSemverTags() ([]string, error) {
	output, err := runGit("tag", "-l", "v*")
	if err != nil {
		return nil, err
	}

	all := strings.Split(strings.TrimSpace(output), "\n")
	valid := make([]string, 0, len(all))
	for _, tag := range all {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if semverTagPattern.MatchString(tag) {
			valid = append(valid, tag)
		}
	}

	return valid, nil
}

func nextTagForBump(tags []string, bump string) (string, error) {
	major, minor, patch, err := latestVersion(tags)
	if err != nil {
		return "", err
	}

	switch bump {
	case "major":
		major++
		minor = 0
		patch = 0
	case "minor":
		minor++
		patch = 0
	case "patch":
		patch++
	default:
		return "", fmt.Errorf("invalid bump type %q", bump)
	}

	return fmt.Sprintf("v%d.%d.%d", major, minor, patch), nil
}

func latestVersion(tags []string) (int, int, int, error) {
	if len(tags) == 0 {
		return 0, 0, 0, nil
	}

	bestMajor := -1
	bestMinor := -1
	bestPatch := -1

	for _, tag := range tags {
		match := semverTagPattern.FindStringSubmatch(tag)
		if len(match) != 4 {
			continue
		}

		major, err := strconv.Atoi(match[1])
		if err != nil {
			return 0, 0, 0, err
		}
		minor, err := strconv.Atoi(match[2])
		if err != nil {
			return 0, 0, 0, err
		}
		patch, err := strconv.Atoi(match[3])
		if err != nil {
			return 0, 0, 0, err
		}

		if major > bestMajor ||
			(major == bestMajor && minor > bestMinor) ||
			(major == bestMajor && minor == bestMinor && patch > bestPatch) {
			bestMajor = major
			bestMinor = minor
			bestPatch = patch
		}
	}

	if bestMajor < 0 {
		return 0, 0, 0, nil
	}

	return bestMajor, bestMinor, bestPatch, nil
}

func runGit(args ...string) (string, error) {
	command := exec.Command("git", args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr

	if err := command.Run(); err != nil {
		errText := strings.TrimSpace(stderr.String())
		if errText != "" {
			return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), errText)
		}
		return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}

	return strings.TrimSpace(stdout.String()), nil
}

const releaseUsageText = "Usage: diffx release <major/minor/patch> [--yes] [--dry-run] [--remote origin] [--allow-dirty] [--allow-non-main]"

var semverTagPattern = regexp.MustCompile(`^v([0-9]+)\.([0-9]+)\.([0-9]+)$`)
