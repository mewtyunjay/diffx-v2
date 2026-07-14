# diffx

`diffx` is a local git diff review app. It gives you a browser UI for reviewing changes, switching comparison branches, staging and unstaging files, and creating commits — plus an agent review mode that hands your annotations back to a coding agent.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/mewtyunjay/diffx-v2/main/scripts/install.sh | bash
```

This downloads the latest release binary, verifies its checksum, and installs it to `~/.local/bin/diffx`. If that directory is not on your `PATH`, the installer prints the exact command to add it.

To install somewhere else or pin a version:

```sh
INSTALL_DIR=/usr/local/bin bash scripts/install.sh --version v1.2.3
```

To build from source instead, see [docs/development.md](docs/development.md).

## Usage

```sh
diffx          # open the review UI for the current repository
diffx review   # agent review mode: annotate in the UI, feedback prints to stdout
```

In review mode, annotate the diff and press **Send to agent** — `diffx` prints your feedback to stdout and exits, so a calling agent can pick it up and continue in the same thread.

Useful flags: `--no-browser` skips opening the browser, `--review-timeout 30m` bounds how long review mode waits, `-p 9000` pins the port.

## Agent setup

`diffx setup` installs the diffx skill for your coding agents, so they know how to run a review and consume the feedback:

```sh
diffx setup                # install for the default agents (universal, claude)
diffx setup --list-agents  # see supported agents
diffx setup --yes --agents universal,claude,codex
```

The skill is written once to `~/.local/share/diffx/skills/diffx/` and symlinked into each agent's skills directory, so upgrading `diffx` upgrades the skill everywhere. Use `--copy` if you prefer copies over symlinks.

The installer can run setup for you:

```sh
curl -fsSL https://raw.githubusercontent.com/mewtyunjay/diffx-v2/main/scripts/install.sh | bash -s -- --setup --yes
```

## Development

See [docs/development.md](docs/development.md) for building from source, dev mode with hot reload, and running tests.
