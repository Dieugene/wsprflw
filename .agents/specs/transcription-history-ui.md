# Technical Specification: Transcription History UI

**Feature**: Transcription History Panel with Search, View, and Delete functionality
**Author**: Architect Agent
**Date**: 2025-11-13
**Status**: Design Phase

---

## 1. Overview

### 1.1 Purpose
Add a History Panel to the WhisperFlow desktop application that displays a paginated list of past transcriptions, allowing users to view, search, filter, and delete history items.

### 1.2 Scope
- **Frontend**: New HistoryPanel component with list view, search/filter, and item actions
- **State Management**: Enhanced Zustand store with history selection, deletion, and search state
- **API Integration**: New API methods for deleting history items and fetching single transcription details
- **Real-time Updates**: Automatic history refresh when new transcription completes

### 1.3 Design Goals
- Seamless integration with existing UI layout (RecordingPanel, TranscriptionView, FormattingPanel)
- Efficient pagination to handle large history lists
- Responsive design matching current Tailwind CSS patterns
- Minimal API calls through smart caching and real-time updates

---

## 2. Architecture Overview

### 2.1 Component Hierarchy

```
App.tsx
├── RecordingPanel
├── TranscriptionView
├── FormattingPanel
└── HistoryPanel (NEW)
    ├── HistoryHeader
    │   ├── SearchBar
    │   └── FilterDropdown (status filter)
    ├── HistoryList
    │   └── HistoryItem[] (repeated)
    │       ├── ItemHeader (filename, duration, status badge)
    │       ├── ItemPreview (text preview)
    │       ├── ItemMetadata (timestamp, format type)
    │       └── ItemActions (view, delete buttons)
    └── HistoryPagination
        ├── LoadMoreButton
        └── PageInfo (showing X-Y of Z items)
```

### 2.2 Data Flow Diagram

```
┌─────────────────┐
│  HistoryPanel   │
│   Component     │
└────────┬────────┘
         │
         │ 1. User actions (load, search, delete, view)
         │
         ▼
┌─────────────────────────┐
│  transcription.store.ts │ ◄────── 4. Real-time update
│  (Zustand State)        │         from WebSocket
└────────┬────────────────┘
         │
         │ 2. API calls
         │
         ▼
┌─────────────────┐
│  api.service.ts │
└────────┬────────┘
         │
         │ 3. HTTP requests
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  /api/v1/...    │
└─────────────────┘
```

### 2.3 State Flow

```
Initial Load:
User opens app → HistoryPanel mounts → loadHistory(page: 1) →
Store updates (history, historyTotal, historyHasMore) → UI renders list

Search/Filter:
User types search → debounced search handler → setHistorySearch() →
loadHistory(page: 1) → Store updates with filtered results

Pagination:
User clicks "Load More" → loadHistory(page: historyPage + 1, append: true) →
Store appends new items to existing list

View Item:
User clicks "View" → loadTranscriptionById(id) →
Store updates currentJobId, transcriptionText, formattedText →
TranscriptionView and FormattingPanel display data

Delete Item:
User clicks "Delete" → Confirm dialog → deleteHistoryItem(id) →
Backend deletes → Store removes item from list → UI updates

Real-time Update:
Transcription completes → WebSocket message →
Store increments historyTotal → Auto-refresh first page if user on page 1
```

---

## 3. Frontend Component Design

### 3.1 HistoryPanel Component

**File**: `/home/user/wsprflw/desktop/src/renderer/components/HistoryPanel.tsx`

**Props**: None (uses Zustand store)

**State**:
- `searchQuery: string` (local state, debounced)
- `statusFilter: TranscriptionStatus | 'all'` (local state)
- `showDeleteConfirm: string | null` (item ID to delete)

**Key Features**:
- Collapsible panel (starts collapsed to save space)
- Search input with debounce (300ms)
- Status filter dropdown (All, Pending, Processing, Completed, Failed)
- Virtualized list for performance (react-window or similar)
- Loading skeleton while fetching
- Empty state with friendly message

