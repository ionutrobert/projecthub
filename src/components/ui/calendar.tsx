"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col gap-4 sm:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        month_caption: cn("relative flex h-(--cell-size) items-center justify-center", defaultClassNames.month_caption),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-(--cell-size) p-0",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-(--cell-size) p-0",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("flex-1 select-none text-center text-[0.8rem] font-normal text-muted-foreground", defaultClassNames.weekday),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn("relative aspect-square w-full p-0 text-center", defaultClassNames.day),
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-(--cell-size) p-0 font-normal data-[selected=true]:opacity-100",
          defaultClassNames.day_button
        ),
        selected: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          defaultClassNames.selected
        ),
        range_start: cn("rounded-l-md bg-primary text-primary-foreground", defaultClassNames.range_start),
        range_middle: cn("rounded-none bg-primary/20 text-foreground", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-primary text-primary-foreground", defaultClassNames.range_end),
        today: cn("rounded-md border border-primary/50 bg-transparent text-foreground", defaultClassNames.today),
        outside: cn("text-muted-foreground opacity-50", defaultClassNames.outside),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          }
          return <ChevronDown className={cn("h-4 w-4", iconClassName)} {...iconProps} />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
