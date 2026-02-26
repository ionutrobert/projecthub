"use client"

import * as React from "react"
import { format, addDays, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { CalendarDays, ChevronDown, Check } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type DateRangePickerProps = React.ComponentProps<"div"> & {
  date: DateRange | undefined
  onDateChange: (date: DateRange | undefined) => void
  placeholder?: string
  numberOfMonths?: 1 | 2
  showPresets?: boolean
}

const presets = [
  {
    label: "Today",
    value: "today",
    getValue: () => {
      const today = startOfToday()
      return { from: today, to: today }
    },
  },
  {
    label: "Tomorrow",
    value: "tomorrow",
    getValue: () => {
      const tomorrow = addDays(startOfToday(), 1)
      return { from: tomorrow, to: tomorrow }
    },
  },
  {
    label: "In 3 days",
    value: "3days",
    getValue: () => {
      const today = startOfToday()
      const future = addDays(today, 3)
      return { from: today, to: future }
    },
  },
  {
    label: "In 1 week",
    value: "1week",
    getValue: () => {
      const today = startOfToday()
      const week = addDays(today, 7)
      return { from: today, to: week }
    },
  },
  {
    label: "This Week",
    value: "thisWeek",
    getValue: () => {
      const today = startOfToday()
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
      return { from: weekStart, to: weekEnd }
    },
  },
  {
    label: "This Month",
    value: "thisMonth",
    getValue: () => {
      const today = startOfToday()
      const monthStart = startOfMonth(today)
      const monthEnd = endOfMonth(today)
      return { from: monthStart, to: monthEnd }
    },
  },
  {
    label: "Next Month",
    value: "nextMonth",
    getValue: () => {
      const today = startOfToday()
      const nextMonthStart = startOfMonth(addDays(endOfMonth(today), 1))
      const nextMonthEnd = endOfMonth(nextMonthStart)
      return { from: nextMonthStart, to: nextMonthEnd }
    },
  },
]

export function DateRangePicker({
  className,
  date,
  onDateChange,
  placeholder = "Select date range",
  numberOfMonths = 1,
  showPresets = true,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const fromSelected = Boolean(date?.from)
  const toSelected = Boolean(date?.to)

  // Default to today if no date is selected
  const handleDefaultToday = () => {
    const today = startOfToday()
    const nextWeek = addDays(today, 7)
    const newDate = { from: today, to: nextWeek }
    onDateChange(newDate)
  }

  const handlePresetClick = (preset: typeof presets[number]) => {
    const newDate = preset.getValue()
    onDateChange(newDate)
    setOpen(false)
  }

  const handleDateSelect = (newDate: DateRange | undefined) => {
    onDateChange(newDate)
    // Don't close - let user select end date
  }

  const formatDateRange = (date: DateRange | undefined) => {
    if (!date?.from) return placeholder
    if (!date.to) return `${format(date.from, "MMM d, yyyy")} (select end date)`
    if (format(date.from, "yyyy-MM-dd") === format(date.to, "yyyy-MM-dd")) {
      return format(date.from, "MMM d, yyyy")
    }
    return `${format(date.from, "MMM d, yyyy")} - ${format(date.to, "MMM d, yyyy")}`
  }

  const isPresetActive = (presetValue: string) => {
    if (!date?.from || !date?.to) return false
    const preset = presets.find(p => p.value === presetValue)
    if (!preset) return false
    const presetDate = preset.getValue()
    return (
      format(date.from, "yyyy-MM-dd") === format(presetDate.from, "yyyy-MM-dd") &&
      format(date.to, "yyyy-MM-dd") === format(presetDate.to, "yyyy-MM-dd")
    )
  }

  const handleOpenChange = (isOpen: boolean) => {
    // Prevent closing when only start date is selected
    if (!isOpen && date?.from && !date?.to) {
      return
    }
    setOpen(isOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 overflow-hidden bg-background px-2.5 font-normal transition-colors",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("min-w-0 truncate text-left", !date && "text-muted-foreground")}>
            {formatDateRange(date)}
          </span>
          {!toSelected && fromSelected && (
            <span className="hidden shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 sm:inline-flex">
              Select end
            </span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background" align="start">
        <div className="flex flex-col sm:flex-row">
          {showPresets && (
            <div className="border-r border-border/60 p-3 min-w-[150px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground px-1">Quick Select</p>
              </div>
              <div className="flex flex-col gap-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "justify-start font-normal text-xs h-8 px-2",
                      isPresetActive(preset.value)
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => handlePresetClick(preset)}
                  >
                    {isPresetActive(preset.value) && <Check className="mr-2 h-3 w-3" />}
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start font-normal text-xs h-8"
                  onClick={handleDefaultToday}
                >
                  <CalendarDays className="mr-2 h-3 w-3" />
                  Set to This Week
                </Button>
              </div>
            </div>
          )}

          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={numberOfMonths}
              pagedNavigation
              classNames={{
                months: cn(
                  "flex flex-col gap-4",
                  numberOfMonths === 2 && "sm:flex-row sm:gap-6"
                ),
              }}
            />

            {/* Selection info */}
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {fromSelected ? (
                  toSelected ? (
                    <span className="text-green-600 dark:text-green-400">
                      Range selected
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Select end date
                    </span>
                  )
                ) : (
                  <span>Select start date</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {fromSelected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDateChange(undefined)}
                    className="h-7 text-xs"
                  >
                    Clear dates
                  </Button>
                )}
                {fromSelected && toSelected && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="h-7 text-xs"
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
