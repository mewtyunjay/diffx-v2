import { CheckCircle2, Circle, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DiffViewerDockProgressItem = {
  id: string
  label: string
  description?: string
  done: boolean
}

type DiffViewerDockProgressProps = {
  items: DiffViewerDockProgressItem[]
  onToggleItem: (itemId: string) => void
  onOpenQuiz: () => void
}

export function DiffViewerDockProgress({
  items,
  onToggleItem,
  onOpenQuiz,
}: DiffViewerDockProgressProps) {
  const completedCount = items.filter((item) => item.done).length

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="type-title text-foreground type-data">
            {completedCount} of {items.length} checkpoints cleared
          </p>
          <p className="measure-readable mt-1 type-meta text-muted-foreground">
            Keep this slot for progress, notes, staging cues, or any other diff-scoped context.
          </p>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onOpenQuiz}>
          <Sparkles className="size-3.5" />
          Quick quiz
        </Button>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggleItem(item.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-[1rem] border px-3 py-2 text-left transition",
              item.done
                ? "border-primary/30 bg-primary/10"
                : "border-border/50 bg-background/35 hover:bg-background/55"
            )}
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {item.done ? (
                <CheckCircle2 className="size-4 text-primary" />
              ) : (
                <Circle className="size-4" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block type-meta font-medium text-foreground">{item.label}</span>
              {item.description ? (
                <span className="measure-readable mt-0.5 block type-meta text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
