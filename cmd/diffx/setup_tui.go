package main

import (
	"errors"
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

var errSetupCancelled = errors.New("setup cancelled")

type setupTUIModel struct {
	targets   []setupTarget
	selected  map[int]bool
	cursor    int
	errText   string
	done      bool
	cancelled bool
}

func newSetupTUIModel(targets []setupTarget, selectedIDs map[string]bool) setupTUIModel {
	selected := make(map[int]bool, len(targets))
	for index, target := range targets {
		selected[index] = selectedIDs[target.ID]
	}

	return setupTUIModel{
		targets:  targets,
		selected: selected,
		cursor:   0,
	}
}

func (model setupTUIModel) Init() tea.Cmd {
	return nil
}

func (model setupTUIModel) Update(message tea.Msg) (tea.Model, tea.Cmd) {
	switch typed := message.(type) {
	case tea.KeyMsg:
		switch typed.String() {
		case "ctrl+c", "q":
			model.done = true
			model.cancelled = true
			return model, tea.Quit
		case "up", "k":
			if model.cursor == 0 {
				model.cursor = len(model.targets) - 1
			} else {
				model.cursor--
			}
		case "down", "j":
			model.cursor = (model.cursor + 1) % len(model.targets)
		case " ":
			model.selected[model.cursor] = !model.selected[model.cursor]
			model.errText = ""
		case "a":
			for index := range model.targets {
				model.selected[index] = true
			}
			model.errText = ""
		case "n":
			for index := range model.targets {
				model.selected[index] = false
			}
		case "enter":
			if model.selectedCount() == 0 {
				model.errText = "Select at least one target."
				return model, nil
			}
			model.done = true
			return model, tea.Quit
		}
	}

	return model, nil
}

func (model setupTUIModel) View() string {
	if model.done && model.cancelled {
		return "Setup cancelled.\n"
	}

	var builder strings.Builder
	builder.WriteString("skills\n\n")
	builder.WriteString("Install diffx skill to agent targets (symlink mode by default).\n")
	builder.WriteString("Defaults: Universal + Claude Code.\n\n")
	builder.WriteString("Keys: ↑/↓ (or j/k) move, space toggle, a all, n none, enter confirm, q quit\n\n")
	builder.WriteString("Select targets to install:\n")

	for index, target := range model.targets {
		cursor := " "
		if model.cursor == index {
			cursor = ">"
		}

		checked := " "
		if model.selected[index] {
			checked = "x"
		}

		existsText := "new"
		if target.Exists {
			existsText = "exists"
		}

		builder.WriteString(fmt.Sprintf("%s %2d) [%s] %-36s (%s)\n", cursor, index+1, checked, target.Label, existsText))
	}

	if model.errText != "" {
		builder.WriteString("\n")
		builder.WriteString(model.errText)
		builder.WriteString("\n")
	}

	return builder.String()
}

func (model setupTUIModel) selectedCount() int {
	count := 0
	for index := range model.targets {
		if model.selected[index] {
			count++
		}
	}

	return count
}

func (model setupTUIModel) selectedIDs() map[string]bool {
	selectedIDs := make(map[string]bool)
	for index, target := range model.targets {
		if model.selected[index] {
			selectedIDs[target.ID] = true
		}
	}

	return selectedIDs
}

func runSetupTUI(targets []setupTarget, selectedIDs map[string]bool) (map[string]bool, error) {
	program := tea.NewProgram(newSetupTUIModel(targets, selectedIDs))
	finalModel, err := program.Run()
	if err != nil {
		return nil, err
	}

	model, ok := finalModel.(setupTUIModel)
	if !ok {
		return nil, errors.New("unexpected setup TUI model type")
	}
	if model.cancelled {
		return nil, errSetupCancelled
	}

	selected := model.selectedIDs()
	if len(selected) == 0 {
		return nil, errors.New("no targets selected")
	}

	return selected, nil
}
