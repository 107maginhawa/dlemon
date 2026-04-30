"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/button"
import { Badge } from "@/components/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/popover"

export interface ComboboxOption {
  value: string
  label: string
  keywords?: string[]
  description?: string
  group?: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  multiSelect?: boolean
  disabled?: boolean
  className?: string
  maxHeight?: number
  showBadges?: boolean
  clearable?: boolean
  testId?: string
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  multiSelect = false,
  disabled = false,
  className,
  maxHeight = 300,
  showBadges = true,
  clearable = true,
  testId,
  id,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // Normalize value to array for consistent handling
  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // Group options if groups are provided
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, ComboboxOption[]> = {}
    const ungrouped: ComboboxOption[] = []

    options.forEach((option) => {
      if (option.group) {
        if (!groups[option.group]) {
          groups[option.group] = []
        }
        groups[option.group]!.push(option)
      } else {
        ungrouped.push(option)
      }
    })

    return { groups, ungrouped }
  }, [options])

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]
      onChange?.(newValues)
    } else {
      onChange?.(optionValue)
      setOpen(false)
    }
    setSearch("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(multiSelect ? [] : "")
  }

  const removeValue = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (multiSelect) {
      onChange?.(selectedValues.filter((v) => v !== valueToRemove))
    }
  }

  // Get display text for button
  const getButtonText = () => {
    if (selectedValues.length === 0) return placeholder

    if (!multiSelect) {
      const option = options.find((opt) => opt.value === selectedValues[0])
      return option?.label || selectedValues[0]
    }

    if (selectedValues.length === 1) {
      const option = options.find((opt) => opt.value === selectedValues[0])
      return option?.label || selectedValues[0]
    }

    return `${selectedValues.length} selected`
  }

  return (
    <div className="w-full">
      {multiSelect && showBadges && selectedValues.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedValues.map((val) => {
            const option = options.find((opt) => opt.value === val)
            return (
              <Badge
                key={val}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {option?.label || val}
                <button
                  type="button"
                  onClick={(e) => removeValue(val, e)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${option?.label || val}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={placeholder}
            className={cn(
              "w-full justify-between",
              !selectedValues.length && "text-muted-foreground",
              className
            )}
            disabled={disabled}
            data-testid={testId}
            id={id}
            aria-labelledby={ariaLabelledby}
            aria-describedby={ariaDescribedby}
            aria-invalid={ariaInvalid}
          >
            <span className="truncate">{getButtonText()}</span>
            <div className="ml-2 flex items-center gap-1">
              {clearable && selectedValues.length > 0 && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command filter={(value, search) => {
            // Custom filter function for fuzzy search
            const option = options.find(opt => opt.value === value)
            if (!option) return 0

            const searchLower = search.toLowerCase()
            const labelMatch = option.label.toLowerCase().includes(searchLower)
            const keywordMatch = option.keywords?.some(k =>
              k.toLowerCase().includes(searchLower)
            )
            const descriptionMatch = option.description?.toLowerCase().includes(searchLower)

            if (labelMatch) return 1
            if (keywordMatch || descriptionMatch) return 0.5
            return 0
          }}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
            <CommandList style={{ maxHeight: `${maxHeight}px` }}>
              <CommandEmpty>{emptyText}</CommandEmpty>

              {groupedOptions.ungrouped.length > 0 && (
                <CommandGroup>
                  {groupedOptions.ungrouped.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center justify-between"
                      data-testid={`${testId}-option-${option.value}`}
                    >
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          selectedValues.includes(option.value)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {Object.entries(groupedOptions.groups).map(([group, groupOptions]) => (
                <CommandGroup key={group} heading={group}>
                  {groupOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center justify-between"
                      data-testid={`${testId}-option-${option.value}`}
                    >
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          selectedValues.includes(option.value)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}