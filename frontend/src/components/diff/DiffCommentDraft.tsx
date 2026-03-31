import { useEffect, useRef } from "react"

type DiffCommentDraftProps = {
  focusKey: string
  value: string
  onChange: (value: string) => void
  onEscape: () => void
}

export function DiffCommentDraft({ focusKey, value, onChange, onEscape }: DiffCommentDraftProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.focus()
    const cursorPosition = textarea.value.length
    textarea.setSelectionRange(cursorPosition, cursorPosition)
  }, [focusKey])

  return (
    <div className="px-2 py-2">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-lg backdrop-blur-sm">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onEscape()
            }
          }}
          placeholder="Ask Codex to fix or explain this change..."
          className="min-h-24 w-full resize-y border-0 bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          Draft only for now. Submission is not wired yet.
        </div>
      </div>
    </div>
  )
}
