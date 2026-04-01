import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

type DiffCommentDraftProps = {
  focusKey: string
  value: string
  canSave: boolean
  isEditingExisting: boolean
  onChange: (value: string) => void
  onSave: () => void
  onEscape: () => void
}

export function DiffCommentDraft({
  focusKey,
  value,
  canSave,
  isEditingExisting,
  onChange,
  onSave,
  onEscape,
}: DiffCommentDraftProps) {
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
              return
            }

            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              if (canSave) {
                onSave()
              }
            }
          }}
          placeholder="Ask Codex to fix or explain this change..."
          className="min-h-24 w-full resize-y border-0 bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {isEditingExisting
              ? "Save updates this annotation. Clear the text and save to remove it."
              : "Save stores this annotation in the current session. Cmd/Ctrl+Enter also saves."}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onEscape}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
