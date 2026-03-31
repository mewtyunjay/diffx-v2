import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn } from "node:child_process"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, "..")
const frontendDir = join(repoRoot, "frontend")
const internalDir = join(repoRoot, "internal")
const runtimeDir = join(repoRoot, "runtime")
const runtimeBinDir = join(runtimeDir, "bin")
const runtimeWebDir = join(runtimeDir, "web")

const targets = [
  { goos: "darwin", goarch: "arm64", target: "darwin-arm64" },
  { goos: "darwin", goarch: "amd64", target: "darwin-x64" },
  { goos: "linux", goarch: "arm64", target: "linux-arm64" },
  { goos: "linux", goarch: "amd64", target: "linux-x64" },
  { goos: "windows", goarch: "amd64", target: "win32-x64", extension: ".exe" },
]

async function run(command, args, options = {}) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun()
        return
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`))
    })
  })
}

await run("npm", ["run", "build"], { cwd: frontendDir, env: process.env })

await rm(runtimeDir, { force: true, recursive: true })
await mkdir(runtimeBinDir, { recursive: true })
await cp(join(frontendDir, "dist"), runtimeWebDir, { recursive: true })

for (const target of targets) {
  const targetDir = join(runtimeBinDir, target.target)
  await mkdir(targetDir, { recursive: true })

  const output = join(targetDir, `diffx-server${target.extension ?? ""}`)
  await run("go", ["build", "-o", output, "./cmd/server"], {
    cwd: internalDir,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOARCH: target.goarch,
      GOOS: target.goos,
    },
  })
}
