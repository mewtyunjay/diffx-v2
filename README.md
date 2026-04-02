# diffx-v2

`diffx` is a local git diff review app for working with changes in a git repository. It gives you a browser UI for reviewing files, switching comparison branches, staging and unstaging changes, and creating commits.

## Install

`diffx` runs as a single local binary, but building it from source also needs the frontend bundle.

Prerequisites:

- Go `1.26+`
- Node.js `20+`
- npm

### macOS

Build `diffx`, install it into `/usr/local/bin`, and run it from any git repo:

```sh
git clone https://github.com/mewtyunjay/diffx-v2.git
cd diffx-v2
go generate ./frontend
go build -o diffx ./cmd/diffx
sudo mv diffx /usr/local/bin/diffx
```

Then from your git repo:

```
diffx
```

If you prefer a user-local install instead of `sudo`:

```sh
mkdir -p "$HOME/.local/bin"
mv diffx "$HOME/.local/bin/diffx"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
source "$HOME/.zshrc"
```

### Linux

Build `diffx`, install it into `/usr/local/bin`, and run it from any git repo:

```sh
git clone https://github.com/mewtyunjay/diffx-v2.git
cd diffx-v2
go generate ./frontend
go build -o diffx ./cmd/diffx
sudo mv diffx /usr/local/bin/diffx
```

Then from your repo of choice:

```
diffx
```

If you prefer a user-local install instead of `sudo`:

```sh
mkdir -p "$HOME/.local/bin"
mv diffx "$HOME/.local/bin/diffx"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
source "$HOME/.bashrc"
```

### Windows

Build `diffx.exe`, place it in a user bin directory, add that directory to `Path`, and run it from any git repo:

```sh
git clone https://github.com/mewtyunjay/diffx-v2.git
cd diffx-v2
go generate ./frontend
go build -o diffx.exe ./cmd/diffx
New-Item -ItemType Directory -Force "$HOME\bin" | Out-Null
Move-Item .\diffx.exe "$HOME\bin\diffx.exe"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$HOME\bin", "User")
$env:Path = [Environment]::GetEnvironmentVariable("Path", "User")
cd C:\path\to\your\git\repo
diffx.exe
```

Open the URL printed by `diffx`. By default it starts on `http://127.0.0.1:8080`, and if `8080` is already occupied it will automatically move to the next free port.

### Optional shell alias

If you want a shorter command on macOS or Linux:

```sh
echo 'alias dx="diffx"' >> ~/.zshrc
source ~/.zshrc
```

Then run:

```sh
dx
```

## Quick Start

If you are developing from a source checkout instead of installing the binary, install frontend dependencies first:

```sh
cd frontend && npm install
```

`go run ./cmd/diffx` does not run `npm install` for you in dev mode.

Start the app from the repository root:

```sh
go run ./cmd/diffx
```

## Common Commands

Run the app (serves embedded frontend assets):

```sh
go run ./cmd/diffx
```

Start with the Vite dev server for frontend development:

```sh
go run ./cmd/diffx --dev
```

Change the address or port:

```sh
go run ./cmd/diffx -a 0.0.0.0 -p 9000
go run ./cmd/diffx --address 0.0.0.0 --port 9000
```

If you explicitly pass `--port` or `-p`, that port remains strict and `diffx` will fail instead of auto-selecting another port.

## Build

```sh
go generate ./frontend
go build ./cmd/diffx
```

`go generate ./frontend` installs frontend dependencies and builds the frontend bundle before you build the Go binary.

## Development

Run the frontend dev server directly if needed:

```sh
cd frontend && npm run dev
```

Run frontend linting:

```sh
cd frontend && npm run lint
```

Run backend tests:

```sh
go test ./cmd/... ./internal/...
```

## Verification

For relevant changes, run:

```sh
cd frontend && npm run lint
go generate ./frontend
go test ./cmd/... ./internal/...
```
