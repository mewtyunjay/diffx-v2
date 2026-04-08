import { prepareFileDiff } from "@/diffs/create.parser"
import type { PrepareDiffWorkerRequest, PrepareDiffWorkerResponse } from "@/diffs/create"

self.onmessage = (event: MessageEvent<PrepareDiffWorkerRequest>) => {
  const { id, diff } = event.data

  try {
    const preparedDiff = prepareFileDiff(diff)
    const response: PrepareDiffWorkerResponse = {
      id,
      preparedDiff,
    }

    self.postMessage(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse diff"
    const response: PrepareDiffWorkerResponse = {
      id,
      error: message,
    }

    self.postMessage(response)
  }
}
