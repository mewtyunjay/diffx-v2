import { ArrowLeft, ArrowUp, MessageSquareText, Sparkles } from "lucide-react"
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"

import {
  BottomDockSurface,
  type DockSelectionItem,
  type DockState,
} from "@/components/diff/BottomDockSurface"
import { Button } from "@/components/ui/button"

type DiffViewerDockSharedProps = {
  state: DockState
  title: string
  summary?: string
  onHeaderClick: () => void
  className?: string
  style?: CSSProperties
}

type ChatDockProps = DiffViewerDockSharedProps & {
  mode: "chat"
  prompt: string
  onPromptChange: (value: string) => void
  auxiliaryContent?: ReactNode
}

type QuizDockProps = DiffViewerDockSharedProps & {
  mode: "quiz"
  question: string
  supportingText?: string
  options: DockSelectionItem[]
  selectedOptionId: string | null
  onSelectOption: (optionId: string) => void
  onReturnToChat: () => void
}

export type DiffViewerDockProps = ChatDockProps | QuizDockProps

function ChatDockComposer({
  prompt,
  onPromptChange,
}: Pick<ChatDockProps, "prompt" | "onPromptChange">) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    const nextHeight = Math.min(textarea.scrollHeight, 220)
    textarea.style.height = `${Math.max(nextHeight, 96)}px`
    textarea.style.overflowY = textarea.scrollHeight > 220 ? "auto" : "hidden"
  }, [prompt])

  return (
    <div className="surface-panel-strong overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="px-4 pt-4">
        <div className="surface-chip mb-3 inline-flex items-center gap-2 px-2.5 py-1 type-overline text-muted-foreground">
          <MessageSquareText className="size-3.5" />
          Chat
        </div>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={1}
          placeholder='Ask anything about this diff. "What changed here?"'
          className="w-full resize-none border-0 bg-transparent type-body text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <p className="type-meta text-muted-foreground">
          Prompt grows in place before it starts scrolling.
        </p>

        <Button
          type="button"
          size="icon-sm"
          disabled={!prompt.trim()}
          aria-label="Send prompt"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function DiffViewerDock(props: DiffViewerDockProps) {
  if (props.mode === "chat") {
    return (
      <BottomDockSurface
        title={props.title}
        summary={props.summary}
        state={props.state}
        onHeaderClick={props.onHeaderClick}
        className={props.className}
        style={props.style}
        auxiliaryContent={props.auxiliaryContent}
        compactContent={
          <ChatDockComposer prompt={props.prompt} onPromptChange={props.onPromptChange} />
        }
      />
    )
  }

  return (
    <BottomDockSurface
      title={props.title}
      summary={props.summary}
      state={props.state}
      onHeaderClick={props.onHeaderClick}
      className={props.className}
      style={props.style}
      expandedIntro={
        <div className="space-y-3">
          <div className="surface-chip-accent inline-flex items-center gap-2 px-2.5 py-1 type-overline text-primary">
            <Sparkles className="size-3.5" />
            Quiz
          </div>

          <div>
            <p className="type-title text-foreground">{props.question}</p>
            {props.supportingText ? (
              <p className="measure-readable mt-1 type-body text-muted-foreground">{props.supportingText}</p>
            ) : null}
          </div>
        </div>
      }
      selectionList={{
        ariaLabel: props.question,
        items: props.options,
        selectedItemId: props.selectedOptionId,
        onSelectItem: props.onSelectOption,
      }}
      expandedFooter={
        <div className="flex items-center justify-between gap-3">
          <p className="type-meta text-muted-foreground">
            {props.selectedOptionId
              ? "Answer captured. You can change it before moving on."
              : "Choose one option to continue."}
          </p>

          <Button type="button" size="sm" variant="ghost" onClick={props.onReturnToChat}>
            <ArrowLeft className="size-3.5" />
            Back to chat
          </Button>
        </div>
      }
    />
  )
}
