import { ChevronDown, ChevronUp } from "lucide-react"
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export type DockState = "collapsed" | "compact" | "expanded"

export type DockSelectionItem = {
  id: string
  label: string
  description?: string
  meta?: string
  disabled?: boolean
}

type DockSelectionList = {
  ariaLabel?: string
  items: DockSelectionItem[]
  selectedItemId: string | null
  onSelectItem: (itemId: string) => void
}

type BottomDockSurfaceProps = {
  title: string
  summary?: string
  state: DockState
  onHeaderClick: () => void
  compactContent?: ReactNode
  auxiliaryContent?: ReactNode
  expandedIntro?: ReactNode
  expandedFooter?: ReactNode
  selectionList?: DockSelectionList
  className?: string
  style?: CSSProperties
}

function getNextEnabledIndex(items: DockSelectionItem[], startIndex: number, direction: 1 | -1) {
  if (items.length === 0) {
    return -1
  }

  let nextIndex = startIndex

  for (let step = 0; step < items.length; step += 1) {
    nextIndex = (nextIndex + direction + items.length) % items.length
    if (!items[nextIndex]?.disabled) {
      return nextIndex
    }
  }

  return -1
}

export function BottomDockSurface({
  title,
  summary,
  state,
  onHeaderClick,
  compactContent,
  auxiliaryContent,
  expandedIntro,
  expandedFooter,
  selectionList,
  className,
  style,
}: BottomDockSurfaceProps) {
  const selectionListId = useId()
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const firstEnabledIndex = selectionList?.items.findIndex((item) => !item.disabled) ?? -1
  const selectedIndex = selectionList?.items.findIndex(
    (item) => item.id === selectionList.selectedItemId && !item.disabled
  )
  const [focusedIndex, setFocusedIndex] = useState(0)
  const activeFocusedIndex =
    selectionList && state === "expanded"
      ? focusedIndex >= 0 && !selectionList.items[focusedIndex]?.disabled
        ? focusedIndex
        : selectedIndex != null && selectedIndex >= 0
          ? selectedIndex
          : firstEnabledIndex
      : focusedIndex

  const focusSelectionIndex = (index: number) => {
    const target = itemRefs.current[index]
    if (!target) {
      return
    }

    target.focus()
    setFocusedIndex(index)
  }

  const handleSelectionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!selectionList) {
      return
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault()
      const nextIndex = getNextEnabledIndex(selectionList.items, index, 1)
      if (nextIndex >= 0) {
        focusSelectionIndex(nextIndex)
      }
      return
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault()
      const nextIndex = getNextEnabledIndex(selectionList.items, index, -1)
      if (nextIndex >= 0) {
        focusSelectionIndex(nextIndex)
      }
      return
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      const item = selectionList.items[index]
      if (!item || item.disabled) {
        return
      }

      selectionList.onSelectItem(item.id)
    }
  }

  const isCollapsed = state === "collapsed"
  const isExpanded = state === "expanded"

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <section
        style={style}
        className={cn(
          "pointer-events-auto w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-border/70 bg-[color-mix(in_oklab,var(--popover)_92%,black)] shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl",
          className
        )}
      >
        <button
          type="button"
          onClick={onHeaderClick}
          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate type-title text-foreground">{title}</p>
            {summary ? (
              <p className="mt-1 truncate type-meta text-muted-foreground">{summary}</p>
            ) : null}
          </div>

          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground">
            {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </span>
        </button>

        {!isCollapsed ? (
          <div className="border-t border-border/60 px-4 pb-4 pt-3">
            {isExpanded ? (
              <div className="space-y-4">
                {expandedIntro ? <div>{expandedIntro}</div> : null}

                {selectionList ? (
                  <div
                    role="radiogroup"
                    aria-label={selectionList.ariaLabel ?? title}
                    aria-labelledby={selectionListId}
                    className="space-y-2"
                  >
                    <span id={selectionListId} className="sr-only">
                      {selectionList.ariaLabel ?? title}
                    </span>

                    {selectionList.items.map((item, index) => {
                      const isSelected = item.id === selectionList.selectedItemId
                      const isFocusable = index === activeFocusedIndex

                      return (
                        <button
                          key={item.id}
                          ref={(node) => {
                            itemRefs.current[index] = node
                          }}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-disabled={item.disabled || undefined}
                          disabled={item.disabled}
                          tabIndex={isFocusable ? 0 : -1}
                          onClick={() => selectionList.onSelectItem(item.id)}
                          onFocus={() => setFocusedIndex(index)}
                          onKeyDown={(event) => handleSelectionKeyDown(event, index)}
                          className={cn(
                            "w-full rounded-[1.1rem] border px-3 py-3 text-left transition outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                            isSelected
                              ? "border-primary/45 bg-primary/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                              : "border-border/60 bg-background/35 hover:bg-background/55",
                            item.disabled && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition",
                                isSelected
                                  ? "border-primary bg-primary/25 text-primary"
                                  : "border-border/70 bg-background/50 text-transparent"
                              )}
                            >
                              <span className="size-2 rounded-full bg-current" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="type-meta font-medium text-foreground">{item.label}</p>
                                {item.meta ? (
                                  <span className="shrink-0 type-overline text-muted-foreground">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </div>

                              {item.description ? (
                                <p className="measure-readable mt-1 type-meta text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {expandedFooter ? (
                  <div className="border-t border-border/50 pt-3">{expandedFooter}</div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {auxiliaryContent ? (
                  <div className="rounded-[1.2rem] border border-border/60 bg-background/28 px-3 py-3">
                    {auxiliaryContent}
                  </div>
                ) : null}

                {compactContent}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
