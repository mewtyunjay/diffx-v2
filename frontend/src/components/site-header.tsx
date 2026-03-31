import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type SiteHeaderProps = {
  scopePath: string
}

function formatScopeLabel(scopePath: string) {
  return scopePath === "." ? "repo root" : scopePath
}

export function SiteHeader({ scopePath }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="ml-auto flex min-w-0 flex-col items-end">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Scope
          </span>
          <span className="max-w-[28rem] truncate text-sm font-medium text-foreground">
            {formatScopeLabel(scopePath)}
          </span>
        </div>
      </div>
    </header>
  )
}
