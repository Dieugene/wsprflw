/**
 * Status badge component for displaying transcription status
 */

import { TranscriptionStatus } from '../types/api'

interface StatusBadgeProps {
  status: TranscriptionStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case TranscriptionStatus.PENDING:
        return {
          label: 'Ожидание',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        }
      case TranscriptionStatus.PROCESSING:
        return {
          label: 'Обработка',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse',
        }
      case TranscriptionStatus.COMPLETED:
        return {
          label: 'Завершено',
          className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        }
      case TranscriptionStatus.FAILED:
        return {
          label: 'Ошибка',
          className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        }
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        }
    }
  }

  const { label, className } = getStatusConfig()

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
