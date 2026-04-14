package main

import (
	"errors"
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var errSetupCancelled = errors.New("setup cancelled")

var (
	titleStyle       = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("212"))
	descriptionStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
	mutedStyle       = lipgloss.NewStyle().Foreground(lipgloss.Color("244"))
	helpStyle        = lipgloss.NewStyle().Foreground(lipgloss.Color("246"))
	sectionStyle     = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("111"))
	cursorStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("229")).Bold(true)
	checkedStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("84")).Bold(true)
	rowStyle         = lipgloss.NewStyle().Foreground(lipgloss.Color("250"))
	existsStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("78"))
	newStyle         = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
	errorStyle       = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true)
	summaryStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("190"))
)

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
	builder.WriteString(titleStyle.Render("skills"))
	builder.WriteString("\n\n")
	builder.WriteString(descriptionStyle.Render("Install diffx skill to agent targets (symlink mode by default)."))
	builder.WriteString("\n")
	builder.WriteString(mutedStyle.Render("Defaults: Universal + Claude Code"))
	builder.WriteString("\n\n")
	builder.WriteString(helpStyle.Render("Keys: up/down (or j/k) move, space toggle, a all, n none, enter confirm, q quit"))
	builder.WriteString("\n\n")
	builder.WriteString(sectionStyle.Render("Universal Targets"))
	builder.WriteString("\n")
	for index := range model.targets {
		if model.targets[index].ID == "universal" || model.targets[index].ID == "claude" {
			builder.WriteString(model.renderRow(index))
			builder.WriteString("\n")
		}
	}
	builder.WriteString("\n")
	builder.WriteString(sectionStyle.Render("Additional Targets"))
	builder.WriteString("\n")
	for index := range model.targets {
		if model.targets[index].ID != "universal" && model.targets[index].ID != "claude" {
			builder.WriteString(model.renderRow(index))
			builder.WriteString("\n")
		}
	}

	builder.WriteString("\n")
	builder.WriteString(summaryStyle.Render(fmt.Sprintf("Selected: %d target(s)", model.selectedCount())))
	builder.WriteString("\n")

	if model.errText != "" {
		builder.WriteString("\n")
		builder.WriteString(errorStyle.Render(model.errText))
		builder.WriteString("\n")
	}

	return builder.String()
}

func (model setupTUIModel) renderRow(index int) string {
	target := model.targets[index]

	cursor := " "
	if model.cursor == index {
		cursor = cursorStyle.Render(">")
	}

	checked := " "
	if model.selected[index] {
		checked = checkedStyle.Render("x")
	}

	status := newStyle.Render("new")
	if target.Exists {
		status = existsStyle.Render("exists")
	}

	line := fmt.Sprintf("%s %2d) [%s] %s (%s)", cursor, index+1, checked, target.Label, status)
	return rowStyle.Render(line)
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
