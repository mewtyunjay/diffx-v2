import { Button } from "@/components/ui/button"

type DiffHunkActionsProps = {
  hunkIndex: number
  onAction: (hunkIndex: number, action: "accept" | "reject") => void
}

export function DiffHunkActions({ hunkIndex, onAction }: DiffHunkActionsProps) {
  return (
    <div className="diff-hunk-actions-anchor">
      <div className="diff-hunk-actions">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-sm text-[var(--diff-hunk-reject)]hover:bg-[var(--diff-hunk-reject)]/15 hover:text-[var(--diff-hunk-reject)]"
          onClick={() => onAction(hunkIndex, "reject")}
        >
          Undo
          <kbd className="ml-1 text-[0.6875rem] leading-none opacity-50">⌘N</kbd>
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-sm bg-[var(--diff-hunk-accept)]/15 text-[var(--diff-hunk-accept)]hover:bg-[var(--diff-hunk-accept)]/25"
          onClick={() => onAction(hunkIndex, "accept")}
        >
          Keep
          <kbd className="ml-1 text-[0.6875rem] leading-none opacity-50">⌘Y</kbd>
        </Button>
      </div>
    </div>
  )
}
