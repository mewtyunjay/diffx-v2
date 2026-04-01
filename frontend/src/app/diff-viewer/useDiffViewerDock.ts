import { useState } from "react"

import type { DockSelectionItem, DockState } from "@/components/diff/BottomDockSurface"
import type { DiffViewerDockProgressItem } from "@/components/diff/DiffViewerDockProgress"

const INITIAL_PROGRESS_ITEMS: DiffViewerDockProgressItem[] = [
  {
    id: "scan-scope",
    label: "Confirm which files need closer review",
    description: "Use this area for progress, reminders, or staging notes tied to the active diff.",
    done: true,
  },
  {
    id: "stage-logic",
    label: "Check the logic flow in the current change",
    description: "Keep a running checklist while you inspect the patch.",
    done: false,
  },
  {
    id: "open-questions",
    label: "Capture anything worth asking before you stage",
    description: "The compact chat stays available while the checklist sits above it.",
    done: false,
  },
]

const QUIZ_OPTIONS: DockSelectionItem[] = [
  {
    id: "answer-a",
    label: "Summarize the changed lines before asking for follow-up help.",
    description: "Useful when you want the dock to help explain why a hunk changed.",
    meta: "best fit",
  },
  {
    id: "answer-b",
    label: "Switch files immediately and let the dock keep its current context.",
    description: "The dock persists while the selected diff changes underneath it.",
    meta: "supported",
  },
  {
    id: "answer-c",
    label: "Collapse the dock whenever you want a clean view of the diff.",
    description: "Header clicks collapse the dock and restore the last open state on reopen.",
    meta: "supported",
  },
]

function getFileLabel(filePath: string | null) {
  if (!filePath) {
    return "current diff"
  }

  const segments = filePath.split("/")
  return segments[segments.length - 1] ?? filePath
}

export function useDiffViewerDock(selectedFilePath: string | null) {
  const [state, setState] = useState<DockState>("compact")
  const [lastOpenState, setLastOpenState] = useState<Exclude<DockState, "collapsed">>("compact")
  const [mode, setMode] = useState<"chat" | "quiz">("chat")
  const [prompt, setPrompt] = useState("")
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [progressItems, setProgressItems] = useState(INITIAL_PROGRESS_ITEMS)

  const completedCount = progressItems.filter((item) => item.done).length
  const fileLabel = getFileLabel(selectedFilePath)

  const updateState = (nextState: DockState) => {
    setState(nextState)
    if (nextState !== "collapsed") {
      setLastOpenState(nextState)
    }
  }

  const handleHeaderClick = () => {
    if (state === "collapsed") {
      updateState(lastOpenState)
      return
    }

    updateState("collapsed")
  }

  const handleOpenQuiz = () => {
    setMode("quiz")
    updateState("expanded")
  }

  const handleReturnToChat = () => {
    setMode("chat")
    updateState("compact")
  }

  const toggleProgressItem = (itemId: string) => {
    setProgressItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done,
            }
          : item
      )
    )
  }

  const title = mode === "chat" ? "Ask anything about this diff" : "Quick checkpoint"
  const summary =
    mode === "chat"
      ? `${completedCount} of ${progressItems.length} checkpoints done · ${fileLabel}`
      : `${selectedOptionId ? "1 answer selected" : "Choose one answer"} · ${fileLabel}`

  return {
    state,
    mode,
    title,
    summary,
    prompt,
    progressItems,
    question: "Which behavior matters most when this dock sits over the main diff viewer?",
    supportingText:
      "This mode replaces the composer with a focused question and keyboard-selectable options.",
    options: QUIZ_OPTIONS,
    selectedOptionId,
    onHeaderClick: handleHeaderClick,
    onPromptChange: setPrompt,
    onOpenQuiz: handleOpenQuiz,
    onReturnToChat: handleReturnToChat,
    onSelectOption: setSelectedOptionId,
    onToggleProgressItem: toggleProgressItem,
  }
}
