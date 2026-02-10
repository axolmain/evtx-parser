# SysInfoZip Storage & Search Features

## Overview

The EVTX Parser now includes persistent storage with IndexedDB and powerful search capabilities across all your uploaded archives.

## Features

### 1. Persistent Storage (IndexedDB)

**Automatic Persistence**
- All uploaded SysInfoZip archives are automatically saved to browser storage
- Parsed EVTX results are cached for instant re-viewing
- JSON and TXT files are cached after first view
- Storage persists across browser sessions

**Storage Capacity**
- Typically 50MB - 100s of MB available (browser dependent)
- Can store multiple large EVTX files (100MB+ each)
- Real-time storage usage indicator

**What's Stored**
- Original file blobs (for re-parsing if needed)
- Parsed EVTX results (instant viewing on reload)
- JSON and TXT content (pre-parsed)
- EVTX events indexed for search

### 2. Archive Management

**Recent Archives Panel**
- Shows all previously uploaded archives
- Displays: upload date, file count, total size
- Storage usage progress bar with warnings
- Load any archive with one click
- Delete individual archives or clear all

**Archive Actions**
- **Load**: Restore archive from storage instantly
- **Delete**: Remove single archive with confirmation
- **Clear All**: Remove all archives (with safety confirmation)

### 3. Global Search (⌘K / Ctrl+K)

**Search Across All Archives**
- Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) anywhere
- Or click "Search Events" button in archive viewer
- Searches ALL indexed EVTX events across ALL archives

**Search Capabilities**
- Full-text search in event data
- Search by event ID
- Search by provider name
- Search by computer name
- Real-time results (300ms debounced)
- Limits to 100 results for performance

**Search Results Display**
- Event ID and level badge (color-coded)
- Provider and computer information
- Event data preview (2 lines)
- Timestamp (formatted)
- Archive and file badges (source location)
- Query highlighting

**Event Levels**
- 🔴 Critical (Level 1) - Red
- 🟠 Error (Level 2) - Orange
- 🟡 Warning (Level 3) - Yellow
- 🔵 Information (Level 4) - Blue
- ⚪ Verbose (Level 5) - Gray

### 4. Enhanced Single-File Search

**Within Current EVTX File**
- Search bar with hints and tips
- Search scope: event data, provider, event ID, computer, channel
- Case-insensitive search
- Clear search button (X)
- Filter by event levels (checkboxes)
- Event counts per level
- Clear all filters button

## Usage Guide

### First Time Upload

1. **Upload Archive**
   ```
   - Drop .zip file or click to browse
   - Archive is automatically extracted
   - All files saved to IndexedDB
   - EVTX files parsed and indexed in background
   ```

2. **View Files**
   ```
   - Click any file in sidebar to view
   - EVTX: Full parser with filtering
   - JSON: Syntax highlighted
   - TXT: Plain text display
   ```

### Returning to App

1. **Recent Archives**
   ```
   - App loads recent archives on startup
   - Click any archive to load it
   - Files load from IndexedDB (instant)
   - Parsed data already cached
   ```

2. **Search Events**
   ```
   - Press ⌘K to open global search
   - Type to search all events
   - Results show source archive/file
   - Press Enter to select (future: jump to event)
   ```

### Storage Management

**Monitor Usage**
- Storage progress bar shows usage percentage
- Colors: Blue (<50%), Yellow (50-80%), Red (>80%)
- Warning appears when storage >80% used

**Clear Space**
- Delete individual archives you no longer need
- Clear all archives to start fresh
- Confirmation required for deletions

## Technical Details

### IndexedDB Schema

**Tables:**
- `archives`: Archive metadata (name, date, size, file count)
- `files`: File blobs and cached parsed data
- `events`: Indexed EVTX events for search

**Indexes:**
- Archives: id, name, uploadedAt
- Files: id, archiveId, type, name
- Events: id, archiveId, fileId, eventId, provider, level, computer, timestamp

### Performance Optimizations

**3-Tier Caching:**
1. Memory cache (current session, instant)
2. IndexedDB cache (persistent, very fast)
3. Blob parsing (first time only)

**Event Indexing:**
- Happens in background after parsing
- Non-blocking (won't affect UI)
- Only indexes once per file
- Enables fast cross-archive search

**Search Performance:**
- 300ms debounce prevents excessive queries
- Limits to 100 results
- Compound indexes for fast lookups
- Full-text search with highlighting

### Browser Compatibility

**Storage API Requirements:**
- IndexedDB (supported in all modern browsers)
- Storage API (for quota estimates)
- Minimum: Chrome 51+, Firefox 48+, Safari 10+

**Storage Limits:**
- Chrome: Up to 60% of available disk space
- Firefox: Up to 50% of available disk space
- Safari: Up to 1GB per origin
- Actual limits depend on available disk space

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` - Open global search
- `↑` / `↓` - Navigate search results
- `Enter` - Select search result
- `Esc` - Close search/modals

## Future Enhancements

### Planned Features
- [ ] Jump to event from global search results
- [ ] Export search results
- [ ] Saved search queries
- [ ] Known issue detection patterns
- [ ] Cross-file correlation analysis
- [ ] Timeline view across archives
- [ ] Archive comparison mode

### Known Issue Detection
Framework is in place for automated pattern matching:
- Define known issue signatures (event IDs, patterns, sequences)
- Automatically scan uploaded archives
- Highlight potential issues
- Provide remediation suggestions

## Troubleshooting

### Storage Full
- Delete old archives you no longer need
- Clear browser cache (loses all data)
- Consider exporting important data first

### Slow Search
- Limit search query to be more specific
- Wait for background indexing to complete
- Check browser console for errors

### Events Not Searchable
- Wait for indexing to complete (happens in background)
- Check that EVTX file parsed successfully
- Verify browser supports IndexedDB

### Data Not Persisting
- Check browser privacy settings
- Ensure IndexedDB not disabled
- Try different browser if issue persists

## Data Privacy

- All data stored **locally** in your browser
- Nothing sent to servers
- Data persists until you clear it
- Use private/incognito mode for sensitive files (won't persist)

## Performance Tips

1. **First Parse Takes Time**
   - Large EVTX files (100MB+) may take 10-30 seconds
   - Results are cached for instant subsequent viewing

2. **Background Indexing**
   - Event indexing happens automatically
   - Won't block UI or file viewing
   - Check console for indexing progress

3. **Storage Limits**
   - Monitor storage usage regularly
   - Delete archives you no longer need
   - Very large files may hit browser limits

4. **Search Performance**
   - Be specific in search queries
   - Use level filters to narrow results
   - Global search limited to 100 results