**UI Layout** (Tailwind CSS):
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  <HistoryHeader
    searchQuery={searchQuery}
    onSearchChange={handleSearchChange}
    statusFilter={statusFilter}
    onFilterChange={setStatusFilter}
    totalItems={historyTotal}
  />

  <HistoryList
    items={filteredItems}
    onView={handleViewItem}
    onDelete={handleDeleteItem}
    isLoading={isLoadingHistory}
  />

  <HistoryPagination
    hasMore={historyHasMore}
    onLoadMore={handleLoadMore}
    currentCount={history.length}
    totalCount={historyTotal}
    isLoading={isLoadingHistory}
  />
</div>
```

### 3.2 HistoryItem Component

**File**: `/home/user/wsprflw/desktop/src/renderer/components/HistoryItem.tsx`

**Props**:
```typescript
interface HistoryItemProps {
  item: HistoryItemResponse
  onView: (id: string) => void
  onDelete: (id: string) => void
}
```

**UI Structure**:
```tsx
<div className="border-b border-border py-4 hover:bg-accent/50 transition-colors">
  {/* Header: Filename, Duration, Status Badge */}
  <div className="flex items-start justify-between mb-2">
    <div className="flex-1">
      <h4 className="font-medium text-sm truncate">
        {item.audio_filename || 'Untitled Recording'}
      </h4>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground">
          {formatDuration(item.audio_duration)}
        </span>
        <StatusBadge status={item.status} />
        {item.format_type && (
          <FormatTypeBadge type={item.format_type} />
        )}
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex gap-1 ml-2">
      <button
        onClick={() => onView(item.id)}
        className="p-2 hover:bg-accent rounded-md transition-colors"
        title="View transcription"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className="p-2 hover:bg-destructive/10 text-destructive rounded-md transition-colors"
        title="Delete"
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
```

**Status Badge Styles**:
- `pending`: Yellow/Amber
- `processing`: Blue with animated pulse
- `completed`: Green
- `failed`: Red

### 3.3 Helper Components

#### SearchBar Component
```typescript
interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}
```

#### FilterDropdown Component
```typescript
interface FilterDropdownProps {
  value: TranscriptionStatus | 'all'
  onChange: (value: TranscriptionStatus | 'all') => void
}
```

#### DeleteConfirmDialog Component
```typescript
interface DeleteConfirmDialogProps {
  isOpen: boolean
  itemId: string
  itemName: string
  onConfirm: (id: string) => void
  onCancel: () => void
}
```

---

## 4. State Management Design

### 4.1 Enhanced Zustand Store

**File**: `/home/user/wsprflw/desktop/src/renderer/store/transcription.store.ts`

**New State Properties**:
```typescript
interface TranscriptionState {
  // ... existing properties ...

  // History state (enhanced)
  history: HistoryItemResponse[]
  historyTotal: number
  historyPage: number
  historyHasMore: boolean
  historySearch: string              // NEW
  historyStatusFilter: TranscriptionStatus | 'all'  // NEW
  isLoadingHistory: boolean          // NEW
  selectedHistoryItem: string | null // NEW (for view mode)

  // ... existing actions ...

