package server

import (
	"errors"
	"net/http"

	"diffx/internal/quiz"
)

type quizAnswerRequest struct {
	QuestionID string   `json:"questionId"`
	OptionIDs  []string `json:"optionIds"`
}

func (a *App) handleQuizQuestions(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}

	if a.quizService == nil {
		http.Error(w, "quiz service is not configured", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, quiz.QuestionsResponse{
		Questions: a.quizService.ListQuestions(),
	})
}

func (a *App) handleQuizAnswer(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	if a.quizService == nil {
		http.Error(w, "quiz service is not configured", http.StatusNotFound)
		return
	}

	var request quizAnswerRequest
	if err := readJSONBody(r, &request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if request.QuestionID == "" {
		http.Error(w, "questionId is required", http.StatusBadRequest)
		return
	}

	result, err := a.quizService.GradeAnswer(request.QuestionID, request.OptionIDs)
	if err != nil {
		switch {
		case errors.Is(err, quiz.ErrQuestionNotFound), errors.Is(err, quiz.ErrInvalidOption):
			http.Error(w, err.Error(), http.StatusBadRequest)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	writeJSON(w, http.StatusOK, result)
}
