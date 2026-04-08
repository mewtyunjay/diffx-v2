import type { FileDiffResult } from "@/git/types"

import PrepareDiffWorker from "@/diffs/create.worker.ts?worker"
import {
  type PreparedFileDiffResult,
  type PrepareDiffWorkerResponse,
} from "@/diffs/create"

type PendingRequest = {
  resolve: (diff: PreparedFileDiffResult) => void
  reject: (error: Error) => void
}

let nextRequestId = 0
let workerInstance: Worker | null = null
const pendingRequests = new Map<number, PendingRequest>()

function rejectPendingRequests(error: Error) {
  pendingRequests.forEach(({ reject }) => reject(error))
  pendingRequests.clear()
}

function disposeWorker(error?: Error) {
  workerInstance?.terminate()
  workerInstance = null

  if (error) {
    rejectPendingRequests(error)
  }
}

function getWorker() {
  if (typeof Worker === "undefined") {
    return null
  }

  if (workerInstance) {
    return workerInstance
  }

  const nextWorker = new PrepareDiffWorker()

  nextWorker.onmessage = (event: MessageEvent<PrepareDiffWorkerResponse>) => {
    const pendingRequest = pendingRequests.get(event.data.id)
    if (!pendingRequest) {
      return
    }

    pendingRequests.delete(event.data.id)

    if ("preparedDiff" in event.data) {
      pendingRequest.resolve(event.data.preparedDiff)
      return
    }

    pendingRequest.reject(new Error(event.data.error))
  }

  nextWorker.onerror = (event) => {
    disposeWorker(new Error(event.message || "Diff parse worker failed"))
  }

  workerInstance = nextWorker

  return workerInstance
}

async function prepareFileDiffFallback(diff: FileDiffResult) {
  const { prepareFileDiff } = await import("@/diffs/create.parser")
  return prepareFileDiff(diff)
}

export async function prepareFileDiffAsync(diff: FileDiffResult) {
  const worker = getWorker()
  if (!worker) {
    return prepareFileDiffFallback(diff)
  }

  try {
    return await new Promise<PreparedFileDiffResult>((resolve, reject) => {
      const requestId = nextRequestId
      nextRequestId += 1

      pendingRequests.set(requestId, { resolve, reject })

      try {
        worker.postMessage({
          id: requestId,
          diff,
        })
      } catch (error) {
        pendingRequests.delete(requestId)
        reject(error instanceof Error ? error : new Error("Failed to schedule diff parse"))
      }
    })
  } catch {
    disposeWorker()
    return prepareFileDiffFallback(diff)
  }
}