  // History actions (enhanced)
  loadHistory: (page?: number, append?: boolean) => Promise<void>
  setHistorySearch: (search: string) => void          // NEW
  setHistoryStatusFilter: (filter: TranscriptionStatus | 'all') => void  // NEW
  loadTranscriptionById: (id: string) => Promise<void>  // NEW
  deleteHistoryItem: (id: string) => Promise<void>    // NEW
  refreshHistoryOnComplete: () => void                // NEW
}
```

### 4.2 Store Implementation Details

#### loadHistory (Enhanced)
```typescript
loadHistory: async (page: number = 1, append: boolean = false) => {
  const { historySearch, historyStatusFilter } = get()

  try {
    set({ isLoadingHistory: true })

    const response = await apiService.getHistory(
      page,
      20,
      historySearch,
      historyStatusFilter === 'all' ? undefined : historyStatusFilter
    )

    set({
      history: append
        ? [...get().history, ...response.items]
        : response.items,
      historyTotal: response.total,
      historyPage: response.page,
      historyHasMore: response.has_more,
      isLoadingHistory: false,
    })
  } catch (error) {
    console.error('Failed to load history:', error)
    set({ isLoadingHistory: false })
    throw error
  }
}
```

#### setHistorySearch
```typescript
setHistorySearch: (search: string) => {
  set({ historySearch: search })
  // Debounced loadHistory will be called from component
}
```

#### setHistoryStatusFilter
```typescript
setHistoryStatusFilter: (filter: TranscriptionStatus | 'all') => {
  set({ historyStatusFilter: filter, historyPage: 1 })
  get().loadHistory(1, false)
}
```

#### loadTranscriptionById (NEW)
```typescript
loadTranscriptionById: async (id: string) => {
  try {
    const result = await apiService.getTranscription(id)

    set({
      currentJobId: result.id,
      transcriptionStatus: result.status,
      transcriptionText: result.transcription_text,
      selectedHistoryItem: id,
    })

    // Load formatted text if available
    if (result.formatted_text) {
      set({
        formattedText: result.formatted_text,
        formatType: result.format_type,
      })
    }
  } catch (error) {
    console.error('Failed to load transcription:', error)
    throw error
  }
}
```

#### deleteHistoryItem (NEW)
```typescript
deleteHistoryItem: async (id: string) => {
  try {
    await apiService.deleteHistoryItem(id)

    // Remove from local state
    const { history, historyTotal } = get()
    set({
      history: history.filter(item => item.id !== id),
      historyTotal: historyTotal - 1,
    })

    // Reload page if list is now empty and we're not on page 1
    const { history: updatedHistory, historyPage } = get()
    if (updatedHistory.length === 0 && historyPage > 1) {
      get().loadHistory(historyPage - 1, false)
    }
  } catch (error) {
    console.error('Failed to delete history item:', error)
    throw error
  }
}
```

#### refreshHistoryOnComplete (NEW)
```typescript
refreshHistoryOnComplete: () => {
  const { historyPage, historySearch, historyStatusFilter } = get()

  // Only auto-refresh if on page 1 with no filters
  // Otherwise, just increment the total count
  if (historyPage === 1 && !historySearch && historyStatusFilter === 'all') {
    get().loadHistory(1, false)
  } else {
    set({ historyTotal: get().historyTotal + 1 })
  }
}
```

### 4.3 WebSocket Integration

**Update existing WebSocket handler** to call `refreshHistoryOnComplete()` when transcription completes:

```typescript
// In connectWebSocket() message handler
if (message.type === 'transcription_completed') {
  set({
    transcriptionStatus: 'completed',
    transcriptionProgress: 100,
    transcriptionText: message.transcription_text,
  })
  get().disconnectWebSocket()
  get().refreshHistoryOnComplete()  // NEW: Refresh history
}
```

---

## 5. API Service Design

### 5.1 New API Methods

**File**: `/home/user/wsprflw/desktop/src/renderer/services/api.service.ts`

#### getHistory (Enhanced)
```typescript
/**
 * Get transcription history with search and filter support
 */
async getHistory(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  statusFilter?: TranscriptionStatus
): Promise<HistoryListResponse> {
  const params: Record<string, any> = {
    page,
    page_size: pageSize
  }

  if (search) {
    params.search = search
  }
  if (statusFilter) {
    params.status = statusFilter
  }

  const { data } = await this.client.get<HistoryListResponse>(
    '/api/v1/history',
    { params }
  )
  return data
}
```

#### deleteHistoryItem (NEW)
```typescript
/**
 * Delete a history item by ID
 */
