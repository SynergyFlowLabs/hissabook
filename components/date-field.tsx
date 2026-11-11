"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDay, parseDay, toDay, todayDay } from "@/lib/dates"
import { cn } from "@/lib/utils"

type DateFieldProps = {
  id?: string
  /** `yyyy-mm-dd`, the shape the rest of the app already uses. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** `yyyy-mm-dd` bounds: days outside them cannot be picked. */
  min?: string
  max?: string
  /** Offer a "Clear" action (optional dates only). */
  clearable?: boolean
  className?: string
  "aria-label"?: string
  "aria-describedby"?: string
}

/**
 * One date control for the whole product: a field-shaped button that opens the
 * calendar in a popover. Native `input[type=date]` was replaced because iOS
 * drew it with its own chrome (wrong width, value pinned to the top), Firefox
 * and Safari show different pickers, and none of them could follow the design
 * system. This keeps the exact form-field box, shows the same "11 Nov 2026"
 * everywhere, and the calendar underneath is keyboard accessible
 * (react-day-picker) with month and year jumps.
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  min,
  max,
  clearable = false,
  className,
  ...aria
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDay(value)
  const from = parseDay(min)
  const to = parseDay(max)

  const disabledDays =
    from || to ? { before: from ?? new Date(0), after: to ?? new Date(8640000000000000) } : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          className={cn("date-field-trigger", !selected && "is-placeholder", className)}
        >
          <span className="date-field-text">{selected ? formatDay(value) : placeholder}</span>
          <CalendarDays size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="date-field-popover" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(next) => {
            if (!next) return
            onChange(toDay(next))
            setOpen(false)
          }}
          disabled={disabledDays}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 5, 0)}
          endMonth={new Date(new Date().getFullYear() + 1, 11)}
          autoFocus
        />
        <div className="date-field-actions">
          <button
            type="button"
            className="date-field-shortcut"
            onClick={() => {
              onChange(todayDay())
              setOpen(false)
            }}
          >
            Today
          </button>
          {clearable ? (
            <button
              type="button"
              className="date-field-shortcut"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Clear
            </button>
          ) : null}
          <button type="button" className="date-field-shortcut is-muted" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
