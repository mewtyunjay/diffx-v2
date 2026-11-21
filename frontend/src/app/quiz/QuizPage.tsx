import { useState } from "react"

import { QuizModeHeader } from "@/app/quiz/components/QuizModeHeader"
import { QuizQuestionCard } from "@/app/quiz/components/QuizQuestionCard"
import { QuizSidebarPanel } from "@/app/quiz/components/QuizSidebarPanel"
import { useQuizSession } from "@/app/quiz/hooks/useQuizSession"
import { AppShell } from "@/components/app-shell"

function QuizSession({ onRestart }: { onRestart: () => void }) {
  const quiz = useQuizSession()
  const question = quiz.questions[quiz.currentQuestionIndex]

  return (
    <AppShell
      header={
        <QuizModeHeader
          currentQuestionIndex={quiz.currentQuestionIndex}
          totalQuestions={quiz.questions.length}
          answeredCount={quiz.answeredCount}
          correctCount={quiz.correctCount}
        />
      }
      sidebarContent={
        <QuizSidebarPanel
          questions={quiz.questions}
          currentQuestionIndex={quiz.currentQuestionIndex}
          resultsByQuestionID={quiz.resultsByQuestionID}
          onSelectQuestion={quiz.goToQuestion}
          onRestart={onRestart}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-auto p-6">
        {quiz.error ? <p role="alert" className="type-meta text-destructive">{quiz.error}</p> : null}
        {quiz.isLoading ? <p role="status" className="type-meta">Loading quiz…</p> : null}
        {!quiz.isLoading && !quiz.error && !question ? (
          <p className="type-meta text-muted-foreground">No questions available.</p>
        ) : null}
        {question ? (
          <QuizQuestionCard
            question={question}
            questionIndex={quiz.currentQuestionIndex}
            totalQuestions={quiz.questions.length}
            selectedOptionIDs={quiz.currentSelection}
            answerResult={quiz.currentResult}
            answeredCount={quiz.answeredCount}
            correctCount={quiz.correctCount}
            isSubmitting={quiz.isSubmitting}
            isLastQuestion={quiz.currentQuestionIndex === quiz.questions.length - 1}
            onToggleOption={quiz.toggleOption}
            onSubmitAnswer={quiz.submitCurrentQuestion}
            onNextQuestion={() => quiz.goToQuestion(quiz.currentQuestionIndex + 1)}
            onRestart={onRestart}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

export function QuizPage() {
  const [session, setSession] = useState(0)

  return <QuizSession key={session} onRestart={() => setSession((current) => current + 1)} />
}
