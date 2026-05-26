package userconfig

const (
	DiffViewModeSplit   = "split"
	DiffViewModeUnified = "unified"

	DiffDetailModeStacked  = "stacked"
	DiffDetailModeFullFile = "fullFile"
)

type DiffViewerPreferences struct {
	ViewMode       string `json:"viewMode"`
	DiffDetailMode string `json:"diffDetailMode"`
}

func DefaultDiffViewerPreferences() DiffViewerPreferences {
	return DiffViewerPreferences{
		ViewMode:       DiffViewModeSplit,
		DiffDetailMode: DiffDetailModeStacked,
	}
}

func (preferences DiffViewerPreferences) Normalize() DiffViewerPreferences {
	normalized := preferences
	switch normalized.ViewMode {
	case DiffViewModeSplit, DiffViewModeUnified:
	default:
		normalized.ViewMode = DiffViewModeSplit
	}

	switch normalized.DiffDetailMode {
	case DiffDetailModeStacked, DiffDetailModeFullFile:
	default:
		normalized.DiffDetailMode = DiffDetailModeStacked
	}

	return normalized
}

func (store Store) LoadDiffViewerPreferences() (DiffViewerPreferences, error) {
	root, err := store.LoadRootMap()
	if err != nil {
		return DiffViewerPreferences{}, err
	}

	uiMap, _ := AsMap(root["ui"])
	diffViewerMap, _ := AsMap(uiMap["diffViewer"])
	defaults := DefaultDiffViewerPreferences()

	preferences := DiffViewerPreferences{
		ViewMode:       stringValue(diffViewerMap["viewMode"], defaults.ViewMode),
		DiffDetailMode: stringValue(diffViewerMap["diffDetailMode"], defaults.DiffDetailMode),
	}

	return preferences.Normalize(), nil
}

func (store Store) SaveDiffViewerPreferences(preferences DiffViewerPreferences) (DiffViewerPreferences, error) {
	normalized := preferences.Normalize()

	root, err := store.LoadRootMap()
	if err != nil {
		return DiffViewerPreferences{}, err
	}

	uiMap, _ := AsMap(root["ui"])
	if uiMap == nil {
		uiMap = make(map[string]any)
	}

	diffViewerMap, _ := AsMap(uiMap["diffViewer"])
	if diffViewerMap == nil {
		diffViewerMap = make(map[string]any)
	}

	diffViewerMap["viewMode"] = normalized.ViewMode
	diffViewerMap["diffDetailMode"] = normalized.DiffDetailMode
	uiMap["diffViewer"] = diffViewerMap
	root["ui"] = uiMap

	if err := store.SaveRootMap(root); err != nil {
		return DiffViewerPreferences{}, err
	}

	return normalized, nil
}

func stringValue(value any, fallback string) string {
	stringValue, ok := value.(string)
	if !ok {
		return fallback
	}

	return stringValue
}
