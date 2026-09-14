package scripts

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

type installerFixture struct {
	root, home, bin, assets, tools, temp string
}

func newInstallerFixture(t *testing.T) installerFixture {
	t.Helper()
	root := t.TempDir()
	f := installerFixture{root, filepath.Join(root, "home"), filepath.Join(root, "bin with ' quotes $cash"),
		filepath.Join(root, "assets"), filepath.Join(root, "tools"), filepath.Join(root, "temp")}
	for _, dir := range []string{f.home, f.bin, f.assets, f.tools, f.temp} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	writeTestFile(t, filepath.Join(f.tools, "uname"), "#!/bin/sh\ncase \"$1\" in -s) echo \"${TEST_OS:-Linux}\";; -m) echo \"${TEST_ARCH:-x86_64}\";; esac\n", 0o755)
	// Fake only the network boundary; real tar, checksums, and file replacement run.
	writeTestFile(t, filepath.Join(f.tools, "curl"), `#!/bin/bash
set -eu
output=''
url=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -w|--proto|--proto-redir|--retry|--connect-timeout|--max-time) shift 2 ;;
    https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
printf '%s\n' "$url" >> "$TEST_ROOT/requests"
[[ "${FAIL_DOWNLOAD:-0}" == 0 ]] || exit 22
if [[ "$url" == */releases/latest ]]; then
  printf '%s' "${url%/latest}/tag/v1.2.3"
else
  cp "$TEST_ASSETS/${url##*/}" "$output"
fi
`, 0o755)
	return f
}

func writeTestFile(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
}

