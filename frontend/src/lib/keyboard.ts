export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true

  if (target.isContentEditable) return true

  if (target.closest("[data-no-shortcuts]")) return true

  return false
}

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)

export type ModifierKey = "meta" | "ctrl" | "alt" | "shift"
export type ShortcutKey = ModifierKey | (string & {})

const MODIFIER_ORDER: Record<ModifierKey, number> = {
  ctrl: 0,
  alt: 1,
  shift: 2,
  meta: 3,
}

function isModifier(key: string): key is ModifierKey {
  return key === "meta" || key === "ctrl" || key === "alt" || key === "shift"
}

export function normalizeKeys(keys: readonly ShortcutKey[]): ShortcutKey[] {
  const modifiers: ModifierKey[] = []
  const literals: string[] = []

  for (const key of keys) {
    if (isModifier(key)) {
      modifiers.push(key)
    } else {
      literals.push(key)
    }
  }

  modifiers.sort((a, b) => MODIFIER_ORDER[a] - MODIFIER_ORDER[b])

  return [...modifiers, ...literals]
}

export function matchesShortcut(
  event: KeyboardEvent,
  keys: readonly ShortcutKey[]
): boolean {
  const wantMeta = keys.includes("meta")
  const wantCtrl = keys.includes("ctrl")
  const wantAlt = keys.includes("alt")
  const wantShift = keys.includes("shift")

  const metaOrCtrl = wantMeta || wantCtrl
  if (metaOrCtrl) {
    if (!(event.metaKey || event.ctrlKey)) return false
  } else {
    if (event.metaKey || event.ctrlKey) return false
  }

  if (wantAlt !== event.altKey) return false
  if (wantShift !== event.shiftKey) return false

  const literal = keys.find((key) => !isModifier(key))
  if (!literal) return true

  return event.key === literal || event.key.toLowerCase() === literal.toLowerCase()
}

export function formatKeyForDisplay(key: ShortcutKey): string {
  if (isMac) {
    switch (key) {
      case "meta":
        return "\u2318"
      case "ctrl":
        return "\u2303"
      case "alt":
        return "\u2325"
      case "shift":
        return "\u21e7"
    }
  } else {
    switch (key) {
      case "meta":
      case "ctrl":
        return "Ctrl"
      case "alt":
        return "Alt"
      case "shift":
        return "Shift"
    }
  }

  if (key.length === 1) return key.toUpperCase()

  switch (key) {
    case "ArrowUp":
      return "\u2191"
    case "ArrowDown":
      return "\u2193"
    case "ArrowLeft":
      return "\u2190"
    case "ArrowRight":
      return "\u2192"
    case "Enter":
      return "\u21b5"
    case "Escape":
      return "Esc"
    default:
      return key
  }
}
