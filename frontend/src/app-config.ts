type AppConfig = {
  fontFamily?: string
}

const fontFamilyFallback = "var(--font-mono-base)"

export async function applyAppConfig() {
  let config: AppConfig
  try {
    const response = await fetch("/api/app-config")
    if (!response.ok) {
      return
    }
    config = (await response.json()) as AppConfig
  } catch {
    return
  }
  const fontFamily = config.fontFamily?.trim()
  if (!fontFamily) {
    return
  }

  document.documentElement.style.setProperty(
    "--font-mono-override",
    `${quoteFontFamily(fontFamily)}, ${fontFamilyFallback}`
  )
}

function quoteFontFamily(fontFamily: string) {
  return `"${fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}
