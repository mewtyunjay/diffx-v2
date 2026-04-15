import type { ChangedFileStatus } from "@/git/types"

export const fileStatusIndicatorClassNames: Record<ChangedFileStatus, string> = {
  modified: "bg-amber-400",
  added: "bg-emerald-400",
  deleted: "bg-rose-400",
  renamed: "bg-sky-400",
  conflicted: "bg-violet-400",
}
