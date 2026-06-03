import type { LucideIcon } from "lucide-react"

import type { ChangedFileItem, FileDiffResult } from "@/git/types"

export type ChangeSetSource =
  | { kind: "working-tree" }
  | { kind: "commit"; hash: string }
  | { kind: "pull-request"; id: string }

export type ChangeSetDetailMeta = {
  label: string
  value: string
}

export type ChangeSetDetail = {
  kind: Exclude<ChangeSetSource["kind"], "working-tree">
  icon: LucideIcon
  title: string
  subtitle?: string
  meta: ChangeSetDetailMeta[]
  files: ChangedFileItem[]
}

export type ChangeSetFileDiffLoader = (
  file: Pick<ChangedFileItem, "path" | "previousPath" | "status">,
  signal?: AbortSignal
) => Promise<FileDiffResult>

