#!/usr/bin/env node

import { spawn } from "node:child_process"
import { constants } from "node:fs"
import { realpathSync } from "node:fs"
import { access } from "node:fs/promises"
import { createServer } from "node:net"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const targetMap = {
  darwin: {
    arm64: "darwin-arm64",
    x64: "darwin-x64",
  },
  linux: {
    arm64: "linux-arm64",
    x64: "linux-x64",
  },
  win32: {
    x64: "win32-x64",
  },
}

const usageText = `diffx

Usage:
  diffx
  diffx [path]
  diffx [path] --port <port>
  diffx [path] --no-open
`

export function parseArgs(args) {
  let targetPath = null
  let port = null
  let shouldOpen = true

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "-h" || arg === "--help") {
      return { help: true }
    }

    if (arg === "--no-open") {
      shouldOpen = false
      continue
    }

    if (arg === "--port") {
      const value = args[index + 1]
      if (!value) {
        throw new Error("--port requires a value")
      }

      const parsedPort = Number.parseInt(value, 10)
      if (Number.isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65535) {
        throw new Error(`invalid port ${value}`)
      }

      port = parsedPort
      index += 1
      continue
    }

    if (arg.startsWith("--")) {
      throw new Error(`unknown flag ${arg}`)
    }

    if (targetPath !== null) {
      throw new Error("only one path argument is supported")
    }

    targetPath = arg
  }

  return {
    help: false,
    port,
    shouldOpen,
    targetPath,
  }
}

export function resolveBinaryPath(platform = process.platform, arch = process.arch) {
  const platformTargets = targetMap[platform]
  if (!platformTargets) {
    throw new Error(`unsupported platform ${platform}`)
  }

  const target = platformTargets[arch]
  if (!target) {
    throw new Error(`unsupported architecture ${platform}/${arch}`)
  }

  const binaryName = platform === "win32" ? "diffx-server.exe" : "diffx-server"
  return join(packageRoot, "runtime", "bin", target, binaryName)
}

async function ensureReadable(path) {
  await access(path, constants.R_OK)
}

async function ensureExecutable(path) {
  const mode = process.platform === "win32" ? constants.F_OK : constants.X_OK
  await access(path, mode)
}

async function resolvePort(explicitPort) {
  if (explicitPort !== null) {
    return explicitPort
  }

  return await new Promise((resolvePortPromise, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("could not determine a free port"))
        return
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolvePortPromise(address.port)
      })
    })
  })
}

async function waitForHealth(url, child, timeoutMs = 20000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`diffx server exited with code ${child.exitCode ?? 1}`)
    }

    try {
      const response = await fetch(`${url}/api/hello`)
      if (response.ok) {
        return
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200))
  }

  throw new Error("timed out waiting for diffx server")
}

async function openBrowser(url) {
  const commandByPlatform = {
    darwin: { command: "open", args: [url] },
    linux: { command: "xdg-open", args: [url] },
    win32: { command: "cmd", args: ["/c", "start", "", url] },
  }

  const entry = commandByPlatform[process.platform]
  if (!entry) {
    throw new Error(`automatic browser open is not supported on ${process.platform}`)
  }

  return await new Promise((resolveOpen, reject) => {
    const opener = spawn(entry.command, entry.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
    opener.on("error", reject)
    opener.unref()
    resolveOpen()
  })
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    console.log(usageText)
    return
  }

  const binaryPath = resolveBinaryPath()
  const webRoot = join(packageRoot, "runtime", "web")
  await Promise.all([ensureExecutable(binaryPath), ensureReadable(webRoot)])

  const cwd = resolve(parsed.targetPath ?? process.cwd())
  const port = await resolvePort(parsed.port)
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(
    binaryPath,
    [
      "--cwd",
      cwd,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--web-root",
      webRoot,
    ],
    {
      stdio: "inherit",
      windowsHide: true,
    }
  )

  const terminateChild = (signal) => {
    if (child.exitCode === null) {
      child.kill(signal)
    }
  }

  process.on("SIGINT", () => terminateChild("SIGINT"))
  process.on("SIGTERM", () => terminateChild("SIGTERM"))

  try {
    await waitForHealth(baseUrl, child)
    console.log(`diffx running at ${baseUrl}`)

    if (parsed.shouldOpen) {
      try {
        await openBrowser(baseUrl)
      } catch (error) {
        console.warn(`Could not automatically open the browser: ${error.message}`)
      }
    }
  } catch (error) {
    terminateChild("SIGTERM")
    throw error
  }

  const exitCode = await new Promise((resolveExit) => {
    child.on("exit", (code) => resolveExit(code ?? 0))
  })

  process.exit(exitCode)
}

function isMainModule() {
  if (!process.argv[1]) {
    return false
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
