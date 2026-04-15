import * as React from "react"
import { Check, ChevronDown, GitBranch, LoaderCircle } from "lucide-react"

import type { BranchOption } from "@/git/types"
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

type CheckoutBranchPickerProps = {
  branchName: string
  branches: BranchOption[]
  disabled?: boolean
  isSwitchPending?: boolean
  onSelectBranch: (branch: string) => void
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

export function CheckoutBranchPicker({
  branchName,
  branches,
  disabled = false,
  isSwitchPending = false,
  onSelectBranch,
}: CheckoutBranchPickerProps) {
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
    (nextBranch: string) => {
      onSelectBranch(nextBranch)
      setOpen(false)
    },
    [onSelectBranch]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="surface-sidebar-field interactive-sidebar h-7 min-w-0 max-w-52 justify-between gap-2 px-2 text-sidebar-foreground"
          aria-label="Switch current branch"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/60" />
            <span className="min-w-0 truncate type-meta font-medium text-sidebar-foreground type-data">
              {branchName}
            </span>
          </span>
          {isSwitchPending ? (
            <LoaderCircle className="size-3.5 shrink-0 animate-spin text-sidebar-foreground/60" />
          ) : (
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ease-in-out motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="surface-sidebar-elevated min-w-[var(--radix-popover-trigger-width)] w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0 text-sidebar-foreground"
      >
        <Command
          shouldFilter={false}
          className="min-h-0 max-h-[min(30rem,calc(100vh-8rem))]"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Switch branch..."
            autoFocus
            className="text-sidebar-foreground placeholder:text-sidebar-foreground/45"
          />
          <CommandList>
            <CommandEmpty>No matching branches.</CommandEmpty>
            {branchGroups.map((group, index) => (
              <React.Fragment key={group.heading}>
                <CommandGroup>
                  <p className="type-section-label px-2 pb-1 pt-1 text-sidebar-foreground/46">
                    {group.heading}
                  </p>
                  {group.items.map((branch) => (
                    <CommandItem
                      key={branch.name}
                      value={branch.name}
                      onSelect={() => handleSelect(branch.name)}
                      className="justify-between rounded-md px-2.5 py-1.5 text-sidebar-foreground data-selected:bg-sidebar-accent/55"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <GitBranch className="size-3.5 shrink-0 text-sidebar-foreground/42" />
                        <span className="truncate text-sidebar-foreground">{branch.name}</span>
                      </div>
                      <Check
                        className={cn(
                          "size-3.5 shrink-0 text-sidebar-foreground/82 opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
                          branch.name === branchName && "opacity-100"
                        )}
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
