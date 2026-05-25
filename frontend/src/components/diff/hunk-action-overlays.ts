import { renderHunkPatch } from "@/diff-viewer/annotations"
import type { PreparedFileDiffResult } from "@/diffs/create"
import type { HunkActionInput } from "@/git/types"

export type RenderablePreparedDiff = PreparedFileDiffResult & {
  parsedDiff: NonNullable<PreparedFileDiffResult["parsedDiff"]>
}

type HunkActionOverlayViewMode = "split" | "unified"

const ACTION_LAYER_ATTRIBUTE = "data-diffx-hunk-action-layer"
const ACTION_OVERLAY_ATTRIBUTE = "data-diffx-hunk-action-overlay"

function createHunkActionInputForIndex(
  diff: RenderablePreparedDiff,
  hunkIndex: number
): HunkActionInput | null {
  if (hunkIndex < 0) {
    return null
  }

  const hunk = diff.parsedDiff.hunks[hunkIndex]
  if (!hunk) {
    return null
  }

  return {
    path: diff.path,
    previousPath: diff.previousPath,
    status: diff.status,
    hunkIndex,
    hunkPatch: renderHunkPatch(hunk, {
      additions: diff.parsedDiff.additionLines,
      deletions: diff.parsedDiff.deletionLines,
    }),
  }
}

function normalizeHunkPatchForStagedMatch(patch: string) {
  const lines = patch.split("\n")
  if (lines[0]?.startsWith("@@")) {
    lines[0] = lines[0].replace(/ \+\d+(?:,\d+)? /, " +_ ")
  }

  return lines.join("\n")
}

function createStagedHunkPatchSet(diff: RenderablePreparedDiff) {
  const stagedDiff = diff.stagedParsedDiff
  if (!stagedDiff) {
    return new Set<string>()
  }

  return new Set(
    stagedDiff.hunks.map((hunk) =>
      normalizeHunkPatchForStagedMatch(
        renderHunkPatch(hunk, {
          additions: stagedDiff.additionLines,
          deletions: stagedDiff.deletionLines,
        })
      )
    )
  )
}

function assignStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles)
}

function createActionButton({
  label,
  ariaLabel,
  variant,
  disabled,
  onClick,
}: {
  label: string
  ariaLabel: string
  variant: "accept" | "reject"
  disabled: boolean
  onClick: () => void
}) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = `diff-hunk-overlay-button diff-hunk-overlay-button-${variant}`
  button.textContent = label
  button.disabled = disabled
  button.setAttribute("aria-label", ariaLabel)
  assignStyles(button, {
    appearance: "none",
    border: "0",
    borderRadius: "6px",
    color: variant === "accept" ? "var(--background)" : "var(--foreground)",
    cursor: disabled ? "not-allowed" : "pointer",
    font: "inherit",
    lineHeight: "1",
    minHeight: "1.75rem",
    opacity: disabled ? "0.55" : "1",
    padding: "0 0.625rem",
    whiteSpace: "nowrap",
    background:
      variant === "accept"
        ? "color-mix(in oklab, var(--diff-add) 82%, var(--foreground))"
        : "color-mix(in oklab, var(--foreground) 10%, transparent)",
  })
  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!disabled) {
      onClick()
    }
  })

  return button
}

function getTargetCodeColumn(
  shadowRoot: ShadowRoot,
  diff: RenderablePreparedDiff,
  viewMode: HunkActionOverlayViewMode
) {
  if (viewMode === "unified") {
    return shadowRoot.querySelector<HTMLElement>("[data-unified]")
  }

  if (diff.parsedDiff.type === "deleted") {
    return shadowRoot.querySelector<HTMLElement>("[data-deletions]")
  }

  return shadowRoot.querySelector<HTMLElement>("[data-additions]")
}

function parseRenderedLineIndex(value: string | undefined, viewMode: HunkActionOverlayViewMode) {
  if (!value) {
    return null
  }

  const [unifiedIndexText, splitIndexText] = value.split(",")
  const indexText = viewMode === "unified" ? unifiedIndexText : (splitIndexText ?? unifiedIndexText)
  const index = Number(indexText)
  return Number.isFinite(index) ? index : null
}

function isChangedLine(
  element: HTMLElement,
  diff: RenderablePreparedDiff,
  viewMode: HunkActionOverlayViewMode
) {
  const lineType = element.dataset.lineType
  if (viewMode === "unified") {
    return lineType === "change-addition" || lineType === "change-deletion"
  }

  return diff.parsedDiff.type === "deleted"
    ? lineType === "change-deletion"
    : lineType === "change-addition"
}

function getLineElementsForHunk({
  contentColumn,
  diff,
  viewMode,
  hunkIndex,
}: {
  contentColumn: HTMLElement
  diff: RenderablePreparedDiff
  viewMode: HunkActionOverlayViewMode
  hunkIndex: number
}) {
  const hunk = diff.parsedDiff.hunks[hunkIndex]
  if (!hunk) {
    return []
  }

  const start = viewMode === "unified" ? hunk.unifiedLineStart : hunk.splitLineStart
  const count = viewMode === "unified" ? hunk.unifiedLineCount : hunk.splitLineCount
  const end = start + count

  return Array.from(contentColumn.querySelectorAll<HTMLElement>("[data-line]")).filter((element) => {
    const index = parseRenderedLineIndex(element.dataset.lineIndex, viewMode)
    return index != null && index >= start && index < end
  })
}

