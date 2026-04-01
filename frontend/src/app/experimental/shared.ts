export const STAGE_BACKDROP_OPTIONS = [
  { value: "blank", label: "Blank" },
  { value: "studio", label: "Studio" },
  { value: "grid", label: "Grid" },
] as const

export const STAGE_BACKGROUNDS = {
  blank: "bg-background",
  studio:
    "bg-[radial-gradient(circle_at_top,_rgba(71,85,105,0.16),_transparent_55%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,1))]",
  grid:
    "bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,1))] bg-[size:26px_26px,26px_26px,100%_100%]",
} as const

export type ExperimentalStageBackdrop = keyof typeof STAGE_BACKGROUNDS

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }

  return pathname
}

export function getExperimentalLinks(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  const usesDiffxPrefix = normalizedPathname.startsWith("/diffx/")

  return {
    diffViewer: usesDiffxPrefix ? "/diffx" : "/",
    dock: usesDiffxPrefix ? "/diffx/experimental" : "/experimental",
    sidebar: usesDiffxPrefix ? "/diffx/experimental/sidebar" : "/experimental/sidebar",
  }
}
