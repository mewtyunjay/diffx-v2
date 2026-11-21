import { DiffViewerPage } from "@/app/diff-viewer/DiffViewerPage"
import { QuizPage } from "@/app/quiz/QuizPage"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ShortcutsProvider } from "@/lib/shortcuts"

function App() {
  return (
    <ShortcutsProvider>
      <TooltipProvider>
        {window.location.pathname === "/quiz" ? <QuizPage /> : <DiffViewerPage />}
        <Toaster />
      </TooltipProvider>
    </ShortcutsProvider>
  )
}

export default App
