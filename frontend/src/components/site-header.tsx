import type { ReactNode } from "react"
import { AlertCircle, Check, Copy, LoaderCircle, Send } from "lucide-react"

import { BranchPicker } from "@/diff-viewer/BranchPicker"
import type { BranchOption } from "@/git/types"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SHORTCUTS } from "@/lib/shortcuts"

type SiteHeaderProps = {
  branches: BranchOption[]
  currentRef: string
  selectedBaseRef: string
  isBranchesLoading: boolean
  branchesError: string | null
  copyState: "idle" | "copying" | "success" | "error"
  sendState: "idle" | "sending" | "success" | "error"
  canCopyAnnotations: boolean
  canSendAnnotations: boolean
  onSelectBaseRef: (baseRef: string) => void
  onCopyAnnotations: () => void
  onSendAnnotations: () => void
  settingsControl?: ReactNode
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

function getSendButtonContents(sendState: SiteHeaderProps["sendState"]) {
  switch (sendState) {
    case "sending":
      return {
        icon: <LoaderCircle className="animate-spin" />,
        label: "Sending…",
      }
    case "success":
      return {
        icon: <Check />,
        label: "Sent",
      }
    case "error":
      return {
        icon: <AlertCircle />,
        label: "Send failed",
      }
    default:
      return {
        icon: <Send />,
        label: "Send to agent",
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
  sendState,
  canCopyAnnotations,
  canSendAnnotations,
  onSelectBaseRef,
  onCopyAnnotations,
  onSendAnnotations,
  settingsControl,
}: SiteHeaderProps) {
  const copyButton = getCopyButtonContents(copyState)
  const sendButton = getSendButtonContents(sendState)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarTrigger className="-ml-1" />
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Toggle sidebar
              <Kbd keys={SHORTCUTS.toggleSidebar.keys} />
            </TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                onClick={onSendAnnotations}
                disabled={!canSendAnnotations || sendState === "sending"}
                aria-label={sendButton.label}
              >
                {sendButton.icon}
                <span className="sr-only">{sendButton.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {sendButton.label}
              <Kbd keys={SHORTCUTS.sendToAgent.keys} />
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={onCopyAnnotations}
                disabled={!canCopyAnnotations || copyState === "copying"}
                aria-label={copyButton.label}
              >
                {copyButton.icon}
                <span className="sr-only">{copyButton.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {copyButton.label}
            </TooltipContent>
          </Tooltip>
          {settingsControl ?? null}
        </div>
      </div>
    </header>
  )
}
