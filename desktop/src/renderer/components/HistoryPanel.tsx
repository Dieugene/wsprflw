/**
 * History panel component for displaying transcription history
 */

import { useEffect, useState } from 'react'
import { History, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useTranscriptionStore } from '../store/transcription.store'
import { HistoryItem } from './HistoryItem'
import { FilterDropdown } from './FilterDropdown'
import { useDebounce } from '../hooks/useDebounce'
import { toast } from 'sonner'

export function HistoryPanel() {
  const {
    history,
    historyTotal,
    historyPage,
    historyHasMore,
    isLoadingHistory,
    historySearch,
    historyStatusFilter,
    loadHistory,
    loadTranscriptionById,
    deleteHistoryItem,
    setHistorySearch,
    setHistoryStatusFilter,
  } = useTranscriptionStore()

  const [isExpanded, setIsExpanded] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(historySearch)

  // Debounce search input
  const debouncedSearch = useDebounce(searchInput, 300)

  useEffect(() => {
    // Load history on mount
    if (history.length === 0) {
      loadHistory(1)
    }
  }, [])

  // Handle debounced search changes
  useEffect(() => {
    setHistorySearch(debouncedSearch)
    loadHistory(1, debouncedSearch, historyStatusFilter)
  }, [debouncedSearch])

  // Handle filter changes
  const handleFilterChange = (filter: string) => {
    setHistoryStatusFilter(filter)
    loadHistory(1, debouncedSearch, filter)
  }

  const handleView = async (id: string) => {
    try {
      await loadTranscriptionById(id)
      // Scroll to top to see the transcription
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success('Транскрипция загружена')
    } catch (error) {
      console.error('Failed to load transcription:', error)
      toast.error('Не удалось загрузить транскрипцию')
    }
  }

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmId) return

    try {
      await deleteHistoryItem(deleteConfirmId)
      toast.success('Транскрипция удалена')
      setDeleteConfirmId(null)
    } catch (error) {
      console.error('Failed to delete history item:', error)
      toast.error('Не удалось удалить транскрипцию')
    }
  }

  const cancelDelete = () => {
    setDeleteConfirmId(null)
  }

  const handleLoadMore = async () => {
    try {
      await loadHistory(historyPage + 1)
    } catch (error) {
      console.error('Failed to load more history:', error)
      toast.error('Не удалось загрузить больше записей')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" />
          <h2 className="text-xl font-semibold">История транскрипций</h2>
          <span className="text-sm text-muted-foreground">({historyTotal})</span>
        </div>
        <button className="p-2 hover:bg-accent rounded-md transition-colors">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Content (collapsible) */}
      {isExpanded && (
        <>
          {/* Search and Filter */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Поиск по имени файла или тексту..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
            </div>
            <FilterDropdown value={historyStatusFilter} onChange={handleFilterChange} />
          </div>

          {/* Loading skeleton */}
          {isLoadingHistory && history.length === 0 && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-secondary rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-secondary rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-secondary rounded w-full"></div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoadingHistory && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Нет транскрипций</h3>
              <p className="text-sm text-muted-foreground">
                Начните запись или загрузите аудио файл, чтобы создать первую транскрипцию
              </p>
            </div>
          )}

          {/* History list */}
          {history.length > 0 && (
            <div>
              {history.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  onView={handleView}
                  onDelete={handleDelete}
                />
              ))}

              {/* Load more button */}
              {historyHasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingHistory}
                    className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingHistory ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Загрузка...
                      </span>
                    ) : (
                      `Загрузить еще (показано ${history.length} из ${historyTotal})`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Подтвердите удаление</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Вы уверены, что хотите удалить эту транскрипцию? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
