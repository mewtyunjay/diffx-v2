export type QuizOption = {
  id: string
  label: string
}

export type QuizQuestionCode = {
  language?: string
  content: string
}

export type QuizQuestion = {
  id: string
  prompt: string
  allowsMultiple: boolean
  code?: QuizQuestionCode
  options: QuizOption[]
}

export type QuizQuestionsResponse = {
  questions: QuizQuestion[]
}

export type SubmitQuizAnswerInput = {
  questionId: string
  optionIds: string[]
}

export type QuizAnswerResult = {
  questionId: string
  selectedOptionIds: string[]
  correctOptionIds: string[]
  isCorrect: boolean
}
