import { CheckCircle2, Circle, CircleCheckBig, CircleX, MoveRight, RotateCcw } from "lucide-react"

import type { QuizAnswerResult, QuizQuestion } from "@/app/quiz/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type QuizQuestionCardProps = {
  question: QuizQuestion
  questionIndex: number
  totalQuestions: number
  selectedOptionIDs: string[]
  answerResult: QuizAnswerResult | null
  answeredCount: number
  correctCount: number
  isSubmitting: boolean
  isLastQuestion: boolean
  onToggleOption: (optionID: string) => void
  onSubmitAnswer: () => void
  onNextQuestion: () => void
  onRestart: () => void
}

export function QuizQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedOptionIDs,
  answerResult,
  answeredCount,
  correctCount,
  isSubmitting,
  isLastQuestion,
  onToggleOption,
  onSubmitAnswer,
  onNextQuestion,
  onRestart,
}: QuizQuestionCardProps) {
  const hasSubmittedAnswer = answerResult != null

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-border/80 bg-card/95 p-6 shadow-[0_1rem_3rem_-1.5rem_rgba(0,0,0,0.8)] sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Question {questionIndex + 1} of {totalQuestions}
        </p>
        <p className="text-sm text-muted-foreground">
          Score: <span className="font-semibold text-foreground">{correctCount}</span> / {answeredCount}
        </p>
      </div>

      <h2 className="mb-2 text-xl font-semibold text-foreground sm:text-2xl">{question.prompt}</h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {question.allowsMultiple ? "Select all that apply." : "Select one option."}
      </p>

      <div className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selectedOptionIDs.includes(option.id)
          const isCorrectOption = answerResult?.correctOptionIds.includes(option.id) ?? false
          const wasIncorrectSelection = hasSubmittedAnswer && isSelected && !isCorrectOption

          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-3",
                hasSubmittedAnswer
                  ? "cursor-default"
                  : "hover:border-primary/60 hover:bg-primary/8",
                isSelected && !hasSubmittedAnswer && "border-primary/70 bg-primary/12",
                hasSubmittedAnswer && isCorrectOption && "border-emerald-500/70 bg-emerald-500/14",
                wasIncorrectSelection && "border-rose-500/70 bg-rose-500/14"
              )}
              onClick={() => onToggleOption(option.id)}
              disabled={hasSubmittedAnswer}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 text-muted-foreground">
                  {question.allowsMultiple ? (
                    isSelected ? <CircleCheckBig className="size-4" /> : <Circle className="size-4" />
                  ) : isSelected ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
                  <span className="text-sm text-foreground sm:text-base">{option.label}</span>
                </span>
                {hasSubmittedAnswer && isCorrectOption ? <CircleCheckBig className="size-4 text-emerald-400" /> : null}
                {wasIncorrectSelection ? <CircleX className="size-4 text-rose-400" /> : null}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {!hasSubmittedAnswer ? (
          <Button
            type="button"
            size="sm"
            onClick={onSubmitAnswer}
            disabled={selectedOptionIDs.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Checking…" : "Check answer"}
          </Button>
        ) : null}

        {hasSubmittedAnswer && !isLastQuestion ? (
          <Button type="button" size="sm" onClick={onNextQuestion}>
            Next question
            <MoveRight className="size-3.5" />
          </Button>
        ) : null}

        {hasSubmittedAnswer && isLastQuestion ? (
          <Button type="button" size="sm" variant="outline" onClick={onRestart}>
            Restart quiz
            <RotateCcw className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </section>
  )
}