async deleteHistoryItem(id: string): Promise<void> {
  await this.client.delete(`/api/v1/history/${id}`)
}
```

### 5.2 Backend API Requirements

The Developer agent will need to implement the following backend endpoints:

#### DELETE /api/v1/history/{id}
```python
@router.delete(
    "/history/{transcription_id}",
    status_code=204,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Delete transcription history item",
    description="Delete a transcription and all associated data",
)
async def delete_history_item(
    transcription_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a transcription history item

    - **transcription_id**: UUID of transcription to delete
    """
```

#### GET /api/v1/history (Enhanced)
Add optional query parameters to existing endpoint:
- `search: Optional[str]` - Search in audio_filename and transcription_text
- `status: Optional[TranscriptionStatus]` - Filter by status

---

## 6. UI/UX Considerations

### 6.1 Layout Integration

**Current Layout**:
```
┌─────────────────────────────────┐
│      RecordingPanel             │
├─────────────┬───────────────────┤
│Transcription│   Formatting      │
│    View     │     Panel         │
└─────────────┴───────────────────┘
```

**New Layout**:
```
┌─────────────────────────────────┐
│      RecordingPanel             │
├─────────────┬───────────────────┤
│Transcription│   Formatting      │
│    View     │     Panel         │
├─────────────┴───────────────────┤
│      HistoryPanel (collapsible) │
└─────────────────────────────────┘
```

**App.tsx Changes**:
```tsx
<main className="space-y-6">
  {/* Recording Panel */}
  <RecordingPanel />

  {/* Transcription and Formatting */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <TranscriptionView />
    <FormattingPanel />
  </div>

  {/* History Panel - NEW */}
  <HistoryPanel />

  {/* Instructions */}
  <div className="rounded-lg border border-border bg-card p-6">
    {/* ... existing instructions ... */}
  </div>
</main>
```

### 6.2 Responsive Design

**Desktop (lg+)**:
- Full width history panel below transcription/formatting grid
- Show all columns in history items
- Search bar and filter side by side

**Tablet (md)**:
- Stacked transcription/formatting panels
- Full width history panel
- Compact history items

**Mobile (sm)**:
- All panels stacked vertically
- Simplified history items (hide some metadata)
- Search and filter stacked vertically

### 6.3 User Interactions

#### View Transcription Flow
1. User clicks "View" button on history item
2. Scroll to top of page (smooth scroll)
3. TranscriptionView and FormattingPanel populate with selected data
4. Visual indicator shows which history item is currently viewed
5. Toast notification: "Loaded transcription from {date}"

#### Delete Transcription Flow
1. User clicks "Delete" button on history item
2. Confirm dialog appears: "Delete this transcription? This action cannot be undone."
3. User confirms → API call → Item fades out → Success toast
4. User cancels → Dialog closes, no action taken
5. If delete fails → Error toast with retry option

#### Search Flow
1. User types in search box (debounced 300ms)
2. Loading indicator appears in history list
3. Results update
4. If no results: Show empty state "No transcriptions found for '{query}'"
5. Search is cleared → Original list reloads

#### Pagination Flow
1. Initial load shows first 20 items
2. User scrolls to bottom
3. "Load More" button appears (if hasMore)
4. User clicks → Button shows loading spinner
5. New items append to list
6. Button updates to show "Showing 40 of 127 items"

### 6.4 Loading States

**Initial Load**:
- Show 5 skeleton items (animated gray boxes)
- Skeleton mimics structure: filename line, preview text lines, metadata line

**Pagination Load**:
- "Load More" button shows spinner
- Button is disabled during load
- New items fade in smoothly

**Search/Filter**:
- Show loading overlay on existing list
- Semi-transparent background with spinner

### 6.5 Empty States

**No History**:
```
┌─────────────────────────────────┐
│    📝 No transcriptions yet     │
│                                 │
│  Start recording or upload an  │
│  audio file to create your     │
│  first transcription!          │
└─────────────────────────────────┘
```

**No Search Results**:
```
┌─────────────────────────────────┐
│    🔍 No results found          │
│                                 │
│  No transcriptions match        │
│  "{search query}"               │
│                                 │
│  [Clear Search]                 │
└─────────────────────────────────┘
```

**No Results for Filter**:
```
┌─────────────────────────────────┐
│    📭 No {status} transcriptions│
│                                 │
│  Try selecting a different      │
│  status filter                  │
└─────────────────────────────────┘
```

### 6.6 Accessibility

- Keyboard navigation support (Tab, Enter, Escape)
- ARIA labels for all interactive elements
- Focus indicators on buttons and inputs
- Screen reader announcements for dynamic updates
- Semantic HTML structure

---

## 7. Error Handling Strategy

### 7.1 Error Types and Handling

#### Network Errors
**Scenario**: Backend is unreachable
**Handling**:
- Show error toast: "Cannot connect to server. Please check your connection."
- Display error state in history panel with retry button
- Auto-retry after 5 seconds (max 3 attempts)

#### 404 Not Found
**Scenario**: History item or transcription doesn't exist
**Handling**:
- Show error toast: "This transcription no longer exists"
- Remove item from local state
- Refresh history list

#### 500 Internal Server Error
**Scenario**: Server error during delete or fetch
**Handling**:
- Show error toast: "Server error. Please try again later."
- Keep item in list (don't remove optimistically)
- Provide retry button in toast

#### Deletion Conflicts
**Scenario**: Item is being used/processed during delete attempt
**Handling**:
- Show error toast: "Cannot delete active transcription"
- Item remains in list

#### Search/Filter Timeout
**Scenario**: Search query takes too long
**Handling**:
- Show warning after 10 seconds: "Search is taking longer than expected..."
- Allow user to cancel operation
- Log timeout for debugging

### 7.2 Error Recovery Mechanisms

#### Optimistic Updates
```typescript
// For deletion
deleteHistoryItem: async (id: string) => {
  const { history } = get()
  const itemIndex = history.findIndex(item => item.id === id)
  const deletedItem = history[itemIndex]

  // Optimistically remove from UI
  set({
    history: history.filter(item => item.id !== id),
    historyTotal: get().historyTotal - 1,
  })

  try {
    await apiService.deleteHistoryItem(id)
    toast.success('Transcription deleted')
  } catch (error) {
    // Rollback on error
    set({
      history: [
        ...history.slice(0, itemIndex),
        deletedItem,
        ...history.slice(itemIndex),
      ],
      historyTotal: get().historyTotal + 1,
    })
    toast.error('Failed to delete transcription')
    throw error
  }
}
```

#### Retry Logic
```typescript
// With exponential backoff
const retryWithBackoff = async (
  fn: () => Promise<any>,
  maxRetries: number = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      )
    }
  }
}
```

### 7.3 Error Logging

All errors should be logged with context:
```typescript
logger.error('History operation failed', {
  operation: 'delete' | 'load' | 'search',
  itemId: id,
  error: error.message,
  timestamp: new Date().toISOString(),
})
```

---

## 8. Performance Considerations

### 8.1 Optimization Strategies

#### Virtual Scrolling
- Implement `react-window` or `react-virtual` for large lists
- Only render visible items + buffer
- Significantly improves performance for 100+ items

#### Debounced Search
```typescript
const [searchQuery, setSearchQuery] = useState('')
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    setHistorySearch(value)
    loadHistory(1, false)
  }, 300),
  []
)

const handleSearchChange = (value: string) => {
  setSearchQuery(value)
  debouncedSearch(value)
}
```

#### Memoized Filtering
```typescript
const filteredItems = useMemo(() => {
  return history.filter(item => {
    const matchesStatus =
      historyStatusFilter === 'all' ||
      item.status === historyStatusFilter

    const matchesSearch =
      !historySearch ||
      item.audio_filename?.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.transcription_preview?.toLowerCase().includes(historySearch.toLowerCase())

    return matchesStatus && matchesSearch
  })
}, [history, historyStatusFilter, historySearch])
```

#### Lazy Loading Images (if thumbnails are added later)
```typescript
<img
  src={item.thumbnail}
  loading="lazy"
  alt="Audio waveform"
/>
```

### 8.2 Caching Strategy

#### Store Cache
- Keep last 60 items in memory
- LRU cache for viewed transcription details
- Cache duration: 5 minutes

#### API Response Caching
- Cache GET requests in axios with cache adapter
- Invalidate cache on POST/DELETE operations
- Use ETag headers if backend supports

### 8.3 Bundle Size

**Estimated Component Size**:
- HistoryPanel: ~8 KB
- HistoryItem: ~3 KB
- Helper components: ~5 KB
- Total: ~16 KB (minified + gzipped)

**Dependencies**:
- `react-window`: +6 KB (if used for virtualization)
- No additional dependencies needed

---

## 9. Testing Requirements

### 9.1 Unit Tests

**Store Tests** (`transcription.store.test.ts`):
```typescript
describe('History Store', () => {
  test('loadHistory should fetch and update state', async () => {
    // Test implementation
  })

  test('deleteHistoryItem should remove item from list', async () => {
    // Test optimistic update and rollback
  })

  test('setHistorySearch should update search state', () => {
    // Test search state update
  })

  test('refreshHistoryOnComplete should reload if on page 1', async () => {
    // Test real-time update logic
  })
})
```

**Component Tests** (`HistoryPanel.test.tsx`):
```typescript
describe('HistoryPanel', () => {
  test('renders history items correctly', () => {
    // Test rendering with mock data
  })

  test('handles search input with debounce', async () => {
    // Test search functionality
  })

  test('shows empty state when no items', () => {
    // Test empty state
  })

  test('calls onView when view button clicked', () => {
    // Test view action
  })

  test('shows delete confirmation dialog', () => {
    // Test delete flow
  })
})
```

### 9.2 Integration Tests

**End-to-End Flow**:
1. Load history on mount
2. Search for specific transcription
3. Filter by status
4. View transcription details
5. Delete transcription
6. Verify real-time update after new transcription

### 9.3 Manual Testing Checklist

- [ ] History loads on first visit
- [ ] Pagination works (loads more items)
- [ ] Search filters items correctly
- [ ] Status filter works for all statuses
- [ ] View button loads transcription into main view
- [ ] Delete button shows confirmation
- [ ] Delete removes item and updates count
- [ ] Real-time update adds new item when transcription completes
- [ ] Loading states display correctly
- [ ] Error states display with retry option
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Keyboard navigation works
- [ ] Screen reader announces updates

---

## 10. Implementation Phases

### Phase 1: Basic History Display (MVP)
**Estimated Time**: 4-6 hours

**Tasks**:
1. Create HistoryPanel component with basic list view
2. Create HistoryItem component with view/delete buttons
3. Enhance store with `loadTranscriptionById` and `deleteHistoryItem`
4. Add `deleteHistoryItem` API method
5. Integrate HistoryPanel into App.tsx
6. Basic styling with Tailwind CSS

**Deliverables**:
- Functional history list with view and delete
- Pagination support
- Basic error handling

### Phase 2: Search and Filter (Enhancement)
**Estimated Time**: 3-4 hours

**Tasks**:
1. Add search bar component
2. Add status filter dropdown
3. Implement debounced search in store
4. Update API service to support search/filter params
5. Backend API enhancement (search & filter)

**Deliverables**:
- Working search functionality
- Status filter dropdown
- Enhanced backend API

### Phase 3: Real-time Updates (Enhancement)
**Estimated Time**: 2-3 hours

**Tasks**:
1. Implement `refreshHistoryOnComplete` in store
2. Update WebSocket handler to call refresh
3. Add visual notification for new items

**Deliverables**:
- Real-time history updates
- Smooth UI transitions

### Phase 4: Polish and Optimization (Final)
**Estimated Time**: 3-4 hours

**Tasks**:
1. Add loading skeletons
2. Improve empty states
3. Add animations and transitions
4. Optimize performance (memoization, virtual scrolling)
5. Accessibility improvements
6. Write tests

**Deliverables**:
- Polished UI with animations
- Optimized performance
- Full test coverage
- Accessibility compliance

**Total Estimated Time**: 12-17 hours

---

## 11. Acceptance Criteria

### Functional Requirements
- [ ] History panel displays list of past transcriptions
- [ ] Each item shows: filename, duration, status, preview text, timestamp
- [ ] User can view full transcription by clicking "View" button
- [ ] User can delete history items with confirmation
- [ ] Search functionality filters by filename and text content
- [ ] Status filter works for all transcription statuses
- [ ] Pagination loads 20 items per page
- [ ] "Load More" button appears when more items available
- [ ] Real-time update when new transcription completes
- [ ] History count updates correctly after add/delete

### Non-Functional Requirements
- [ ] Component renders in under 200ms with 20 items
- [ ] Search debounce prevents excessive API calls
- [ ] UI is responsive on mobile, tablet, and desktop
- [ ] All interactive elements are keyboard accessible
- [ ] Error messages are clear and actionable
- [ ] Loading states provide visual feedback
- [ ] Empty states guide user to next action

### Code Quality
- [ ] TypeScript types are properly defined
- [ ] Components follow existing code patterns
- [ ] Store actions handle errors gracefully
- [ ] API methods have proper error handling
- [ ] Code is documented with JSDoc comments
- [ ] Unit tests achieve >80% coverage

---

## 12. Dependencies and Prerequisites

### Frontend Dependencies
**Existing** (no new dependencies needed):
- React 18+
- TypeScript 5+
- Zustand (state management)
- Tailwind CSS (styling)
- lucide-react (icons)
- sonner (toast notifications)

**Optional** (for optimization):
- `react-window` or `react-virtual` (for virtual scrolling of large lists)

### Backend Dependencies
**Existing**:
- FastAPI
- SQLAlchemy
- PostgreSQL/SQLite

**Backend Changes Required**:
1. Add DELETE endpoint: `/api/v1/history/{id}`
2. Enhance GET endpoint: `/api/v1/history` with search and filter params

### API Contracts

#### DELETE /api/v1/history/{id}
**Request**:
```
DELETE /api/v1/history/{transcription_id}
```

**Response** (Success):
```
Status: 204 No Content
```

**Response** (Error):
```json
{
  "detail": "Transcription not found",
  "error_code": "TRANSCRIPTION_NOT_FOUND",
  "timestamp": "2025-11-13T10:30:00Z"
}
```

#### GET /api/v1/history (Enhanced)
**Request**:
```
GET /api/v1/history?page=1&page_size=20&search=meeting&status=completed
```

**New Query Parameters**:
- `search: string` (optional) - Search in filename and transcription text
- `status: TranscriptionStatus` (optional) - Filter by status

**Response**: Same as existing `HistoryListResponse`

---

## 13. Future Enhancements

### Phase 5+ (Not in Current Scope)

#### Export History
- Export selected items as JSON/CSV
- Bulk export all history

#### Favorites/Starred Items
- Mark important transcriptions
- Quick access to favorites

#### Tags and Categories
- User-defined tags for organization
- Category-based filtering

#### Advanced Search
- Date range filter
- Duration range filter
- Full-text search with highlighting
- Sort options (date, duration, filename)

#### History Statistics
- Total transcription time
- Most common format types
- Usage charts and graphs

#### Bulk Operations
- Multi-select items
- Bulk delete
- Bulk export

#### Audio Playback in History
- Play audio directly from history
- Seek to specific timestamp
- Synchronized text highlighting

---

## 14. Security Considerations

### Authorization
- Ensure user can only view/delete their own transcriptions
- Add user authentication checks in DELETE endpoint
- Validate transcription ownership before deletion

### Input Validation
- Sanitize search query to prevent SQL injection
- Validate UUID format for transcription IDs
- Rate limit search/filter API calls

### Data Privacy
- Ensure deleted transcriptions are permanently removed
- Clear cached data after deletion
- Consider GDPR compliance for data retention

---

## 15. Monitoring and Analytics

### Metrics to Track
- History panel open rate
- Average items per page view
- Search usage frequency
- Most common filters used
- Delete operation success rate
- Average time to view historical transcription

### Error Tracking
- API failure rates
- Delete operation failures
- WebSocket connection issues
- Search timeout occurrences

---

## 16. Documentation Requirements

### Code Documentation
- JSDoc comments for all public methods
- TypeScript interfaces with descriptions
- Inline comments for complex logic

### User Documentation
- Add history panel section to user guide
- Create GIF/video showing history features
- Update README with new feature

### Developer Documentation
- Update API documentation with new endpoints
- Add architecture diagram to docs
- Document state management patterns

---

## 17. Rollout Plan

### Development
1. Create feature branch: `feature/transcription-history-ui`
2. Implement in phases (as outlined in section 10)
3. Write tests alongside implementation
4. Code review after each phase

### Testing
1. Unit tests on store and components
2. Integration tests for full flow
3. Manual testing on all devices
4. Accessibility audit with screen reader

### Deployment
1. Merge to main after all tests pass
2. Deploy backend changes first
3. Deploy frontend with feature flag
4. Monitor error rates and user feedback
5. Enable for all users after 48 hours

### Rollback Plan
- Feature flag allows instant disable
- Database migrations are reversible
- Previous version available for quick revert

---

## 18. Questions for Product Owner

Before implementation, clarify:

1. Should we support bulk operations (multi-select delete)?
2. What is the expected maximum number of history items per user?
3. Should deleted items be soft-deleted (recoverable) or hard-deleted?
4. Do we need audit logs for delete operations?
5. Should there be a limit on history retention (e.g., delete items older than 1 year)?
6. Are there any compliance requirements for data retention?

---

## Appendix A: File Checklist

### Files to Create
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/HistoryPanel.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/HistoryItem.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/SearchBar.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/FilterDropdown.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/DeleteConfirmDialog.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/components/StatusBadge.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/hooks/useDebounce.ts`
- [ ] `/home/user/wsprflw/desktop/src/renderer/utils/formatters.ts` (time formatting utils)

### Files to Modify
- [ ] `/home/user/wsprflw/desktop/src/renderer/App.tsx` (add HistoryPanel)
- [ ] `/home/user/wsprflw/desktop/src/renderer/store/transcription.store.ts` (enhance with new state/actions)
- [ ] `/home/user/wsprflw/desktop/src/renderer/services/api.service.ts` (add delete method, enhance getHistory)
- [ ] `/home/user/wsprflw/backend/app/api/history.py` (add DELETE endpoint, enhance GET with filters)

### Files to Test
- [ ] `/home/user/wsprflw/desktop/src/renderer/__tests__/components/HistoryPanel.test.tsx`
- [ ] `/home/user/wsprflw/desktop/src/renderer/__tests__/store/transcription.store.test.ts`
- [ ] `/home/user/wsprflw/backend/tests/api/test_history.py`

---

## Appendix B: Color Palette (Tailwind CSS)

### Status Colors
```typescript
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 animate-pulse',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}
```

### Format Type Colors
```typescript
const formatTypeColors = {
  summary: 'bg-purple-100 text-purple-800',
  bullets: 'bg-indigo-100 text-indigo-800',
  structured: 'bg-cyan-100 text-cyan-800',
  email: 'bg-pink-100 text-pink-800',
  notes: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-800',
}
```

---

## Appendix C: Sample Data Structures

### Sample HistoryItemResponse
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "audio_filename": "meeting_recording_2025-11-13.wav",
  "audio_duration": 1847.5,
  "status": "completed",
  "transcription_preview": "In today's meeting, we discussed the Q4 roadmap and prioritized three key features...",
  "formatted_preview": "# Q4 Roadmap Meeting Summary\n\n## Key Decisions\n- Feature A prioritized for December\n...",
  "format_type": "structured",
  "created_at": "2025-11-13T09:15:00Z",
  "updated_at": "2025-11-13T09:35:00Z"
}
```

### Sample HistoryListResponse
```json
{
  "items": [
    { /* HistoryItemResponse */ },
    { /* HistoryItemResponse */ }
  ],
  "total": 47,
  "page": 1,
  "page_size": 20,
  "has_more": true
}
```

---

## Conclusion

This specification provides a comprehensive design for the Transcription History UI feature. The implementation is broken into manageable phases, with clear acceptance criteria and testing requirements. The design prioritizes performance, user experience, and maintainability while integrating seamlessly with the existing WhisperFlow application.

**Next Steps**:
1. Review this specification with the team
2. Address any questions in Section 18
3. Hand off to Developer agent for implementation
4. Schedule design review midway through Phase 2

**Estimated Total Implementation Time**: 12-17 hours (including testing)

**Questions or Concerns**: Contact the Architect agent for clarifications or design adjustments.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Author**: Architect Agent (WhisperFlow)
