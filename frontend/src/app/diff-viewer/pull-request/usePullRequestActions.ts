import { useCallback, useState } from "react"

import { approvePullRequest, mergePullRequest } from "@/git/api"
import type { MergeMethod } from "@/git/types"

type UsePullRequestActionsOptions = {
  onSuccess: () => Promise<void> | void
}

export function usePullRequestActions({ onSuccess }: UsePullRequestActionsOptions) {
  const [approvePendingNumber, setApprovePendingNumber] = useState<number | null>(null)
  const [mergePendingNumber, setMergePendingNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const approve = useCallback(
    async (number: number, body?: string) => {
      setApprovePendingNumber(number)
      setError(null)

      try {
        await approvePullRequest(body ? { number, body } : { number })
        await onSuccess()
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "Unable to approve pull request."
        setError(message)
        throw new Error(message)
      } finally {
        setApprovePendingNumber(null)
      }
    },
    [onSuccess]
  )

  const merge = useCallback(
    async (number: number, method?: MergeMethod) => {
      setMergePendingNumber(number)
      setError(null)

      try {
        await mergePullRequest(method ? { number, method } : { number })
        await onSuccess()
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "Unable to merge pull request."
        setError(message)
        throw new Error(message)
      } finally {
        setMergePendingNumber(null)
      }
    },
    [onSuccess]
  )

  return {
    approve,
    approvePendingNumber,
    error,
    merge,
    mergePendingNumber,
  }
}
