/// <reference lib="webworker" />

import {
  type PrepareDiffWorkerRequest,
  type PrepareDiffWorkerResponse,
} from "./prepareDiff"
import { prepareFileDiff } from "./prepareDiff.parser"

self.onmessage = (event: MessageEvent<PrepareDiffWorkerRequest>) => {
  const { id, diff } = event.data

  try {
    const response: PrepareDiffWorkerResponse = {
      id,
      preparedDiff: prepareFileDiff(diff),
    }

    self.postMessage(response)
  } catch (error) {
    const response: PrepareDiffWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : "Failed to prepare diff",
    }

    self.postMessage(response)
  }
}

export {}
