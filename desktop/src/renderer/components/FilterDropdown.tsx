/**
 * Filter dropdown component for filtering transcriptions by status
 */

import { TranscriptionStatus } from '../types/api'

interface FilterDropdownProps {
  value: string
  onChange: (value: string) => void
}

export function FilterDropdown({ value, onChange }: FilterDropdownProps) {
  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: TranscriptionStatus.PENDING, label: 'Ожидание' },
    { value: TranscriptionStatus.PROCESSING, label: 'Обработка' },
    { value: TranscriptionStatus.COMPLETED, label: 'Завершено' },
    { value: TranscriptionStatus.FAILED, label: 'Ошибка' },
  ]

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
    >
      {statusOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
