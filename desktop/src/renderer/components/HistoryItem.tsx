/**
 * History item component for displaying individual transcription in history list
 */

import { Eye, Trash2 } from 'lucide-react'
import { HistoryItemResponse } from '../types/api'
import { StatusBadge } from './StatusBadge'
import { formatDuration, formatRelativeTime } from '../utils/formatters'

interface HistoryItemProps {
  item: HistoryItemResponse
  onView: (id: string) => void
  onDelete: (id: string) => void
}

export function HistoryItem({ item, onView, onDelete }: HistoryItemProps) {
  return (
    <div className="border-b border-border py-4 hover:bg-accent/50 transition-colors">
      {/* Header: Filename, Duration, Status Badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">
            {item.audio_filename || 'Без названия'}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatDuration(item.audio_duration)}
            </span>
            <StatusBadge status={item.status} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1 ml-2">
          <button
            onClick={() => onView(item.id)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Посмотреть транскрипцию"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Text */}
      {(item.transcription_preview || item.formatted_preview) && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {item.formatted_preview || item.transcription_preview}
        </p>
      )}

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground">
        {formatRelativeTime(item.created_at)}
      </div>
    </div>
  )
}
