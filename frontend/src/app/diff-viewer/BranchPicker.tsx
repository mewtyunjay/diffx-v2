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
          className="h-7 w-full justify-between rounded-lg border border-sidebar-border/55 bg-sidebar/32 px-3 text-left text-sidebar-foreground shadow-none hover:bg-sidebar-accent/36"
          disabled={disabled}
          aria-label="Select diff base branch"
        >
          <span className="min-w-0 truncate type-meta font-medium text-sidebar-foreground">
            {selectedBaseRef}
          </span>
          <RiArrowDownSLine
            data-icon="inline-end"
            className={cn(
              "size-3.5 shrink-0 text-sidebar-foreground/42 transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="min-w-[var(--radix-popover-trigger-width)] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[20px] border-sidebar-border/80 bg-sidebar p-0 text-sidebar-foreground shadow-[0_18px_42px_-24px_rgba(0,0,0,0.72)]"
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
            className="text-sidebar-foreground placeholder:text-sidebar-foreground/45"
          />
          <CommandList>
            <CommandEmpty>No matching branches.</CommandEmpty>
            <CommandGroup heading="Quick options">
              <CommandItem
                value="HEAD"
                onSelect={() => handleSelect("HEAD")}
                className="justify-between rounded-lg px-2.5 py-1.5 text-sidebar-foreground data-selected:bg-sidebar-accent/55"
              >
                <BranchOptionRow label="HEAD" selected={selectedBaseRef === "HEAD"} />
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
                      className="justify-between rounded-lg px-2.5 py-1.5 text-sidebar-foreground data-selected:bg-sidebar-accent/55"
                    >
                      <BranchOptionRow
                        label={branch.name}
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
  selected: boolean
}

function BranchOptionRow({ label, selected }: BranchOptionRowProps) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <RiGitBranchLine className="size-3.5 shrink-0 text-sidebar-foreground/42" />
        <span className="truncate text-sidebar-foreground">{label}</span>
      </div>
      <RiCheckLine
        className={cn(
          "size-3.5 shrink-0 text-sidebar-foreground/82 opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
          selected && "opacity-100"
        )}
      />
    </>
  )
}
