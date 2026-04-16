import { useCallback, useState } from "react"

import { suggestCommitMessage } from "@/app/ai/api"
import { toast } from "@/components/ui/sonner"
import { getToastErrorDescription } from "@/lib/toast-errors"

type UseCommitMessageSuggestionOptions = {
  onApplySuggestion: (message: string) => void
}

export function useCommitMessageSuggestion({
  onApplySuggestion,
}: UseCommitMessageSuggestionOptions) {
  const [isPending, setIsPending] = useState(false)

  const suggest = useCallback(async () => {
    if (isPending) {
      return
    }

    setIsPending(true)
    const toastID = toast.warning("Generating commit message...", {
      duration: Infinity,
      dismissible: false,
    })

    try {
      const response = await suggestCommitMessage()
      onApplySuggestion(response.message)
      toast.success(`Generated with ${response.provider}.`, { id: toastID })
    } catch (error) {
      toast.error("Commit message generation failed.", {
        id: toastID,
        description: getToastErrorDescription(error, "Unable to generate commit message."),
      })
    } finally {
      setIsPending(false)
    }
  }, [isPending, onApplySuggestion])

  return {
    isPending,
    suggest,
  }
}
