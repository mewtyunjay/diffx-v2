import { DiffViewerPage } from "@/app/diff-viewer/DiffViewerPage"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ShortcutsProvider } from "@/lib/shortcuts"

function App() {
  return (
    <ShortcutsProvider>
      <TooltipProvider>
        <DiffViewerPage />
        <Toaster />
      </TooltipProvider>
    </ShortcutsProvider>
  )
}

export default App