function getAnchorRect(elements: HTMLElement[], preRect: DOMRect) {
  const visibleRects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)

  if (visibleRects.length === 0) {
    return null
  }

  const top = Math.min(...visibleRects.map((rect) => rect.top)) - preRect.top
  const bottom = Math.max(...visibleRects.map((rect) => rect.bottom)) - preRect.top
  return { top, bottom }
}

function getOrCreateOverlayLayer(pre: HTMLPreElement) {
  let layer = pre.querySelector<HTMLElement>(`[${ACTION_LAYER_ATTRIBUTE}]`)
  if (layer) {
    return layer
  }

  layer = document.createElement("div")
  layer.setAttribute(ACTION_LAYER_ATTRIBUTE, "")
  assignStyles(layer, {
    inset: "0",
    pointerEvents: "none",
    position: "absolute",
    zIndex: "8",
  })
  pre.append(layer)
  return layer
}

function createOverlay({
  top,
  disabled,
  onAccept,
  onReject,
}: {
  top: number
  disabled: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const overlay = document.createElement("div")
  overlay.className = "diff-hunk-action-overlay"
  overlay.setAttribute(ACTION_OVERLAY_ATTRIBUTE, "")
  assignStyles(overlay, {
    alignItems: "center",
    background: "color-mix(in oklab, var(--popover) 88%, transparent)",
    border: "1px solid color-mix(in oklab, var(--border) 85%, transparent)",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgb(0 0 0 / 0.22)",
    color: "var(--foreground)",
    display: "flex",
    fontFamily: "var(--font-sans)",
    fontSize: "0.8125rem",
    gap: "0.375rem",
    lineHeight: "1",
    padding: "0.25rem",
    pointerEvents: "auto",
    position: "absolute",
    right: "1rem",
    top: `${Math.max(top, 0)}px`,
    whiteSpace: "nowrap",
  })

  overlay.append(
    createActionButton({
      label: "Reject (revert)",
      ariaLabel: "Reject and revert hunk",
      variant: "reject",
      disabled,
      onClick: onReject,
    }),
    createActionButton({
      label: "Accept",
      ariaLabel: "Accept hunk",
      variant: "accept",
      disabled,
      onClick: onAccept,
    })
  )

  return overlay
}

function removeHunkActionLayer(node: HTMLElement) {
  node.shadowRoot?.querySelector(`[${ACTION_LAYER_ATTRIBUTE}]`)?.remove()
}

export function syncHunkActionOverlays({
  node,
  diff,
  viewMode,
  enableHunkActions,
  hunkActionPendingKey,
  onAcceptHunk,
  onRejectHunk,
}: {
  node: HTMLElement
  diff: RenderablePreparedDiff
  viewMode: HunkActionOverlayViewMode
  enableHunkActions: boolean
  hunkActionPendingKey: string | null
  onAcceptHunk: (input: HunkActionInput) => void
  onRejectHunk: (input: HunkActionInput) => void
}) {
  const shadowRoot = node.shadowRoot
  const pre = shadowRoot?.querySelector<HTMLPreElement>("pre")
  if (!enableHunkActions || !shadowRoot || !pre) {
    removeHunkActionLayer(node)
    return
  }

  const targetCodeColumn = getTargetCodeColumn(shadowRoot, diff, viewMode)
  const contentColumn = targetCodeColumn?.querySelector<HTMLElement>("[data-content]")
  if (!contentColumn) {
    removeHunkActionLayer(node)
    return
  }

  if (getComputedStyle(pre).position === "static") {
    pre.style.position = "relative"
  }

  const preRect = pre.getBoundingClientRect()
  const layer = getOrCreateOverlayLayer(pre)
  layer.replaceChildren()
  const stagedHunkPatches = createStagedHunkPatchSet(diff)

  diff.parsedDiff.hunks.forEach((_, hunkIndex) => {
    const actionInput = createHunkActionInputForIndex(diff, hunkIndex)
    if (!actionInput) {
      return
    }
    if (stagedHunkPatches.has(normalizeHunkPatchForStagedMatch(actionInput.hunkPatch))) {
      return
    }

    const hunkLines = getLineElementsForHunk({
      contentColumn,
      diff,
      viewMode,
      hunkIndex,
    })
    const changedLines = hunkLines.filter((element) => isChangedLine(element, diff, viewMode))
    const anchorRect = getAnchorRect(changedLines.length > 0 ? changedLines : hunkLines, preRect)
    if (!anchorRect) {
      return
    }

    const overlayTop = Math.min(
      Math.max(anchorRect.bottom + 6, anchorRect.top + 4),
      Math.max(pre.scrollHeight - 36, 0)
    )
    layer.append(
      createOverlay({
        top: overlayTop,
        disabled: hunkActionPendingKey != null,
        onAccept: () => onAcceptHunk(actionInput),
        onReject: () => onRejectHunk(actionInput),
      })
    )
  })
}
