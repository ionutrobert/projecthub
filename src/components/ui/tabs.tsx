"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs>")
  }
  return context
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: ReactNode
}) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const selectedValue = value ?? internalValue

  const setValue = useCallback((nextValue: string) => {
    if (onValueChange) {
      onValueChange(nextValue)
      return
    }
    setInternalValue(nextValue)
  }, [onValueChange])

  const contextValue = useMemo(() => ({ value: selectedValue, setValue }), [selectedValue, setValue])

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg border border-border bg-muted/40 p-1",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  const { value: selectedValue, setValue } = useTabsContext()
  const isActive = selectedValue === value

  return (
    <button
      type="button"
      role="tab"
      data-state={isActive ? "active" : "inactive"}
      aria-selected={isActive}
      aria-controls={`tab-content-${value}`}
      onClick={() => setValue(value)}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
        isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  const { value: selectedValue } = useTabsContext()
  if (selectedValue !== value) {
    return null
  }

  return (
    <div id={`tab-content-${value}`} role="tabpanel" className={className}>
      {children}
    </div>
  )
}
