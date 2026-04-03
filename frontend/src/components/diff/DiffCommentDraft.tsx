import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

type DiffCommentDraftProps = {
  focusKey: string
  value: string
  canSave: boolean
  isEditingExisting: boolean
  onChange: (value: string) => void
  onDelete?: () => void
  onSave: () => void
  onEscape: () => void
}

export function DiffCommentDraft({
  focusKey,
  value,
  canSave,
  isEditingExisting,
  onChange,
  onDelete,
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
    <div className="diff-annotation-wrap">
      <div className="diff-annotation-surface overflow-hidden">
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

            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (canSave) {
                onSave()
              }
            }
          }}
          placeholder="Add annotation..."
          className="diff-annotation-textarea"
        />
        <div className="diff-annotation-actions">
          {isEditingExisting && onDelete ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Button type="button" size="xs" variant="ghost" onClick={onEscape}>
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              title="Save annotation (Enter)"
              onClick={onSave}
              disabled={!canSave}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
