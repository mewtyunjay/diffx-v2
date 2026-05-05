import type {
  QuizAnswerResult,
  QuizQuestionsResponse,
  SubmitQuizAnswerInput,
} from "@/app/quiz/types"

async function readError(response: Response) {
  const text = await response.text()
  return text || `Request failed with status ${response.status}`
}

async function readJSON<TResponse>(response: Response) {
  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as TResponse
}

export async function fetchQuizQuestions(signal?: AbortSignal) {
  const response = await fetch("/api/quiz/questions", { signal })
  return readJSON<QuizQuestionsResponse>(response)
}

export async function submitQuizAnswer(input: SubmitQuizAnswerInput, signal?: AbortSignal) {
  const response = await fetch("/api/quiz/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  })

  return readJSON<QuizAnswerResult>(response)
}
