import * as React from "react"

import type { ChangedFileItem, ChangedFileStatus } from "@/app/changed-files/api"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CommandIcon } from "lucide-react"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  files: ChangedFileItem[]
  selectedFilePath: string | null
  onSelectFile: (path: string) => void
}

type ChangedFileListRow = ChangedFileItem & {
  displaySuffix: string
  fileName: string
}

type ChangedFileSections = {
  tracked: ChangedFileListRow[]
  untracked: ChangedFileListRow[]
}

const statusClassNames: Record<ChangedFileStatus, string> = {
  modified: "bg-amber-400",
  added: "bg-emerald-400",
  deleted: "bg-rose-400",
  renamed: "bg-sky-400",
}

type FilePathParts = {
  dirSegments: string[]
  fileName: string
}

function getFilePathParts(path: string): FilePathParts {
  const segments = path.split("/")
  const fileName = segments.at(-1) ?? path

  return {
    dirSegments: segments.slice(0, -1),
    fileName,
  }
}

function buildDuplicatePrefixes(files: ChangedFileItem[]) {
  const filesByName = new Map<
    string,
    Array<ChangedFileItem & FilePathParts>
  >()

  files.forEach((file) => {
    const parts = getFilePathParts(file.path)

    if (!filesByName.has(parts.fileName)) {
      filesByName.set(parts.fileName, [])
    }

    filesByName.get(parts.fileName)?.push({
      ...file,
      ...parts,
    })
  })

  const duplicatePrefixes = new Map<string, string>()

  filesByName.forEach((entries) => {
    if (entries.length === 1) {
      duplicatePrefixes.set(entries[0].id, "")
      return
    }

    const depths = entries.map((entry) =>
      entry.dirSegments.length > 0 ? 1 : 0
    )

    let hasCollision = true

    while (hasCollision) {
      const suffixes = entries.map((entry, index) => {
        const depth = depths[index]
        return depth === 0 ? "" : entry.dirSegments.slice(-depth).join("/")
      })

      const counts = new Map<string, number>()
      suffixes.forEach((suffix) => {
        counts.set(suffix, (counts.get(suffix) ?? 0) + 1)
      })

      hasCollision = false

      entries.forEach((entry, index) => {
        const suffix = suffixes[index]
        if (
          (counts.get(suffix) ?? 0) > 1 &&
          depths[index] < entry.dirSegments.length
        ) {
          depths[index] += 1
          hasCollision = true
        }
      })
    }

    entries.forEach((entry, index) => {
      const depth = depths[index]
      const suffix =
        depth === 0 ? "" : entry.dirSegments.slice(-depth).join("/")

      duplicatePrefixes.set(entry.id, suffix === "" ? "" : `${suffix}/`)
    })
  })

  return duplicatePrefixes
}

function buildChangedFileListRows(files: ChangedFileItem[]) {
  const duplicatePrefixes = buildDuplicatePrefixes(files)

  return files.map((file) => {
    const { fileName } = getFilePathParts(file.path)

    return {
      ...file,
      fileName,
      displaySuffix: duplicatePrefixes.get(file.id) ?? "",
    }
  }) satisfies ChangedFileListRow[]
}

function splitChangedFileSections(rows: ChangedFileListRow[]) {
  return rows.reduce<ChangedFileSections>(
    (sections, row) => {
      sections[row.isTracked ? "tracked" : "untracked"].push(row)
      return sections
    },
    {
      tracked: [],
      untracked: [],
    }
  )
}

export function AppSidebar({
  files,
  selectedFilePath,
  onSelectFile,
  ...props
}: AppSidebarProps) {
  const rows = React.useMemo(() => buildChangedFileListRows(files), [files])
  const sections = React.useMemo(() => splitChangedFileSections(rows), [rows])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">diffx</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pt-2">
          <p className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-[0.18em]">
            Changed files
          </p>
          <p className="mt-1 text-sm text-sidebar-foreground/70">
            {files.length} mocked changes
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {(
          [
            ["tracked", "Tracked"],
            ["untracked", "Untracked"],
          ] as const
        ).map(([sectionName, label]) => (
          <div key={sectionName} className="px-2 pb-3">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/55">
              {label}
            </p>
            <SidebarMenu>
              {sections[sectionName].map((file) => (
                <SidebarMenuItem key={file.id}>
                  <SidebarMenuButton
                    isActive={file.path === selectedFilePath}
                    onClick={() => onSelectFile(file.path)}
                    className="gap-2 rounded-lg"
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${statusClassNames[file.status]}`}
                    />
                    <span
                      className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden"
                      title={file.path}
                    >
                      <span className="shrink-0 font-medium text-sidebar-foreground">
                        {file.fileName}
                      </span>
                      {file.displaySuffix ? (
                        <span
                          dir="rtl"
                          className="min-w-0 shrink truncate text-xs text-sidebar-foreground/55"
                        >
                          ...{file.displaySuffix}
                        </span>
                      ) : null}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
