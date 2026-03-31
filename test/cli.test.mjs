import test from "node:test"
import assert from "node:assert/strict"

import { parseArgs, resolveBinaryPath } from "../bin/diffx.js"

test("parseArgs accepts a path, port, and no-open flag", () => {
  const result = parseArgs(["frontend", "--port", "4123", "--no-open"])

  assert.deepEqual(result, {
    help: false,
    port: 4123,
    shouldOpen: false,
    targetPath: "frontend",
  })
})

test("parseArgs rejects unknown flags", () => {
  assert.throws(() => parseArgs(["--wat"]), /unknown flag/)
})

test("resolveBinaryPath maps darwin arm64", () => {
  assert.match(resolveBinaryPath("darwin", "arm64"), /runtime\/bin\/darwin-arm64\/diffx-server$/)
})

test("resolveBinaryPath rejects unsupported targets", () => {
  assert.throws(() => resolveBinaryPath("freebsd", "x64"), /unsupported platform/)
})
