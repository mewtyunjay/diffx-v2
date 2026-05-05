import { CheckCircle2, CircleDotDashed, CircleX } from "lucide-react"

import type { QuizAnswerResult, QuizQuestion } from "@/app/quiz/types"
import { Button } from "@/components/ui/button"
import { SidebarContent, SidebarFooter } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type QuizSidebarPanelProps = {
  questions: QuizQuestion[]
  currentQuestionIndex: number
  resultsByQuestionID: Record<string, QuizAnswerResult>
  onSelectQuestion: (index: number) => void
  onRestart: () => void
}

export function QuizSidebarPanel({
  questions,
  currentQuestionIndex,
  resultsByQuestionID,
  onSelectQuestion,
  onRestart,
}: QuizSidebarPanelProps) {
  return (
    <>
      <SidebarContent>
        <div className="px-2 pb-2 pt-3">
          <div className="mb-2 px-2">
            <p className="type-meta font-medium text-sidebar-foreground/72">
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </p>
          </div>

          <div className="space-y-1">
            {questions.map((question, index) => {
              const result = resultsByQuestionID[question.id]
              const isActive = index === currentQuestionIndex
              const statusIcon = result
                ? result.isCorrect
                  ? <CheckCircle2 className="size-3.5 text-emerald-400" />
                  : <CircleX className="size-3.5 text-rose-400" />
                : <CircleDotDashed className="size-3.5 text-sidebar-foreground/45" />

              return (
                <button
                  key={question.id}
                  type="button"
                  className={cn(
                    "w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "border-sidebar-border/80 bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onClick={() => onSelectQuestion(index)}
                >
                  <span className="flex items-start gap-2">
                    <span className="mt-0.5">{statusIcon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-meta font-medium text-sidebar-foreground">
                        Q{index + 1}
                      </span>
                      <span className="block truncate type-meta text-sidebar-foreground/65">
                        {question.prompt}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2.5">
        <Button type="button" size="sm" variant="outline" onClick={onRestart}>
          Restart quiz
        </Button>
      </SidebarFooter>
    </>
  )
}
