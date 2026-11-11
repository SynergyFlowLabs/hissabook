"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"
import { cn } from "@/lib/utils"

/**
 * The product's calendar. react-day-picker ships the keyboard model, the month
 * grid and the accessible labels; everything visual is our own skin (see the
 * `.hisab-calendar` block in globals.css), so a date picker looks like the rest
 * of Hisaabook instead of like a library.
 */
function Calendar({
  className,
  showOutsideDays = true,
  weekStartsOn = 1,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={weekStartsOn}
      className={cn("hisab-calendar", className)}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon =
            orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown
          return <Icon size={15} strokeWidth={2.4} className={cn("rdp-chevron", chevronClassName)} {...chevronProps} />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
