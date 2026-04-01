import * as React from "react"
import { RiArrowRightSLine, RiCheckLine, RiGitBranchLine } from "@remixicon/react"

import type { BranchOption } from "@/app/changed-files/api"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent/60"
          disabled={disabled}
          aria-label="Select diff base branch"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{selectedBaseRef}</span>
            <span className="mt-0.5 block text-xs text-sidebar-foreground/60">
              Search branches
            </span>
          </span>
          <RiArrowRightSLine
            data-icon="inline-end"
            className="shrink-0 text-sidebar-foreground/60"
          />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[28rem] max-w-[28rem] gap-0 border-r border-border/60 p-0"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Choose base branch</SheetTitle>
          <SheetDescription>
            Search for the branch or ref to compare the working tree against.
          </SheetDescription>
        </SheetHeader>
        <Command
          shouldFilter={false}
          className="min-h-0 flex-1"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search branches..."
            autoFocus
          />
          <CommandList>
            <CommandGroup heading="Quick options">
              <CommandItem
                value="HEAD"
                onSelect={() => handleSelect("HEAD")}
                className="justify-between"
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
                      className="justify-between"
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
      </SheetContent>
    </Sheet>
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
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-md border border-border/60 bg-muted/40 p-1.5 text-muted-foreground">
          <RiGitBranchLine />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <RiCheckLine className={cn("shrink-0 opacity-0", selected && "opacity-100 text-foreground")} />
    </>
  )
}
