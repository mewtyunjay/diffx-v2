import { GraduationCap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

type QuizModeHeaderProps = {
  currentQuestionIndex: number
  totalQuestions: number
  answeredCount: number
  correctCount: number
  onOpenDiffViewer: () => void
}

export function QuizModeHeader({
  currentQuestionIndex,
  totalQuestions,
  answeredCount,
  correctCount,
  onOpenDiffViewer,
}: QuizModeHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-6" />
          <div className="flex min-w-0 items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Quiz mode</p>
              <p className="truncate text-xs text-muted-foreground">
                {totalQuestions > 0
                  ? `Question ${currentQuestionIndex + 1}/${totalQuestions} • ${correctCount}/${answeredCount} correct`
                  : "Loading questions"}
              </p>
            </div>
          </div>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onOpenDiffViewer}>
          Open diff viewer
        </Button>
      </div>
    </header>
  )
}
