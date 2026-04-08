import { useCallback, useEffect, useState } from "react"

import { fetchBranches } from "@/git/api"
import type { BranchOption } from "@/git/types"

export function useBranchesState() {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [isBranchesLoading, setIsBranchesLoading] = useState(true)

  const refreshBranches = useCallback(async (signal?: AbortSignal) => {
    const result = await fetchBranches(signal)
    setBranches(result.branches)
    setBranchesError(null)
    return result
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetchBranches(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }

        setBranches(result.branches)
        setBranchesError(null)
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return
        }

        setBranches([])
        setBranchesError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsBranchesLoading(false)
        }
      })

    return () => controller.abort()
  }, [refreshBranches])

  return {
    branches,
    branchesError,
    isBranchesLoading,
    refreshBranches,
    setBranchesError,
  }
}
