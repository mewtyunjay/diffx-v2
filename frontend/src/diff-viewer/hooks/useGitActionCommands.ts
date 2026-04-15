import { useCallback, useMemo, useState } from "react"

import {
  checkoutBranch,
  commitStaged,
  fetchRemote,
  pullCurrentBranch,
  pushCurrentBranch,
  stageAll,
  stageFile,
  unstageAll,
  unstageFile,
} from "@/git/api"
import type { ChangedFileItem } from "@/git/types"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type UseGitActionCommandsOptions = {
  currentBranch: string
  files: ChangedFileItem[]
  refreshBranches: (signal?: AbortSignal) => Promise<unknown>
  refreshChangedFiles: (signal?: AbortSignal) => Promise<unknown>
}

export function useGitActionCommands({
  currentBranch,
  files,
  refreshBranches,
  refreshChangedFiles,
}: UseGitActionCommandsOptions) {
  const [stagePendingPaths, setStagePendingPaths] = useState<string[]>([])
  const [isBulkStagePending, setIsBulkStagePending] = useState(false)
  const [commitMessage, setCommitMessage] = useState("")
  const [isCommitPending, setIsCommitPending] = useState(false)
  const [isPushPending, setIsPushPending] = useState(false)
  const [isFetchPending, setIsFetchPending] = useState(false)
  const [isPullPending, setIsPullPending] = useState(false)
  const [isCheckoutPending, setIsCheckoutPending] = useState(false)

  const handleToggleStage = useCallback(
    async (file: ChangedFileItem) => {
      setStagePendingPaths((current) => [...current, file.path])

      try {
        if (file.hasStagedChanges) {
          await unstageFile(file)
        } else {
          await stageFile(file)
        }

        await refreshChangedFiles()
      } catch (error) {
        toast.error("Couldn’t stage file.", {
          description: getToastErrorDescription(error, `Unable to update ${file.displayPath}.`),
        })
      } finally {
        setStagePendingPaths((current) => current.filter((path) => path !== file.path))
      }
    },
    [refreshChangedFiles]
  )

  const handleBulkStage = useCallback(
    async (nextFiles: ChangedFileItem[], mode: "stage" | "unstage") => {
      if (nextFiles.length === 0) {
        return
      }

      const targetPaths = nextFiles.map((file) => file.path)
      setIsBulkStagePending(true)
      setStagePendingPaths((current) => [...new Set([...current, ...targetPaths])])

      try {
        if (mode === "unstage") {
          await unstageAll()
        } else {
          await stageAll()
        }

        await refreshChangedFiles()
      } catch (error) {
        toast.error(`Couldn’t ${mode} files.`, {
          description: getToastErrorDescription(
            error,
            mode === "unstage"
              ? "Unable to update the staged files."
              : "Unable to stage the changed files."
          ),
        })
      } finally {
        setStagePendingPaths((current) => current.filter((path) => !targetPaths.includes(path)))
        setIsBulkStagePending(false)
      }
    },
    [refreshChangedFiles]
  )

  const handleStageAll = useCallback(() => {
    void handleBulkStage(
      files.filter((file) => file.hasUnstagedChanges),
      "stage"
    )
  }, [files, handleBulkStage])

  const handleUnstageAll = useCallback(() => {
    void handleBulkStage(
      files.filter((file) => file.hasStagedChanges),
      "unstage"
    )
  }, [files, handleBulkStage])

  const handleCommit = useCallback(async () => {
    setIsCommitPending(true)
    const commitToastId = toast.warning("Creating commit...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      const result = await commitStaged(commitMessage)
      setCommitMessage("")
      toast.success(`Created commit ${result.commit.slice(0, 7)}.`, {
        id: commitToastId,
      })
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Commit failed.", {
        id: commitToastId,
        description: getToastErrorDescription(error, "Unable to create the commit."),
      })
    } finally {
      setIsCommitPending(false)
    }
  }, [commitMessage, refreshBranches, refreshChangedFiles])

  const handlePush = useCallback(async () => {
    setIsPushPending(true)
    const pushToastId = toast.warning("Pushing branch...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      const result = await pushCurrentBranch()
      toast.success(
        result.createdUpstream
          ? `Created upstream ${result.remoteRef} and pushed.`
          : `Pushed ${result.remoteRef}.`,
        {
          id: pushToastId,
        }
      )
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Push failed.", {
        id: pushToastId,
        description: getToastErrorDescription(error, "Unable to push the current branch."),
      })
    } finally {
      setIsPushPending(false)
    }
  }, [refreshBranches, refreshChangedFiles])

  const handleFetch = useCallback(async () => {
    setIsFetchPending(true)
    const fetchToastId = toast.warning("Fetching remote...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      await fetchRemote()
      toast.success("Fetched remote updates.", {
        id: fetchToastId,
      })
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Fetch failed.", {
        id: fetchToastId,
        description: getToastErrorDescription(error, "Unable to fetch from the remote."),
      })
    } finally {
      setIsFetchPending(false)
    }
  }, [refreshBranches, refreshChangedFiles])

  const handlePull = useCallback(async () => {
    setIsPullPending(true)
    const pullToastId = toast.warning("Pulling latest changes...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      await pullCurrentBranch()
      toast.success("Pulled latest changes.", {
        id: pullToastId,
      })
      await Promise.all([refreshChangedFiles(), refreshBranches()])
    } catch (error) {
      toast.error("Pull failed.", {
        id: pullToastId,
        description: getToastErrorDescription(error, "Unable to pull from the remote."),
      })
    } finally {
      setIsPullPending(false)
    }
  }, [refreshBranches, refreshChangedFiles])

  const handleCheckoutBranch = useCallback(
    async (nextBranch: string) => {
      if (!nextBranch || nextBranch === currentBranch) {
        return
      }

      if (files.length > 0) {
        toast.error("Couldn’t switch branch.", {
          description: "You have unsaved changes.",
        })
        return
      }

      setIsCheckoutPending(true)
      const checkoutToastId = toast.warning(`Switching to ${nextBranch}...`, {
        duration: Infinity,
        dismissible: false,
      })

      try {
        await checkoutBranch(nextBranch)
        toast.success(`Switched to ${nextBranch}.`, {
          id: checkoutToastId,
        })
        setCommitMessage("")
        await Promise.all([refreshChangedFiles(), refreshBranches()])
      } catch (error) {
        toast.error("Branch switch failed.", {
          id: checkoutToastId,
          description: getToastErrorDescription(error, "Unable to switch branches."),
        })
      } finally {
        setIsCheckoutPending(false)
      }
    },
    [currentBranch, files.length, refreshBranches, refreshChangedFiles]
  )

  return useMemo(
    () => ({
      commitMessage,
      handleCheckoutBranch,
      handleCommit,
      handleFetch,
      handlePull,
      handlePush,
      handleStageAll,
      handleToggleStage,
      handleUnstageAll,
      isCheckoutPending,
      isBulkStagePending,
      isCommitPending,
      isFetchPending,
      isPullPending,
      isPushPending,
      setCommitMessage,
      stagePendingPaths,
    }),
    [
      commitMessage,
      handleCheckoutBranch,
      handleCommit,
      handleFetch,
      handlePull,
      handlePush,
      handleStageAll,
      handleToggleStage,
      handleUnstageAll,
      isCheckoutPending,
      isBulkStagePending,
      isCommitPending,
      isFetchPending,
      isPullPending,
      isPushPending,
      stagePendingPaths,
    ]
  )
}
