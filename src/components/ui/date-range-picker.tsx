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
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null)

  // Default to today if no date is selected
  const handleDefaultToday = () => {
    const today = startOfToday()
    const nextWeek = addDays(today, 7)
    const newDate = { from: today, to: nextWeek }
    onDateChange(newDate)
    setSelectedPreset("1week")
  }

  const handlePresetClick = (preset: typeof presets[number]) => {
    const newDate = preset.getValue()
    onDateChange(newDate)
    setSelectedPreset(preset.value)
    setOpen(false)
  }

  const handleDateSelect = (newDate: DateRange | undefined) => {
    onDateChange(newDate)
    setSelectedPreset(null)
    // Don't close - let user select end date
  }

  const formatDateRange = (date: DateRange | undefined) => {
    if (!date?.from) return placeholder
    if (!date.to) return `${format(date.from, "MMM d, yyyy")} (select end date)`
    if (format(date.from, "yyyy-MM-dd") === format(date.to, "yyyy-MM-dd")) {
      return format(date.from, "MMM d, yyyy")
    }
    return `${format(date.from, "MMM d")} - ${format(date.to, "MMM d, yyyy")}`
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
            "h-11 w-full justify-between bg-background hover:bg-accent hover:text-accent-foreground font-normal transition-colors",
            !date && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className={cn("truncate", !date && "text-muted-foreground")}>
              {formatDateRange(date)}
            </span>
          </span>
          <div className="flex items-center gap-1">
            {date?.from && !date?.to && (
              <span className="text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Start selected
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background" align="start">
        <div className="flex flex-col sm:flex-row">
          {/* Presets sidebar */}
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
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={1}
              className="[&_button]:h-11 [&_button]:w-11 text-base"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-9 w-9 bg-transparent p-0 hover:bg-accent rounded-md",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-11 font-normal text-[0.875rem]",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day: "h-11 w-11 p-0 font-normal hover:bg-accent rounded-md transition-colors",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "day-outside text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "bg-accent/50 text-accent-foreground rounded-none",
                day_hidden: "invisible",
              }}
            />
            
            {/* Selection info */}
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {date?.from ? (
                  date.to ? (
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
              {date?.from && date?.to && (
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
      </PopoverContent>
    </Popover>
  )
}
