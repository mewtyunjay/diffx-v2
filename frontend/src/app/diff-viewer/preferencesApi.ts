import {
  normalizeDiffViewerPreferences,
  type DiffViewerPreferences,
} from "@/app/diff-viewer/preferences"

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

export async function fetchDiffViewerPreferences(signal?: AbortSignal) {
  const response = await fetch("/api/settings/diff-viewer", { signal })
  return normalizeDiffViewerPreferences(await readJSON<DiffViewerPreferences>(response))
}

export async function updateDiffViewerPreferences(
  preferences: DiffViewerPreferences,
  signal?: AbortSignal
) {
  const response = await fetch("/api/settings/diff-viewer/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
    signal,
  })

  return normalizeDiffViewerPreferences(await readJSON<DiffViewerPreferences>(response))
}
