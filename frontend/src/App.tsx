import { mockChangedFiles } from "@/app/changed-files/mock"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useState, type CSSProperties } from "react"

function App() {
  const [selectedFilePath, setSelectedFilePath] = useState(
    mockChangedFiles[0]?.path ?? null
  )
  const selectedFile =
    mockChangedFiles.find((file) => file.path === selectedFilePath) ??
    mockChangedFiles[0]

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider
          className="bg-sidebar"
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as CSSProperties
          }
        >
          <AppSidebar
            files={mockChangedFiles}
            selectedFilePath={selectedFilePath}
            onSelectFile={setSelectedFilePath}
            variant="inset"
          />
          <SidebarInset>
            <SiteHeader />
            <main className="flex min-h-0 flex-1 flex-col p-4">
              <section className="flex flex-1 flex-col rounded-xl border border-border/50 bg-card/30 shadow-sm">
                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Selection benchmark
                  </p>
                  <h1 className="mt-2 text-xl font-semibold text-foreground">
                    {selectedFile?.path ?? "No file selected"}
                  </h1>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-6 p-5">
                  <div className="max-w-3xl">
                    <p className="text-sm text-muted-foreground">
                      This panel is intentionally light. Clicking a row only
                      updates the selected file path so the sidebar interaction
                      stays as close to zero-cost as possible.
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Files in list
                      </dt>
                      <dd className="mt-2 text-2xl font-semibold text-foreground">
                        {mockChangedFiles.length}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Selected status
                      </dt>
                      <dd className="mt-2 text-2xl font-semibold capitalize text-foreground">
                        {selectedFile?.status ?? "none"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Click behavior
                      </dt>
                      <dd className="mt-2 text-2xl font-semibold text-foreground">
                        Select only
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
