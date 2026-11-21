import { useEffect, useState } from "react"

import { fetchQuizQuestions, submitQuizAnswer } from "@/app/quiz/api"
import type { QuizAnswerResult, QuizQuestion } from "@/app/quiz/types"

export function useQuizSession() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentQuestionIndex, goToQuestion] = useState(0)
  const [selectedByQuestionID, setSelectedByQuestionID] = useState<Record<string, string[]>>({})
  const [resultsByQuestionID, setResultsByQuestionID] = useState<Record<string, QuizAnswerResult>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetchQuizQuestions(controller.signal)
      .then(({ questions }) => setQuestions(questions))
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [])

  const question = questions[currentQuestionIndex]
  const currentSelection = question ? selectedByQuestionID[question.id] ?? [] : []
  const currentResult = question ? resultsByQuestionID[question.id] ?? null : null
  const results = Object.values(resultsByQuestionID)

  function toggleOption(optionID: string) {
    if (!question || currentResult || isSubmitting) return

    setSelectedByQuestionID((current) => {
      const selected = current[question.id] ?? []
      const nextSelection = selected.includes(optionID)
        ? selected.filter((value) => value !== optionID)
        : question.allowsMultiple ? [...selected, optionID] : [optionID]

      return { ...current, [question.id]: nextSelection }
    })
  }

  async function submitCurrentQuestion() {
    if (!question || currentSelection.length === 0 || currentResult || isSubmitting) return

    setError(null)
    setIsSubmitting(true)
    try {
      const result = await submitQuizAnswer({ questionId: question.id, optionIds: currentSelection })
      setResultsByQuestionID((current) => ({ ...current, [result.questionId]: result }))
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to check the answer.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    questions,
    isLoading,
    isSubmitting,
    error,
    currentQuestionIndex,
    currentSelection,
    currentResult,
    resultsByQuestionID,
    answeredCount: results.length,
    correctCount: results.filter((result) => result.isCorrect).length,
    toggleOption,
    submitCurrentQuestion,
    goToQuestion,
  }
}
