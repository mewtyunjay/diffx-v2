export type DiffViewMode = "split" | "unified"
export type DiffDetailMode = "stacked" | "fullFile"

export type DiffViewerPreferences = {
  viewMode: DiffViewMode
  diffDetailMode: DiffDetailMode
}

export const DEFAULT_DIFF_VIEWER_PREFERENCES: DiffViewerPreferences = {
  viewMode: "split",
  diffDetailMode: "stacked",
}

export function normalizeDiffViewerPreferences(
  preferences: Partial<DiffViewerPreferences> | null | undefined
): DiffViewerPreferences {
  return {
    viewMode: isDiffViewMode(preferences?.viewMode) ? preferences.viewMode : "split",
    diffDetailMode: isDiffDetailMode(preferences?.diffDetailMode)
      ? preferences.diffDetailMode
      : "stacked",
  }
}

export function diffViewerPreferencesEqual(
  left: DiffViewerPreferences,
  right: DiffViewerPreferences
) {
  return left.viewMode === right.viewMode && left.diffDetailMode === right.diffDetailMode
}

function isDiffViewMode(value: unknown): value is DiffViewMode {
  return value === "split" || value === "unified"
}

function isDiffDetailMode(value: unknown): value is DiffDetailMode {
  return value === "stacked" || value === "fullFile"
}
