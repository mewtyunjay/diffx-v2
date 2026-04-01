type DiffSavedCommentProps = {
  comment: string
}

export function DiffSavedComment({ comment }: DiffSavedCommentProps) {
  return (
    <div className="px-2 py-2">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-lg backdrop-blur-sm">
        <div className="px-3 py-3">
          <p className="whitespace-pre-wrap text-sm text-foreground">{comment}</p>
        </div>
        <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          Click <span className="font-medium text-foreground">+</span> on this line to edit.
        </div>
      </div>
    </div>
  )
}
