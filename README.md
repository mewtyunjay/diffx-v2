# diffx

A local Git diff review app with a browser UI. Review changes, switch comparison branches, stage and unstage files, and create commits.

## Install

macOS and Linux, on Intel/AMD or ARM64:

```sh
curl -fsSL https://github.com/mewtyunjay/diffx-v2/releases/latest/download/install.sh | bash
```

The installer downloads a prebuilt binary, verifies its SHA-256 checksum, and installs it to `~/.local/bin/diffx`. It prints a command if that directory is missing from your `PATH`; it never edits shell configuration or sets up coding agents.

You need Git and a browser. Node and Go are only needed to build from source.

## Use

```sh
cd /path/to/your/repository
diffx
```

Diffx starts a local server and opens your browser. It uses your terminal's current directory, including when you start inside a repository subfolder. Press **Ctrl+C** to stop it.

```sh
diffx /path/to/repository     # choose a different directory
diffx --no-browser           # print the URL without opening it
diffx -p 9000                # choose a port
diffx --version              # show the installed version
```

Settings are stored in `~/.diffx/config.json` and survive upgrades.

## Upgrade or choose a version

Rerun the install command to upgrade. To pin a release (replace the example tag with a published version):

```sh
curl -fsSL https://github.com/mewtyunjay/diffx-v2/releases/download/v0.1.0/install.sh | bash -s -- --version v0.1.0
```

To choose a writable install directory:

```sh
curl -fsSL https://github.com/mewtyunjay/diffx-v2/releases/latest/download/install.sh | env INSTALL_DIR="$HOME/bin" bash
```

To uninstall, remove the executable from the install directory. Remove `~/.diffx` separately only if you also want to delete your settings.

## Development and releases

- [Development](docs/development.md): run from source and verify changes.
- [Releasing](docs/releasing.md): test installation locally and publish a release.
