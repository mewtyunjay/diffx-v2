package quiz

import "slices"

type questionRecord struct {
	Question
	correctOptionIDs []string
}

type Service struct {
	questions []questionRecord
}

func NewService() *Service {
	return &Service{
		questions: []questionRecord{
			{
				Question: Question{
					ID:             "q-dev-mode",
					Prompt:         "Which command starts diffx with Vite hot-reload enabled?",
					AllowsMultiple: false,
					Options: []Option{
						{ID: "a", Label: "go run ./cmd/diffx --dev"},
						{ID: "b", Label: "go run ./cmd/diffx review"},
						{ID: "c", Label: "go build ./cmd/diffx"},
						{ID: "d", Label: "cd frontend && npm run preview"},
					},
				},
				correctOptionIDs: []string{"a"},
			},
			{
				Question: Question{
					ID:             "q-api-routes",
					Prompt:         "Which routes are currently real diffx API endpoints?",
					AllowsMultiple: true,
					Options: []Option{
						{ID: "a", Label: "/api/files"},
						{ID: "b", Label: "/api/quiz/questions"},
						{ID: "c", Label: "/api/review/state"},
						{ID: "d", Label: "/api/pipeline/run"},
					},
				},
				correctOptionIDs: []string{"a", "b", "c"},
			},
			{
				Question: Question{
					ID:             "q-frontend-stack",
					Prompt:         "What frontend stack is used in this repo?",
					AllowsMultiple: false,
					Options: []Option{
						{ID: "a", Label: "Svelte + Rollup"},
						{ID: "b", Label: "React + Vite + TypeScript"},
						{ID: "c", Label: "Vue + Nuxt"},
						{ID: "d", Label: "Next.js + Tailwind only"},
					},
				},
				correctOptionIDs: []string{"b"},
			},
		},
	}
}

func (s *Service) ListQuestions() []Question {
	questions := make([]Question, 0, len(s.questions))
	for _, question := range s.questions {
		questions = append(questions, question.Question)
	}

	return questions
}

func (s *Service) GradeAnswer(questionID string, optionIDs []string) (AnswerResult, error) {
	question, ok := s.findQuestion(questionID)
	if !ok {
		return AnswerResult{}, ErrQuestionNotFound
	}

	normalizedSelections := unique(optionIDs)
	for _, optionID := range normalizedSelections {
		if !hasOptionID(question, optionID) {
			return AnswerResult{}, ErrInvalidOption
		}
	}

	correctSelections := unique(question.correctOptionIDs)
	isCorrect := sameSet(normalizedSelections, correctSelections)

	return AnswerResult{
		QuestionID:        questionID,
		SelectedOptionIDs: normalizedSelections,
		CorrectOptionIDs:  correctSelections,
		IsCorrect:         isCorrect,
	}, nil
}

func (s *Service) findQuestion(questionID string) (questionRecord, bool) {
	for _, question := range s.questions {
		if question.ID == questionID {
			return question, true
		}
	}

	return questionRecord{}, false
}

func hasOptionID(question questionRecord, optionID string) bool {
	for _, option := range question.Options {
		if option.ID == optionID {
			return true
		}
	}

	return false
}

func unique(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	result := make([]string, 0, len(items))

	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}

	return result
}

func sameSet(a []string, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for _, value := range a {
		if !slices.Contains(b, value) {
			return false
		}
	}

	return true
}
