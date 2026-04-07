import { DiffViewerPage } from "@/app/diff-viewer/DiffViewerPage"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

function App() {
  return (
    <TooltipProvider>
      <DiffViewerPage />
      <Toaster />
    </TooltipProvider>
  )
}

export default App
