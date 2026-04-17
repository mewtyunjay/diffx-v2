import type { CSSProperties, ReactNode } from "react"

import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

type AppShellProps = {
  sidebarContent: ReactNode
  header: ReactNode
  children: ReactNode
}

export function AppShell({ sidebarContent, header, children }: AppShellProps) {
  return (
    <SidebarProvider
      defaultWidth={288}
      className="bg-sidebar"
      style={
        {
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="offcanvas" variant="inset">
        {sidebarContent}
      </Sidebar>
      <SidebarInset>
        {header}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
