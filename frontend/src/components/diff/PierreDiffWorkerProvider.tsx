import { WorkerPoolContextProvider } from "@pierre/diffs/react"
import PierreDiffWorker from "@pierre/diffs/worker/worker.js?worker"
import { useMemo, type ReactNode } from "react"

const DEFAULT_WORKER_LANGS = [
  "text",
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "css",
  "go",
  "md",
  "html",
  "yaml",
] as const

function getWorkerPoolSize() {
  if (typeof navigator === "undefined") {
    return 2
  }

  return Math.max(1, Math.min(4, Math.floor(navigator.hardwareConcurrency / 2) || 2))
}

type PierreDiffWorkerProviderProps = {
  children: ReactNode
}

export function PierreDiffWorkerProvider({ children }: PierreDiffWorkerProviderProps) {
  const poolOptions = useMemo(
    () => ({
      poolSize: getWorkerPoolSize(),
      workerFactory: () => new PierreDiffWorker(),
    }),
    []
  )

  const highlighterOptions = useMemo(
    () => ({
      theme: "gruvbox-dark-hard" as const,
      langs: [...DEFAULT_WORKER_LANGS],
      lineDiffType: "word" as const,
      tokenizeMaxLineLength: 500,
    }),
    []
  )

  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  )
}
