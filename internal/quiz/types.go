package quiz

import "errors"

var (
	ErrQuestionNotFound = errors.New("quiz question not found")
	ErrInvalidOption    = errors.New("quiz answer includes unknown option")
)

type Option struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type Question struct {
	ID             string   `json:"id"`
	Prompt         string   `json:"prompt"`
	AllowsMultiple bool     `json:"allowsMultiple"`
	Options        []Option `json:"options"`
}

type QuestionsResponse struct {
	Questions []Question `json:"questions"`
}

type AnswerResult struct {
	QuestionID        string   `json:"questionId"`
	SelectedOptionIDs []string `json:"selectedOptionIds"`
	CorrectOptionIDs  []string `json:"correctOptionIds"`
	IsCorrect         bool     `json:"isCorrect"`
}
