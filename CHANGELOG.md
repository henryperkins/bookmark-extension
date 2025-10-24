# Changelog

All notable changes to Edge Bookmark Cleaner will be documented in this file.

## [1.0.0] - 2025-01-XX

### Added
- Initial release
- AI-powered duplicate detection using Azure OpenAI embeddings
- Automatic tag generation with GPT models
- Smart folder organization suggestions
- Review queue for preview mode
- Scheduled cleanup (daily/weekly/manual)
- Import/Export in Netscape HTML format
- React-based popup UI with 4 tabs:
  - Review: Duplicate management
  - Add: Quick bookmark creation
  - Manage: Tree view with edit/delete
  - Import/Export: Backup and restore
- Options page with full configuration
- "Run Now" manual trigger
- Progress notifications with completion summary
- Rate limiting (8 concurrent requests, exponential backoff)
- Vector caching with 30-day TTL
- Storage quota management
- Device-only mode for large libraries
- Offscreen document for content scraping
- Cosine similarity-based duplicate detection
- Tag validation and quality filtering
- Sync conflict resolution
- MV3 compliance:
  - Service worker architecture
  - `runtime.getContexts()` for offscreen lifecycle
  - Alarm API for scheduling
  - Proper permission declarations

### Technical Details
- **Minimum Edge version**: 116 (Chromium)
- **Node requirement**: 18+
- **Build tool**: Vite + React + TypeScript
- **API**: Azure OpenAI (Chat Completions + Embeddings)

### Permissions
- `bookmarks` - Bookmark access
- `storage` - Settings and cache
- `downloads` - Export functionality
- `alarms` - Scheduled tasks
- `offscreen` - DOM parsing
- `notifications` - User feedback
- `unlimitedStorage` - Large caches
- Host: `https://*.openai.azure.com/*`
- Optional: `<all_urls>` (runtime request for scraping)

### Known Limitations
- Edge Reading List API not supported (Edge limitation)
- Minimum alarm interval: 30 seconds (Chromium limitation)
- Sync storage: ~100 KB limit (use device-only for large libraries)
- Embeddings cached for 30 days (configurable)

### Performance
- ~1,000 bookmarks in < 5 minutes
- ~10,000 bookmarks in < 30 minutes
- API costs: ~$0.15-$0.70 per 1,000 bookmarks

## [Unreleased]

### Planned Features
- Incremental cleanup (process only new/modified bookmarks)
- Custom similarity thresholds per folder
- Batch tagging improvements
- Dark mode UI
- Backup to cloud storage
- Statistics dashboard
- Export to other formats (JSON, CSV)
- Browser bookmark sync integration
- Multi-language support

### Planned Improvements
- Migrate to Azure OpenAI Responses API
- Add unit tests with Jest
- Add integration tests with Selenium
- Improve folder suggestion algorithm
- Optimize vector storage compression
- Add telemetry (opt-in)

### Known Issues
- [ ] Large imports (>5,000 bookmarks) may timeout
- [ ] Folder ID input requires manual lookup
- [ ] No undo for bulk deletions
- [ ] Tree view doesn't support drag-and-drop

---

## Version History

- **1.0.0** - Initial release
