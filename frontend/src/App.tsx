import { DiffViewerPage } from "@/app/diff-viewer/DiffViewerPage"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Suspense, lazy } from "react"

const ExperimentalDockPage = lazy(() => import("@/app/experimental/ExperimentalDockPage"))
const ExperimentalSidebarPage = lazy(() => import("@/app/experimental/ExperimentalSidebarPage"))
function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }

  return pathname
}

function App() {
  const pathname =
    typeof window === "undefined" ? "/" : normalizePathname(window.location.pathname)
  const isExperimentalSidebarRoute =
    pathname === "/diffx/experimental/sidebar" || pathname === "/experimental/sidebar"
  const isExperimentalDockRoute =
    pathname === "/diffx/experimental" || pathname === "/experimental"

  return (
    <TooltipProvider>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        {isExperimentalSidebarRoute ? (
          <ExperimentalSidebarPage />
        ) : isExperimentalDockRoute ? (
          <ExperimentalDockPage />
        ) : (
          <DiffViewerPage />
        )}
      </Suspense>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
