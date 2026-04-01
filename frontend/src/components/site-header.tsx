import { AlertCircle, Check, Copy, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type SiteHeaderProps = {
  scopePath: string
  copyState: "idle" | "copying" | "success" | "error"
  canCopyAnnotations: boolean
  onCopyAnnotations: () => void
}

function formatScopeLabel(scopePath: string) {
  return scopePath === "." ? "repo root" : scopePath
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
  scopePath,
  copyState,
  canCopyAnnotations,
  onCopyAnnotations,
}: SiteHeaderProps) {
  const copyButton = getCopyButtonContents(copyState)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
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
          <div className="flex min-w-0 flex-col items-end">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Scope
            </span>
            <span className="max-w-[28rem] truncate text-sm font-medium text-foreground">
              {formatScopeLabel(scopePath)}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
