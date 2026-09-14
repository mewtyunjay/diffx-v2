#!/usr/bin/env python3
"""Exercise a standalone binary in an isolated repository, without opening a browser."""

import json
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request


def main():
    binary = str(Path(sys.argv[1]).resolve(strict=True))
    with tempfile.TemporaryDirectory(prefix="diffx-smoke-") as temp:
        root = Path(temp)
        home = root / "home"
        repo = root / "repo"
        home.mkdir()
        repo.mkdir()
        env = dict(os.environ, HOME=str(home), XDG_CONFIG_HOME=str(home / ".config"),
                   XDG_DATA_HOME=str(home / ".local/share"), GIT_CONFIG_NOSYSTEM="1",
                   GIT_CONFIG_GLOBAL=os.devnull)
        version = subprocess.check_output([binary, "--version"], cwd=home, env=env, text=True)
        assert version.startswith("diffx "), version
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, env=env, check=True)
        (repo / "example.txt").write_text("before\n")
        subprocess.run(["git", "add", "example.txt"], cwd=repo, env=env, check=True)
        subprocess.run(["git", "-c", "user.name=Smoke Test", "-c", "user.email=smoke@example.invalid",
                        "-c", "commit.gpgsign=false", "commit", "-qm", "initial"],
                       cwd=repo, env=env, check=True)
        (repo / "example.txt").write_text("after\n")
        process = subprocess.Popen([binary, "--no-browser", "--port", "0"], cwd=repo,
                                   env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   text=True)
        lines = queue.Queue()
        log = []

        def read_output():
            for line in process.stdout:
                lines.put(line)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        try:
            deadline = time.monotonic() + 20
            url = None
            while time.monotonic() < deadline:
                try:
                    line = lines.get(timeout=0.2)
                except queue.Empty:
                    if process.poll() is not None:
                        raise RuntimeError("diffx exited: " + "".join(log))
                    continue
                log.append(line)
                match = re.search(r"diffx serving (http://\S+)", line)
                if match:
                    url = match[1]
                    break
            assert url, "No startup URL: " + "".join(log)
            # Ignore host proxy settings for this loopback-only test.
            client = urllib.request.build_opener(urllib.request.ProxyHandler({}))

            def get(path):
                with client.open(url + path, timeout=10) as response:
                    assert response.status == 200
                    return response.read()

            html = get("/").decode()
            assert '<div id="root">' in html, "Missing React root"
            assets = re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"', html)
            assert any(asset.endswith(".js") for asset in assets), "Missing production JavaScript"
            for asset in assets:
                assert get(asset), "Empty embedded asset: " + asset
            files = json.loads(get("/api/files"))["files"]
            assert any(item["path"] == "example.txt" for item in files), files
            print(f"Smoke test passed: {version.strip()}, embedded UI/assets, API, current directory")
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            reader.join(timeout=2)
            process.stdout.close()


if __name__ == "__main__":
    main()
