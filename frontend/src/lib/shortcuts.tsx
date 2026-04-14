import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import { Kbd } from "@/components/ui/kbd"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isEditableElement, matchesShortcut, type ShortcutKey } from "@/lib/keyboard"

export type ShortcutScope = "global" | "diff" | "quiz" | "walkthrough"

type ShortcutDefinition = {
  id: string
  keys: readonly ShortcutKey[]
  label: string
  scope: ShortcutScope
  group: string
  allowInEditable?: boolean
}

export const SHORTCUTS = {
  prevFile: {
    id: "prevFile",
    keys: ["["],
    label: "Previous file",
    scope: "diff",
    group: "Diff navigation",
  },
  prevFileAlt: {
    id: "prevFileAlt",
    keys: ["h"],
    label: "Previous file",
    scope: "diff",
    group: "Diff navigation",
  },
  nextFile: {
    id: "nextFile",
    keys: ["]"],
    label: "Next file",
    scope: "diff",
    group: "Diff navigation",
  },
  nextFileAlt: {
    id: "nextFileAlt",
    keys: ["l"],
    label: "Next file",
    scope: "diff",
    group: "Diff navigation",
  },
  scrollFileUp: {
    id: "scrollFileUp",
    keys: ["k"],
    label: "Scroll file up",
    scope: "diff",
    group: "Diff navigation",
  },
  scrollFileDown: {
    id: "scrollFileDown",
    keys: ["j"],
    label: "Scroll file down",
    scope: "diff",
    group: "Diff navigation",
  },
  toggleExpandFile: {
    id: "toggleExpandFile",
    keys: ["f"],
    label: "Expand / collapse file",
    scope: "diff",
    group: "Diff actions",
  },
  toggleStage: {
    id: "toggleStage",
    keys: ["s"],
    label: "Stage / unstage file",
    scope: "diff",
    group: "Diff actions",
  },
  focusCommitMessage: {
    id: "focusCommitMessage",
    keys: ["shift", "c"],
    label: "Focus commit message",
    scope: "diff",
    group: "Git actions",
  },
  pushBranch: {
    id: "pushBranch",
    keys: ["shift", "p"],
    label: "Push current branch",
    scope: "diff",
    group: "Git actions",
  },
  sendToAgent: {
    id: "sendToAgent",
    keys: ["meta", "."],
    label: "Send to agent",
    scope: "diff",
    group: "Diff actions",
  },
  toggleSidebar: {
    id: "toggleSidebar",
    keys: ["meta", "b"],
    label: "Toggle sidebar",
    scope: "global",
    group: "Workspace",
    allowInEditable: true,
  },
  showHelp: {
    id: "showHelp",
    keys: ["shift", "/"],
    label: "Show keyboard shortcuts",
    scope: "global",
    group: "Workspace",
  },
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutId = keyof typeof SHORTCUTS

type ShortcutsContextValue = {
  activeModeScope: ShortcutScope | null
  setActiveModeScope: Dispatch<SetStateAction<ShortcutScope | null>>
  registerHandler: (id: ShortcutId, handler: () => void) => () => void
  helpOpen: boolean
  setHelpOpen: Dispatch<SetStateAction<boolean>>
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

function useShortcutsContext(): ShortcutsContextValue {
  const context = useContext(ShortcutsContext)
  if (!context) {
    throw new Error("Shortcut hooks must be used within <ShortcutsProvider>")
  }
  return context
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [activeModeScope, setActiveModeScope] = useState<ShortcutScope | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const handlersRef = useRef<Map<ShortcutId, () => void>>(new Map())

  const registerHandler = useCallback((id: ShortcutId, handler: () => void) => {
    handlersRef.current.set(id, handler)
    return () => {
      if (handlersRef.current.get(id) === handler) {
        handlersRef.current.delete(id)
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isEditableTarget = isEditableElement(event.target)

      for (const shortcut of Object.values(SHORTCUTS) as ShortcutDefinition[]) {
        if (isEditableTarget && !shortcut.allowInEditable) {
          continue
        }

        if (shortcut.scope !== "global" && shortcut.scope !== activeModeScope) {
          continue
        }

        if (!matchesShortcut(event, shortcut.keys)) continue

        const handler = handlersRef.current.get(shortcut.id as ShortcutId)
        if (!handler) continue

        event.preventDefault()
        handler()
        return
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeModeScope])

  const value = useMemo<ShortcutsContextValue>(
    () => ({
      activeModeScope,
      setActiveModeScope,
      registerHandler,
      helpOpen,
      setHelpOpen,
    }),
    [activeModeScope, helpOpen, registerHandler]
  )

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <ShortcutsHelpOverlay />
    </ShortcutsContext.Provider>
  )
}

export function useShortcut(id: ShortcutId, handler: () => void): void {
  const { registerHandler } = useShortcutsContext()

  useEffect(() => {
    return registerHandler(id, handler)
  }, [id, handler, registerHandler])
}

export function useScope(scope: Exclude<ShortcutScope, "global">): void {
  const { setActiveModeScope } = useShortcutsContext()

  useEffect(() => {
    setActiveModeScope(scope)
    return () => {
      setActiveModeScope((current) => (current === scope ? null : current))
    }
  }, [scope, setActiveModeScope])
}

function ShortcutsHelpOverlay() {
  const { helpOpen, setHelpOpen, activeModeScope } = useShortcutsContext()

  useShortcut("showHelp", () => setHelpOpen((open) => !open))

  const grouped = useMemo(() => {
    const byGroup = new Map<string, ShortcutDefinition[]>()
    for (const shortcut of Object.values(SHORTCUTS) as ShortcutDefinition[]) {
      const isActive = shortcut.scope === "global" || shortcut.scope === activeModeScope
      if (!isActive) continue
      const list = byGroup.get(shortcut.group) ?? []
      list.push(shortcut)
      byGroup.set(shortcut.group, list)
    }
    return Array.from(byGroup.entries())
  }, [activeModeScope])

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Kbd keys={["shift", "/"]} /> anytime to open this list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {grouped.map(([group, shortcuts]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <p className="type-overline text-muted-foreground">{group}</p>
              <ul className="flex flex-col gap-1">
                {shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 type-meta text-foreground"
                  >
                    <span>{shortcut.label}</span>
                    <Kbd keys={shortcut.keys} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
