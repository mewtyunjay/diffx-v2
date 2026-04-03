import type { ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  OctagonX,
} from "lucide-react"
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner"

import { cn } from "@/lib/utils"

const toastClassNames = {
  toast: cn(
    "group w-full max-w-[22rem] rounded-lg border bg-background p-3 text-foreground shadow-lg",
    "data-[swipe=move]:transition-none data-[swipe=cancel]:transition-[transform,opacity]",
    "data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0 data-[swipe=end]:slide-out-to-right-full",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-2",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-2"
  ),
  title: "type-meta leading-5 font-medium tracking-[-0.01em]",
  description: "type-meta text-muted-foreground",
  content: "flex flex-row items-center gap-2",
  icon: "text-current",
  success: "border-emerald-500/25 bg-background text-emerald-300",
  warning: "border-amber-500/25 bg-background text-amber-300",
  error: "border-rose-500/25 bg-background text-rose-300",
  loading: "border-amber-500/25 bg-background text-amber-300",
  closeButton: "hidden",
}

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      visibleToasts={3}
      offset={16}
      icons={{
        success: <CheckCircle2 className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
        error: <OctagonX className="size-4" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: toastClassNames,
      }}
      {...props}
    />
  )
}

function withToastDefaults(options?: ExternalToast): ExternalToast {
  return {
    duration: 3200,
    ...options,
  }
}

export const toast = {
  success(message: ReactNode, options?: ExternalToast) {
    return sonnerToast.success(message, withToastDefaults(options))
  },
  warning(message: ReactNode, options?: ExternalToast) {
    return sonnerToast.warning(message, withToastDefaults(options))
  },
  error(message: ReactNode, options?: ExternalToast) {
    return sonnerToast.error(message, withToastDefaults(options))
  },
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id)
  },
}
