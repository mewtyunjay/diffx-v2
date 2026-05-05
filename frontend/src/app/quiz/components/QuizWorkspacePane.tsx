import { AlertCircle, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { QuizQuestionBlock } from "@/app/quiz/components/QuizQuestionBlock"
import type { QuizQuestion } from "@/app/quiz/types"
import { Button } from "@/components/ui/button"

type QuizWorkspacePaneProps = {
  questions: QuizQuestion[]
  currentQuestionIndex: number
  isLoading: boolean
  error: string | null
  onRestart: () => void
}

export function QuizWorkspacePane({
  questions,
  currentQuestionIndex,
  isLoading,
  error,
  onRestart,
}: QuizWorkspacePaneProps) {
  const [selectedByQuestionID, setSelectedByQuestionID] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) {
      return
    }

    const targetElement = document.getElementById(`quiz-question-${currentQuestion.id}`)
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [currentQuestionIndex, questions])

  function toggleOptionForQuestion(question: QuizQuestion, optionID: string) {
    setSelectedByQuestionID((current) => {
      const selected = current[question.id] ?? []
      const isSelected = selected.includes(optionID)

      if (!question.allowsMultiple) {
        return {
          ...current,
          [question.id]: isSelected ? [] : [optionID],
        }
      }

      return {
        ...current,
        [question.id]: isSelected
          ? selected.filter((value) => value !== optionID)
          : [...selected, optionID],
      }
    })
  }

  if (isLoading) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-4">
        <p className="type-meta inline-flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading quiz…
        </p>
      </section>
    )
  }

  if (questions.length === 0) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="type-body text-muted-foreground">No questions available yet.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRestart}>
          Retry
        </Button>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-background px-4 py-6">
      {error ? (
        <div className="surface-panel mx-auto mb-4 flex w-full max-w-3xl items-center gap-2 px-3 py-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="type-meta">{error}</span>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-4xl pb-6">
        <header className="pb-6">
          <h1 className="type-page-title text-foreground">Practice quiz</h1>
          <p className="type-body measure-readable mt-2 text-muted-foreground">
            Continuous layout preview with componentized questions. Answers are local-only for now.
          </p>
        </header>

        <div className="space-y-8">
          {questions.map((question, index) => (
            <QuizQuestionBlock
              key={question.id}
              question={question}
              questionIndex={index}
              selectedOptionIDs={selectedByQuestionID[question.id] ?? []}
              onToggleOption={(optionID) => toggleOptionForQuestion(question, optionID)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
