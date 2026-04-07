import * as React from "react"
import { Check, ChevronDown, GitBranch } from "lucide-react"

import type { BranchOption } from "@/app/changed-files/api"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type BranchPickerProps = {
  branches: BranchOption[]
  currentRef: string
  selectedBaseRef: string
  onSelectBaseRef: (baseRef: string) => void
  disabled?: boolean
  variant?: "header" | "sidebar"
}

type BranchGroup = {
  heading: string
  items: BranchOption[]
}

type BranchShortcut = {
  key: string
  value: string
  label: string
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function filterBranches(branches: BranchOption[], query: string) {
  if (!query) {
    return branches
  }

  return branches.filter((branch) => normalizeQuery(branch.name).includes(query))
}

export function BranchPicker({
  branches,
  currentRef,
  selectedBaseRef,
  onSelectBaseRef,
  disabled = false,
  variant = "sidebar",
}: BranchPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const normalizedQuery = normalizeQuery(query)
  const headLabel = currentRef || "HEAD"

  const shortcutItems = React.useMemo<BranchShortcut[]>(() => {
    const items: BranchShortcut[] = [
      {
        key: "current-branch",
        value: "HEAD",
        label: `${headLabel} (current)`,
      },
    ]

    const remoteCurrentBranch = branches.find(
      (branch) => branch.kind === "remote" && branch.name === `origin/${headLabel}`
    )

    if (remoteCurrentBranch) {
      items.push({
        key: remoteCurrentBranch.name,
        value: remoteCurrentBranch.name,
        label: remoteCurrentBranch.name,
      })
    }

    return items.filter((item) => normalizeQuery(item.label).includes(normalizedQuery))
  }, [branches, headLabel, normalizedQuery])

  const branchGroups = React.useMemo<BranchGroup[]>(() => {
    const localBranches = filterBranches(
      branches.filter((branch) => branch.kind === "local" && !branch.isCurrent),
      normalizedQuery
    )
    const remoteBranches = filterBranches(
      branches.filter((branch) => branch.kind === "remote" && branch.name !== `origin/${headLabel}`),
      normalizedQuery
    )

    return [
      { heading: "Local branches", items: localBranches },
      { heading: "Remote branches", items: remoteBranches },
    ].filter((group) => group.items.length > 0)
  }, [branches, headLabel, normalizedQuery])

  React.useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  const handleSelect = React.useCallback(
    (nextBaseRef: string) => {
      onSelectBaseRef(nextBaseRef)
      setOpen(false)
    },
    [onSelectBaseRef]
  )

  const selectedLabel = selectedBaseRef === "HEAD" ? headLabel : selectedBaseRef
  const isHeader = variant === "header"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "interactive-soft justify-between gap-2 px-3 text-left shadow-none",
            isHeader
              ? "surface-field-quiet h-8 min-w-0 max-w-56 text-foreground hover:bg-muted/80"
              : "surface-sidebar-field interactive-sidebar h-7 w-full text-sidebar-foreground"
          )}
          disabled={disabled}
          aria-label="Select diff base branch"
        >
          <span className="flex min-w-0 items-center gap-2">
            <GitBranch
              className={cn(
                "size-3.5 shrink-0",
                isHeader ? "text-muted-foreground" : "text-sidebar-foreground/42"
              )}
            />
            <span
              className={cn(
                "min-w-0 truncate type-meta font-medium",
                isHeader ? "text-foreground" : "text-sidebar-foreground"
              )}
            >
              {selectedLabel}
            </span>
          </span>
          <ChevronDown
            data-icon="inline-end"
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              isHeader ? "text-muted-foreground" : "text-sidebar-foreground/42",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className={cn(
          "min-w-[var(--radix-popover-trigger-width)] w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0",
          isHeader
            ? "surface-elevated text-foreground"
            : "surface-sidebar-elevated text-sidebar-foreground"
        )}
      >
        <Command
          shouldFilter={false}
          className="min-h-0 max-h-[min(30rem,calc(100vh-8rem))]"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search branches..."
            autoFocus
            className={cn(
              isHeader
                ? "text-foreground placeholder:text-muted-foreground"
                : "text-sidebar-foreground placeholder:text-sidebar-foreground/45"
            )}
          />
          <CommandList>
            <CommandEmpty>No matching branches.</CommandEmpty>
            {shortcutItems.map((item) => (
              <CommandItem
                key={item.key}
                value={item.label}
                onSelect={() => handleSelect(item.value)}
                className={cn(
                  "justify-between rounded-md px-2.5 py-1.5",
                  isHeader
                    ? "text-foreground data-selected:bg-muted"
                    : "text-sidebar-foreground data-selected:bg-sidebar-accent/55"
                )}
              >
                <BranchOptionRow
                  label={item.label}
                  selected={selectedBaseRef === item.value}
                  variant={variant}
                />
              </CommandItem>
            ))}
            {shortcutItems.length > 0 && branchGroups.length > 0 ? <CommandSeparator /> : null}
            {branchGroups.map((group, index) => (
              <React.Fragment key={group.heading}>
                <CommandGroup heading={group.heading}>
                  {group.items.map((branch) => (
                    <CommandItem
                      key={branch.name}
                      value={branch.name}
                      onSelect={() => handleSelect(branch.name)}
                      className={cn(
                        "justify-between rounded-md px-2.5 py-1.5",
                        isHeader
                          ? "text-foreground data-selected:bg-muted"
                          : "text-sidebar-foreground data-selected:bg-sidebar-accent/55"
                      )}
                    >
                      <BranchOptionRow
                        label={branch.name}
                        selected={selectedBaseRef === branch.name}
                        variant={variant}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
                {index < branchGroups.length - 1 ? <CommandSeparator /> : null}
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type BranchOptionRowProps = {
  label: string
  selected: boolean
  variant: "header" | "sidebar"
}

function BranchOptionRow({ label, selected, variant }: BranchOptionRowProps) {
  const isHeader = variant === "header"

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <GitBranch
          className={cn(
            "size-3.5 shrink-0",
            isHeader ? "text-muted-foreground" : "text-sidebar-foreground/42"
          )}
        />
        <span className={cn("truncate", isHeader ? "text-foreground" : "text-sidebar-foreground")}>
          {label}
        </span>
      </div>
      <Check
        className={cn(
          "size-3.5 shrink-0 opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
          isHeader ? "text-foreground/82" : "text-sidebar-foreground/82",
          selected && "opacity-100"
        )}
      />
    </>
  )
}
