import type { QuizQuestion } from "@/app/quiz/types"

export const QUIZ_DUMMY_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1-vite-hot-reload",
    prompt: "Which command starts diffx with Vite hot-reload enabled?",
    allowsMultiple: false,
    options: [
      { id: "q1-a", label: "go run ./cmd/diffx --dev" },
      { id: "q1-b", label: "go run ./cmd/diffx review" },
      { id: "q1-c", label: "go build ./cmd/diffx" },
      { id: "q1-d", label: "cd frontend && npm run preview" },
    ],
  },
  {
    id: "q2-frontend-commands",
    prompt: "Select the commands that are valid frontend workflows in this repo.",
    allowsMultiple: true,
    options: [
      { id: "q2-a", label: "cd frontend && npm install" },
      { id: "q2-b", label: "cd frontend && npm run dev" },
      { id: "q2-c", label: "go test ./frontend/..." },
      { id: "q2-d", label: "cd frontend && npm run lint" },
    ],
  },
  {
    id: "q3-handler-style",
    prompt: "Based on the guideline below, what should an HTTP handler do?",
    allowsMultiple: false,
    code: {
      language: "go",
      content: `func handle(w http.ResponseWriter, r *http.Request) {
  // parse input, validate, call service, map errors, write response
}`,
    },
    options: [
      { id: "q3-a", label: "Keep transport logic thin and delegate work to services." },
      { id: "q3-b", label: "Place all git command execution directly in the handler." },
      { id: "q3-c", label: "Handle database migrations and file serving in one function." },
      { id: "q3-d", label: "Avoid validation and infer all request fields." },
    ],
  },
  {
    id: "q4-maintainability",
    prompt: "Which statement matches the maintainability rules for this codebase?",
    allowsMultiple: false,
    options: [
      { id: "q4-a", label: "Use large utility files like helpers.ts for convenience." },
      { id: "q4-b", label: "Split files by responsibility when they get too large." },
      { id: "q4-c", label: "Keep React render, data fetching, and heavy transforms together." },
      { id: "q4-d", label: "Always add useMemo/useCallback by default." },
    ],
  },
]
