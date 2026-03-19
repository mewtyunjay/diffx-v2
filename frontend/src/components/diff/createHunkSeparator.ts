import type { HunkData } from "@pierre/diffs"

type ExpandDirection = "up" | "down" | "both"

type ExpandableDiffInstance = {
  expandHunk: (hunkIndex: number, direction: ExpandDirection) => void
}

function createExpandButton(
  label: string,
  hunkIndex: number,
  direction: ExpandDirection,
  instance: ExpandableDiffInstance
) {
  const button = document.createElement("button")
  button.type = "button"
  button.className =
    "inline-flex h-7 items-center rounded-md border border-border/70 bg-background/80 px-2.5 text-[11px] font-medium text-foreground transition hover:bg-background"
  button.textContent = label
  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    instance.expandHunk(hunkIndex, direction)
  })

  return button
}

function getHiddenLinesLabel(lines: number) {
  return `${lines} unchanged ${lines === 1 ? "line" : "lines"}`
}

export function createHunkSeparator(hunk: HunkData, instance: ExpandableDiffInstance) {
  const container = document.createElement("div")
  container.className =
    "flex min-h-8 w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"

  const label = document.createElement("span")
  label.className = "min-w-0 truncate"
  label.textContent = getHiddenLinesLabel(hunk.lines)
  container.appendChild(label)

  if (!hunk.expandable) {
    return container
  }

  const actions = document.createElement("div")
  actions.className = "flex shrink-0 items-center gap-2"

  if (!hunk.expandable.chunked) {
    const direction: ExpandDirection = hunk.expandable.up && hunk.expandable.down
      ? "both"
      : hunk.expandable.up
        ? "up"
        : "down"

    actions.appendChild(createExpandButton("Show", hunk.hunkIndex, direction, instance))
  } else {
    if (hunk.expandable.up) {
      actions.appendChild(createExpandButton("Show above", hunk.hunkIndex, "up", instance))
    }

    if (hunk.expandable.down) {
      actions.appendChild(createExpandButton("Show below", hunk.hunkIndex, "down", instance))
    }
  }

  container.appendChild(actions)

  return container
}
