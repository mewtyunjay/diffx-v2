import { defaultIcon, getIcon } from "material-file-icons"

import { cn } from "@/lib/utils"

type FileIconProps = {
  path: string
  language?: string
  className?: string
}

const languageExtensionMap: Record<string, string> = {
  bash: "sh",
  mdx: "mdx",
  python: "py",
  ruby: "rb",
  rust: "rs",
  tsx: "tsx",
  yaml: "yaml",
}

export function FileTreeFileIcon({ path, language, className }: FileIconProps) {
  const icon = resolveFileIcon(path, language)

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center [&_svg]:block [&_svg]:size-4",
        className
      )}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  )
}

function resolveFileIcon(path: string, language?: string) {
  const fileName = path.split("/").at(-1) ?? path
  const icon = getIcon(fileName)
  if (icon.name !== defaultIcon.name) {
    return icon
  }

  const mappedLanguage = language ? languageExtensionMap[language.trim().toLowerCase()] : undefined
  if (mappedLanguage) {
    const fallbackIcon = getIcon(`file.${mappedLanguage}`)
    if (fallbackIcon.name !== defaultIcon.name) {
      return fallbackIcon
    }
  }

  return icon
}
