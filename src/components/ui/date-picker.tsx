"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarDays, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type DatePickerProps = React.ComponentProps<"div"> & {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({
  className,
  date,
  onDateChange,
  placeholder = "Select date",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleDateSelect = (newDate: Date | undefined) => {
    onDateChange(newDate)
    if (newDate) {
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDateChange(undefined)
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return placeholder
    return format(date, "MMM d, yyyy")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-between bg-background hover:bg-accent hover:text-accent-foreground font-normal transition-colors",
            !date && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className={cn("truncate", !date && "text-muted-foreground")}>
              {formatDate(date)}
            </span>
          </span>
          {date ? (
            <X 
              className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" 
              onClick={handleClear}
            />
          ) : (
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          className="[&_button]:h-10 [&_button]:w-10 text-base"
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
            day: "h-10 w-10 p-0 font-normal hover:bg-accent rounded-md transition-colors",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "day-outside text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
