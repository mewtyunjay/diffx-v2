import { Check } from "lucide-react"

import type { QuizQuestion } from "@/app/quiz/types"
import { cn } from "@/lib/utils"

type QuizQuestionBlockProps = {
  question: QuizQuestion
  questionIndex: number
  selectedOptionIDs: string[]
  onToggleOption: (optionID: string) => void
}

export function QuizQuestionBlock({
  question,
  questionIndex,
  selectedOptionIDs,
  onToggleOption,
}: QuizQuestionBlockProps) {
  return (
    <section
      className="space-y-4 border-b border-border/60 py-8 last:border-b-0"
      aria-label={`Question ${questionIndex + 1}`}
      id={`quiz-question-${question.id}`}
    >
      <header className="space-y-2">
        <p className="type-overline text-muted-foreground">
          Question {questionIndex + 1}
        </p>
        <h2 className="type-title measure-readable text-foreground">{question.prompt}</h2>
        <p className="type-meta text-muted-foreground">
          {question.allowsMultiple ? "Select all that apply." : "Select one option."}
        </p>
      </header>

      {question.code ? (
        <div className="surface-field-quiet overflow-x-auto px-4 py-3">
          <p className="type-overline text-muted-foreground">
            {question.code.language ?? "snippet"}
          </p>
          <pre className="type-meta type-data mt-2 font-mono leading-relaxed text-foreground">
            <code>{question.code.content}</code>
          </pre>
        </div>
      ) : null}

      <div className="space-y-1" role="listbox" aria-multiselectable={question.allowsMultiple}>
        {question.options.map((option, optionIndex) => {
          const isSelected = selectedOptionIDs.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                "surface-field interactive-soft focus-ring-default flex w-full items-start gap-3 px-3 py-2 text-left",
                isSelected && "border-[var(--accent-border)] bg-[var(--surface-selected)]"
              )}
              onClick={() => onToggleOption(option.id)}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {isSelected ? <Check className="size-3" /> : null}
              </span>
              <span className="type-body flex-1 text-foreground">
                <span className="type-meta type-data mr-2 font-mono text-muted-foreground">
                  {String.fromCharCode(65 + optionIndex)}.
                </span>
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
