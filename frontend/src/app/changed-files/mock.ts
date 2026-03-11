export type ChangedFileStatus = "modified" | "added" | "deleted" | "renamed"

export type ChangedFileItem = {
  id: string
  path: string
  status: ChangedFileStatus
}

const statusCycle: ChangedFileStatus[] = [
  "modified",
  "added",
  "deleted",
  "renamed",
]

const folderMatrix = [
  {
    dir: "frontend",
    files: [
      "components.json",
      "eslint.config.js",
      "index.html",
      "package.json",
      "tsconfig.app.json",
      "tsconfig.json",
      "vite.config.ts",
    ],
  },
  {
    dir: "frontend/src",
    files: [
      "App.tsx",
      "main.tsx",
      "index.css",
      "env.d.ts",
      "router.tsx",
      "theme.ts",
    ],
  },
  {
    dir: "frontend/src/app/changed-files",
    files: [
      "data-source.ts",
      "filters.ts",
      "grouping.ts",
      "row-model.ts",
      "types.ts",
    ],
  },
  {
    dir: "frontend/src/app/diff",
    files: [
      "DiffCanvas.tsx",
      "DiffHeader.tsx",
      "DiffLayout.tsx",
      "DiffPanel.tsx",
      "DiffToolbar.tsx",
      "DiffView.tsx",
      "index.ts",
    ],
  },
  {
    dir: "frontend/src/app/review",
    files: [
      "ReviewHeader.tsx",
      "ReviewLayout.tsx",
      "ReviewQueue.tsx",
      "ReviewShell.tsx",
      "ReviewSummary.tsx",
      "index.ts",
    ],
  },
  {
    dir: "frontend/src/app/comments",
    files: [
      "CommentComposer.tsx",
      "CommentList.tsx",
      "CommentPanel.tsx",
      "CommentThread.tsx",
      "CommentToolbar.tsx",
      "index.ts",
    ],
  },
  {
    dir: "frontend/src/components",
    files: [
      "activity-feed.tsx",
      "app-sidebar.tsx",
      "change-empty.tsx",
      "diff-shell.tsx",
      "file-list.tsx",
      "repo-header.tsx",
      "site-header.tsx",
      "status-pill.tsx",
    ],
  },
  {
    dir: "frontend/src/components/panels",
    files: [
      "empty-panel.tsx",
      "file-detail-panel.tsx",
      "metrics-panel.tsx",
      "overview-panel.tsx",
      "review-panel.tsx",
      "selection-panel.tsx",
      "sidebar-bench-panel.tsx",
      "toolbar-panel.tsx",
    ],
  },
  {
    dir: "frontend/src/components/diff",
    files: [
      "diff-code.tsx",
      "diff-gutter.tsx",
      "diff-hunk.tsx",
      "diff-line.tsx",
      "diff-loading.tsx",
      "diff-overview.tsx",
      "diff-toolbar.tsx",
      "diff-viewer.tsx",
    ],
  },
  {
    dir: "frontend/src/components/file-tree",
    files: [
      "file-row.tsx",
      "folder-group.tsx",
      "selection-badge.tsx",
      "tree-header.tsx",
      "tree-row.tsx",
      "tree-search.tsx",
      "tree-stats.tsx",
    ],
  },
  {
    dir: "frontend/src/components/filters",
    files: [
      "filter-bar.tsx",
      "filter-chip.tsx",
      "filter-menu.tsx",
      "sort-menu.tsx",
      "status-filter.tsx",
    ],
  },
  {
    dir: "frontend/src/components/repo",
    files: [
      "branch-pill.tsx",
      "repo-empty.tsx",
      "repo-loading.tsx",
      "repo-picker.tsx",
      "repo-status.tsx",
      "working-tree.tsx",
    ],
  },
  {
    dir: "frontend/src/components/bench",
    files: [
      "bench-card.tsx",
      "bench-header.tsx",
      "bench-metric.tsx",
      "bench-panel.tsx",
      "bench-row.tsx",
      "bench-shell.tsx",
      "bench-sidebar.tsx",
      "bench-stats.tsx",
      "bench-summary.tsx",
      "bench-toolbar.tsx",
      "bench-trace.tsx",
      "bench-view.tsx",
      "perf-card.tsx",
      "render-meter.tsx",
    ],
  },
  {
    dir: "frontend/src/components/ui",
    files: [
      "button.tsx",
      "command.tsx",
      "dialog.tsx",
      "input.tsx",
      "popover.tsx",
      "scroll-area.tsx",
      "separator.tsx",
      "sidebar.tsx",
      "skeleton.tsx",
      "tooltip.tsx",
    ],
  },
  {
    dir: "frontend/src/hooks",
    files: [
      "use-changed-files.ts",
      "use-file-selection.ts",
      "use-panel-size.ts",
      "use-repo-state.ts",
    ],
  },
  {
    dir: "frontend/src/lib",
    files: [
      "cn.ts",
      "git-status.ts",
      "path-tree.ts",
      "perf.ts",
      "utils.ts",
    ],
  },
  {
    dir: "internal",
    files: [
      "go.mod",
      "go.sum",
      "main.go",
      "router.go",
      "server.go",
    ],
  },
  {
    dir: "internal/cmd/server",
    files: [
      "git_changes.go",
      "main.go",
      "routes.go",
      "watcher.go",
    ],
  },
  {
    dir: "internal/diff",
    files: [
      "file.go",
      "hunk.go",
      "line.go",
      "parser.go",
      "render.go",
      "summary.go",
      "tree.go",
    ],
  },
  {
    dir: "internal/git",
    files: [
      "changed_files.go",
      "porcelain.go",
      "repository.go",
      "status_parser.go",
      "working_tree.go",
    ],
  },
  {
    dir: "internal/indexer",
    files: [
      "cache.go",
      "events.go",
      "files.go",
      "index.go",
      "snapshot.go",
      "watcher.go",
    ],
  },
  {
    dir: "internal/httpapi",
    files: [
      "changed_files_handler.go",
      "errors.go",
      "middleware.go",
      "response.go",
      "server.go",
    ],
  },
  {
    dir: "scripts",
    files: [
      "bench-sidebar.mjs",
      "mock-files.mjs",
      "profile-render.mjs",
      "seed-worktree.mjs",
    ],
  },
]

function buildChangedFiles(): ChangedFileItem[] {
  let offset = 0

  return folderMatrix.flatMap(({ dir, files }) => {
    const items = files.map((file, index) => {
      const path = `${dir}/${file}`

      return {
        id: path,
        path,
        status: statusCycle[(offset + index) % statusCycle.length],
      }
    })

    offset += files.length
    return items
  })
}

export const mockChangedFiles = buildChangedFiles()
