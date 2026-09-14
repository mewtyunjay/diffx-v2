import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { DiffPlaceholder } from "@/components/diff/DiffPlaceholder"
import type { PreparedFileDiffResult } from "@/diffs/create"

type PreviewKind = "image" | "markdown"

export function getFilePreviewKind(path: string): PreviewKind | null {
  const extension = path.toLowerCase().split(".").pop()

  if (extension === "md" || extension === "markdown") return "markdown"
  if (extension === "svg" || extension === "png" || extension === "jpg" || extension === "jpeg") {
    return "image"
  }

  return null
}

export function canPreviewFile(path: string) {
  return getFilePreviewKind(path) != null
}

function ImagePreview({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <DiffPlaceholder>Image preview is unavailable.</DiffPlaceholder>
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <img
        src={src}
        alt={name}
        className="block max-h-[calc(100vh-10rem)] max-w-full rounded-md border border-border/60 bg-white object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function RenderedFilePane({ diff }: { diff: PreparedFileDiffResult }) {
  const kind = getFilePreviewKind(diff.path)

  if (diff.status === "deleted") {
    return <DiffPlaceholder>This file was deleted, so there is no final file to preview.</DiffPlaceholder>
  }

  const version = diff.after

  if (kind === "markdown") {
    if (diff.tooLarge) {
      return <DiffPlaceholder>This Markdown file is too large to render.</DiffPlaceholder>
    }

    return (
      <div className="min-h-full bg-background px-6 py-8">
        <article className="markdown-body mx-auto max-w-4xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{version.contents}</ReactMarkdown>
        </article>
      </div>
    )
  }

  if (kind === "image") {
    const params = new URLSearchParams({
      path: version.name,
      v: version.cacheKey,
    })

    const src = `/api/file-preview?${params.toString()}`
    return <ImagePreview key={src} name={version.name} src={src} />
  }

  return <DiffPlaceholder>No rendered view is available for this file.</DiffPlaceholder>
}
