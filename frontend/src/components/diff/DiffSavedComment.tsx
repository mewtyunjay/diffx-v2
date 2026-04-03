type DiffSavedCommentProps = {
  comment: string
  onOpen: () => void
}

export function DiffSavedComment({ comment, onOpen }: DiffSavedCommentProps) {
  return (
    <div className="diff-annotation-wrap">
      <button
        type="button"
        className="diff-annotation-surface diff-annotation-surface-button"
        aria-label="Edit annotation"
        onClick={onOpen}
      >
        <p className="diff-annotation-body whitespace-pre-wrap break-words type-meta leading-5 text-foreground">
          {comment}
        </p>
      </button>
    </div>
  )
}
