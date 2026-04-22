import type { ChangedFileItem } from "@/git/types"
import { FileTreeFileIcon } from "@/components/file-tree/file-icon"
import { fileStatusIndicatorClassNames } from "@/components/file-tree/status-indicator"
import { cn } from "@/lib/utils"
import type { PreparedFileDiffResult } from "@/diffs/create"

type DiffFileHeaderProps = {
  file: ChangedFileItem
  diff: PreparedFileDiffResult | null
  isDiffLoading: boolean
  scopePath: string
  conflictProgressLabel?: string | null
}

function getChangeCounts(diff: PreparedFileDiffResult | null) {
  if (!diff?.parsedDiff) {
    return null
  }

  let additions = 0
  let deletions = 0

  for (const hunk of diff.parsedDiff.hunks) {
    additions += hunk.additionLines
    deletions += hunk.deletionLines
  }

  return { additions, deletions }
}

function normalizeScopePath(scopePath: string) {
  const normalized = scopePath.replaceAll("\\", "/").replace(/^\.\/+/, "")
  if (!normalized || normalized === ".") {
    return "."
  }

  return normalized.replace(/\/+$/, "")
}

function toScopedDisplayPath(path: string, scopePath: string) {
  const normalizedPath = path.replaceAll("\\", "/").replace(/^\.\/+/, "")
  const normalizedScope = normalizeScopePath(scopePath)
  if (normalizedScope === ".") {
    return normalizedPath
  }

  if (normalizedPath === normalizedScope) {
    return "."
  }

  if (normalizedPath.startsWith(`${normalizedScope}/`)) {
    return normalizedPath.slice(normalizedScope.length + 1)
  }

  return normalizedPath
}

export function DiffFileHeader({
  file,
  diff,
  isDiffLoading,
  scopePath,
  conflictProgressLabel,
}: DiffFileHeaderProps) {
  const previousPath = file.previousPath ?? null
  const hasRename = previousPath != null && previousPath !== file.path
  const previousDisplayPath = hasRename ? toScopedDisplayPath(previousPath, scopePath) : null
  const counts = isDiffLoading ? null : getChangeCounts(diff)

  return (
    <div className="border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex items-center gap-2.5">
            <FileTreeFileIcon path={file.path} language={file.language} />
            {hasRename && previousDisplayPath ? (
              <div className="min-w-0 flex flex-1 items-center gap-1.5">
                <span
                  className="min-w-0 flex-1 truncate type-meta text-muted-foreground/80"
                  title={previousDisplayPath}
                >
                  {previousDisplayPath}
                </span>
                <span aria-hidden="true" className="type-meta text-muted-foreground/70">
                  →
                </span>
                <span className="min-w-0 flex-1 truncate type-meta font-medium text-foreground" title={file.displayPath}>
                  {file.displayPath}
                </span>
                <span
                  aria-label={`${file.status} file`}
                  title={file.status}
                  className={cn("size-2.5 shrink-0 rounded-full", fileStatusIndicatorClassNames[file.status])}
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 truncate type-meta font-medium text-foreground" title={file.displayPath}>
                  {file.displayPath}
                </p>
                {conflictProgressLabel ? (
                  <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 type-meta tabular-nums text-muted-foreground">
                    {conflictProgressLabel}
                  </span>
                ) : null}
                <span
                  aria-label={`${file.status} file`}
                  title={file.status}
                  className={cn("size-2.5 shrink-0 rounded-full", fileStatusIndicatorClassNames[file.status])}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap type-meta type-data font-medium">
          {counts ? <span className="diff-toolbar-additions">{`+${counts.additions}`}</span> : null}
          {counts ? <span className="diff-toolbar-deletions">{`-${counts.deletions}`}</span> : null}
        </div>
      </div>
    </div>
  )
}
