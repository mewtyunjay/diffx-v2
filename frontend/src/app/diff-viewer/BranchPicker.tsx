import * as React from "react"
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiGitBranchLine,
} from "@remixicon/react"

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
  selectedBaseRef: string
  onSelectBaseRef: (baseRef: string) => void
  disabled?: boolean
}

type BranchGroup = {
  heading: string
  items: BranchOption[]
}

function getTriggerDetail(selectedBaseRef: string, branches: BranchOption[]) {
  if (selectedBaseRef === "HEAD") {
    return "Working tree baseline"
  }

  const selectedBranch = branches.find((branch) => branch.name === selectedBaseRef)

  if (!selectedBranch) {
    return "Base branch"
  }

  if (selectedBranch.isCurrent) {
    return "Current branch"
  }

  return selectedBranch.kind === "remote" ? "Remote branch" : "Local branch"
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
  selectedBaseRef,
  onSelectBaseRef,
  disabled = false,
}: BranchPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const normalizedQuery = normalizeQuery(query)
  const triggerDetail = getTriggerDetail(selectedBaseRef, branches)

  const branchGroups = React.useMemo<BranchGroup[]>(() => {
    const localBranches = filterBranches(
      branches.filter((branch) => branch.kind === "local"),
      normalizedQuery
    )
    const remoteBranches = filterBranches(
      branches.filter((branch) => branch.kind === "remote"),
      normalizedQuery
    )

    return [
      { heading: "Local branches", items: localBranches },
      { heading: "Remote branches", items: remoteBranches },
    ].filter((group) => group.items.length > 0)
  }, [branches, normalizedQuery])

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between rounded-xl border border-sidebar-border/70 bg-sidebar-accent/35 px-3 py-2.5 text-left text-sidebar-foreground hover:bg-sidebar-accent/55"
          disabled={disabled}
          aria-label="Select diff base branch"
        >
          <span className="min-w-0 pr-3">
            <span className="block truncate text-sm font-semibold tracking-[-0.01em]">
              {selectedBaseRef}
            </span>
            <span className="mt-0.5 block truncate text-xs text-sidebar-foreground/60">
              {triggerDetail}
            </span>
          </span>
          <RiArrowDownSLine
            data-icon="inline-end"
            className={cn(
              "mt-0.5 shrink-0 text-sidebar-foreground/55 transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="min-w-[var(--radix-popover-trigger-width)] w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
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
          />
          <CommandList className="px-2 py-2">
            <CommandEmpty>No matching branches.</CommandEmpty>
            <CommandGroup heading="Quick options">
              <CommandItem
                value="HEAD"
                onSelect={() => handleSelect("HEAD")}
                className="justify-between px-3 py-2.5"
              >
                <BranchOptionRow
                  label="HEAD"
                  detail="Current working tree baseline"
                  selected={selectedBaseRef === "HEAD"}
                />
              </CommandItem>
            </CommandGroup>
            {branchGroups.length > 0 ? <CommandSeparator /> : null}
            {branchGroups.map((group, index) => (
              <React.Fragment key={group.heading}>
                <CommandGroup heading={group.heading}>
                  {group.items.map((branch) => (
                    <CommandItem
                      key={branch.name}
                      value={branch.name}
                      onSelect={() => handleSelect(branch.name)}
                      className="justify-between px-3 py-2.5"
                    >
                      <BranchOptionRow
                        label={branch.name}
                        detail={branch.isCurrent ? "Current branch" : branch.kind}
                        selected={selectedBaseRef === branch.name}
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
  detail: string
  selected: boolean
}

function BranchOptionRow({ label, detail, selected }: BranchOptionRowProps) {
  return (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="rounded-md border border-border/60 bg-muted/35 p-1.5 text-muted-foreground">
          <RiGitBranchLine />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground/90">{detail}</p>
        </div>
      </div>
      <RiCheckLine
        className={cn(
          "mt-0.5 shrink-0 text-foreground/80 opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
          selected && "opacity-100"
        )}
      />
    </>
  )
}
