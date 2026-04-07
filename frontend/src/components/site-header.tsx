import { AlertCircle, Check, Copy, LoaderCircle } from "lucide-react"

import { BranchPicker } from "@/app/diff-viewer/BranchPicker"
import type { BranchOption } from "@/app/changed-files/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type SiteHeaderProps = {
  branches: BranchOption[]
  currentRef: string
  selectedBaseRef: string
  isBranchesLoading: boolean
  branchesError: string | null
  copyState: "idle" | "copying" | "success" | "error"
  canCopyAnnotations: boolean
  onSelectBaseRef: (baseRef: string) => void
  onCopyAnnotations: () => void
}

function getCopyButtonContents(copyState: SiteHeaderProps["copyState"]) {
  switch (copyState) {
    case "copying":
      return {
        icon: <LoaderCircle className="animate-spin" />,
        label: "Copying…",
      }
    case "success":
      return {
        icon: <Check />,
        label: "Copied",
      }
    case "error":
      return {
        icon: <AlertCircle />,
        label: "Copy failed",
      }
    default:
      return {
        icon: <Copy />,
        label: "Copy annotations",
      }
  }
}

export function SiteHeader({
  branches,
  currentRef,
  selectedBaseRef,
  isBranchesLoading,
  branchesError,
  copyState,
  canCopyAnnotations,
  onSelectBaseRef,
  onCopyAnnotations,
}: SiteHeaderProps) {
  const copyButton = getCopyButtonContents(copyState)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-1 data-[orientation=vertical]:h-6"
          />
          <BranchPicker
            branches={branches}
            currentRef={currentRef}
            selectedBaseRef={selectedBaseRef}
            onSelectBaseRef={onSelectBaseRef}
            disabled={isBranchesLoading || branchesError != null}
            variant="header"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopyAnnotations}
            disabled={!canCopyAnnotations || copyState === "copying"}
          >
            {copyButton.icon}
            {copyButton.label}
          </Button>
        </div>
      </div>
    </header>
  )
}
