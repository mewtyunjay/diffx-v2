import { useState } from "react"

import { QUIZ_DUMMY_QUESTIONS } from "@/app/quiz/mockQuestions"
import type { QuizAnswerResult } from "@/app/quiz/types"

type QuizSelectionMap = Record<string, string[]>
type QuizResultMap = Record<string, QuizAnswerResult>

type UseQuizSessionOptions = {
  enabled?: boolean
}

export function useQuizSession({ enabled = true }: UseQuizSessionOptions = {}) {
  const [error, setError] = useState<string | null>(null)

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedByQuestionID, setSelectedByQuestionID] = useState<QuizSelectionMap>({})
  const [resultsByQuestionID, setResultsByQuestionID] = useState<QuizResultMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const questions = enabled ? QUIZ_DUMMY_QUESTIONS : []
  const isLoading = false

  const currentQuestion = questions[currentQuestionIndex] ?? null
  const currentQuestionID = currentQuestion?.id
  const currentSelection = currentQuestionID ? selectedByQuestionID[currentQuestionID] ?? [] : []
  const currentResult = currentQuestionID ? resultsByQuestionID[currentQuestionID] ?? null : null
  const answeredCount = Object.keys(resultsByQuestionID).length
  const correctCount = Object.values(resultsByQuestionID).filter((result) => result.isCorrect).length

  function toggleOption(optionID: string) {
    if (!currentQuestionID || !currentQuestion) {
      return
    }
    if (resultsByQuestionID[currentQuestionID]) {
      return
    }

    setSelectedByQuestionID((current) => {
      const selected = current[currentQuestionID] ?? []
      const isSelected = selected.includes(optionID)

      if (!currentQuestion.allowsMultiple) {
        return {
          ...current,
          [currentQuestionID]: isSelected ? [] : [optionID],
        }
      }

      return {
        ...current,
        [currentQuestionID]: isSelected
          ? selected.filter((value) => value !== optionID)
          : [...selected, optionID],
      }
    })
  }

  async function submitCurrentQuestion() {
    if (!currentQuestionID || !currentQuestion || currentSelection.length === 0 || currentResult) {
      return
    }

    // Keep local submission state for prototype mode without server-backed grading.
    setResultsByQuestionID((current) => ({
      ...current,
      [currentQuestionID]: {
        questionId: currentQuestionID,
        selectedOptionIds: currentSelection,
        correctOptionIds: [],
        isCorrect: false,
      },
    }))
    setError(null)
    setIsSubmitting(false)
  }

  function goToNextQuestion() {
    setCurrentQuestionIndex((current) => {
      if (current + 1 >= questions.length) {
        return current
      }

      return current + 1
    })
  }

  function restartQuiz() {
    setCurrentQuestionIndex(0)
    setSelectedByQuestionID({})
    setResultsByQuestionID({})
    setError(null)
  }

  const isLastQuestion = questions.length > 0 && currentQuestionIndex === questions.length - 1

  function goToQuestion(index: number) {
    setCurrentQuestionIndex((current) => {
      if (questions.length === 0) {
        return current
      }

      if (index < 0) {
        return 0
      }

      if (index >= questions.length) {
        return questions.length - 1
      }

      return index
    })
  }

  return {
    questions,
    isLoading,
    isSubmitting,
    error,
    currentQuestion,
    currentQuestionIndex,
    currentSelection,
    currentResult,
    resultsByQuestionID,
    isLastQuestion,
    answeredCount,
    correctCount,
    toggleOption,
    submitCurrentQuestion,
    goToNextQuestion,
    goToQuestion,
    restartQuiz,
  }
}