func (f installerFixture) archive(t *testing.T, asset, entry, content string) {
	t.Helper()
	var data bytes.Buffer
	gz := gzip.NewWriter(&data)
	tw := tar.NewWriter(gz)
	if err := tw.WriteHeader(&tar.Header{Name: entry, Mode: 0o755, Size: int64(len(content))}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write([]byte(content)); err != nil {
		t.Fatal(err)
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(f.assets, asset), data.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, filepath.Join(f.assets, "SHA256SUMS.txt"), fmt.Sprintf("%x  %s\n", sha256.Sum256(data.Bytes()), asset), 0o644)
}

func (f installerFixture) run(t *testing.T, extraEnv []string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("bash", append([]string{"install.sh"}, args...)...)
	cmd.Env = append(os.Environ(), "HOME="+f.home, "INSTALL_DIR="+f.bin,
		"PATH="+f.tools+":"+os.Getenv("PATH"), "SHELL=/bin/bash", "TMPDIR="+f.temp,
		"TEST_ROOT="+f.root, "TEST_ASSETS="+f.assets)
	cmd.Env = append(cmd.Env, extraEnv...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func TestInstallerPlatformsAndUpgrade(t *testing.T) {
	for _, tc := range []struct{ os, arch, asset string }{
		{"Linux", "x86_64", "linux_x86_64"}, {"Linux", "aarch64", "linux_arm64"},
		{"Darwin", "x86_64", "darwin_x86_64"}, {"Darwin", "arm64", "darwin_arm64"},
	} {
		t.Run(tc.asset, func(t *testing.T) {
			f := newInstallerFixture(t)
			f.archive(t, "diffx_"+tc.asset+".tar.gz", "diffx", "new binary")
			installed := filepath.Join(f.bin, "diffx")
			writeTestFile(t, installed, "old binary", 0o755)
			old, err := os.Open(installed)
			if err != nil {
				t.Fatal(err)
			}
			defer old.Close()
			output, err := f.run(t, []string{"TEST_OS=" + tc.os, "TEST_ARCH=" + tc.arch}, "--from-dir", f.assets)
			if err != nil {
				t.Fatalf("%v: %s", err, output)
			}
			got, _ := os.ReadFile(installed)
			if string(got) != "new binary" {
				t.Fatalf("installed %q", got)
			}
			var previous [10]byte
			if _, err := old.Read(previous[:]); err != nil || string(previous[:]) != "old binary" {
				t.Fatalf("previous executable was modified: %q, %v", previous, err)
			}
			info, _ := os.Stat(installed)
			if info.Mode().Perm() != 0o755 {
				t.Fatalf("mode: %v", info.Mode())
			}
			if !strings.Contains(output, "export PATH=") {
				t.Fatal(output)
			}
			// Verify printed shell syntax preserves literal paths, including quotes and dollars.
			for _, line := range strings.Split(output, "\n") {
				if strings.HasPrefix(line, "  export PATH=") {
					cmd := exec.Command("bash", "-c", line+"\nprintf '%s' \"$PATH\"")
					result, err := cmd.Output()
					if err != nil || !strings.HasPrefix(string(result), f.bin+":") {
						t.Fatalf("PATH hint: %s (%v)", result, err)
					}
				}
			}
			entries, _ := os.ReadDir(f.home)
			if len(entries) != 0 {
				t.Fatalf("installer changed home: %v", entries)
			}
			entries, _ = os.ReadDir(f.temp)
			if len(entries) != 0 {
				t.Fatalf("temporary files left behind: %v", entries)
			}
		})
	}
}

func TestInstallerFailuresPreserveExistingBinary(t *testing.T) {
	for _, scenario := range []string{"checksum", "missing-checksum", "missing-binary", "unsupported-os", "unsupported-cpu", "download"} {
		t.Run(scenario, func(t *testing.T) {
			f := newInstallerFixture(t)
			entry := "diffx"
			if scenario == "missing-binary" {
				entry = "other"
			}
			f.archive(t, "diffx_linux_x86_64.tar.gz", entry, "new binary")
			writeTestFile(t, filepath.Join(f.bin, "diffx"), "old binary", 0o755)
			args := []string{"--from-dir", f.assets}
			var env []string
			switch scenario {
			case "checksum":
				writeTestFile(t, filepath.Join(f.assets, "diffx_linux_x86_64.tar.gz"), "corrupt", 0o644)
			case "missing-checksum":
				writeTestFile(t, filepath.Join(f.assets, "SHA256SUMS.txt"), "", 0o644)
			case "unsupported-os":
				env = []string{"TEST_OS=Windows"}
			case "unsupported-cpu":
				env = []string{"TEST_ARCH=riscv64"}
			case "download":
				env = []string{"FAIL_DOWNLOAD=1"}
				args = []string{"--version", "v1.2.3"}
			}
			output, err := f.run(t, env, args...)
			if err == nil {
				t.Fatalf("expected failure: %s", output)
			}
			got, _ := os.ReadFile(filepath.Join(f.bin, "diffx"))
			if string(got) != "old binary" {
				t.Fatalf("existing binary changed: %q", got)
			}
			for _, dir := range []string{f.temp, f.bin} {
				entries, _ := os.ReadDir(dir)
				for _, entry := range entries {
					if entry.Name() != "diffx" {
						t.Fatalf("leftover %s/%s", dir, entry.Name())
					}
				}
			}
		})
	}
}

func TestInstallerDownloadsOneVersion(t *testing.T) {
	for _, version := range []string{"latest", "v1.2.3-rc.1"} {
		t.Run(version, func(t *testing.T) {
			f := newInstallerFixture(t)
			f.archive(t, "diffx_linux_x86_64.tar.gz", "diffx", "binary")
			output, err := f.run(t, []string{"PATH=" + f.bin + ":" + f.tools + ":" + os.Getenv("PATH")}, "--version", version)
			if err != nil {
				t.Fatalf("%v: %s", err, output)
			}
			if strings.Contains(output, "PATH") {
				t.Fatalf("unnecessary PATH hint: %s", output)
			}
			requests, _ := os.ReadFile(filepath.Join(f.root, "requests"))
			resolved := version
			if version == "latest" {
				resolved = "v1.2.3"
			}
			base := "https://github.com/mewtyunjay/diffx-v2/releases/download/" + resolved + "/"
			if !strings.Contains(string(requests), base+"diffx_linux_x86_64.tar.gz\n"+base+"SHA256SUMS.txt\n") {
				t.Fatalf("incorrect download URLs: %s", requests)
			}
		})
	}
}

func TestInstallerDefaultDirectoryAndFishHint(t *testing.T) {
	f := newInstallerFixture(t)
	f.archive(t, "diffx_linux_x86_64.tar.gz", "diffx", "binary")
	output, err := f.run(t, []string{"INSTALL_DIR=", "SHELL=/usr/bin/fish"}, "--from-dir", f.assets)
	if err != nil {
		t.Fatalf("%v: %s", err, output)
	}
	if _, err := os.Stat(filepath.Join(f.home, ".local", "bin", "diffx")); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output, "fish_add_path") {
		t.Fatal(output)
	}
}
