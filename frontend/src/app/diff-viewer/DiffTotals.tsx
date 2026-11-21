import type { ChangedFileItem } from "@/git/types"

export function DiffTotals({ files }: { files: ChangedFileItem[] }) {
  let additions = 0
  let deletions = 0
  for (const { lineChanges } of files) {
    additions += lineChanges?.additions ?? 0
    deletions += lineChanges?.deletions ?? 0
  }

  const net = additions - deletions
  const label = `Visible diff totals: ${additions} additions, ${deletions} deletions, net ${net > 0 ? "+" : ""}${net}`

  return (
    <span
      role="group"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap type-meta type-data font-medium"
    >
      <span aria-hidden="true" className="diff-toolbar-additions">+{additions}</span>
      <span aria-hidden="true" className="diff-toolbar-deletions">−{deletions}</span>
    </span>
  )
}
