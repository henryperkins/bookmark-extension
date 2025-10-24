# Product Overview

## Purpose
Edge Bookmark Cleaner is an AI-powered Microsoft Edge extension that automates bookmark deduplication, organization, and management using Azure OpenAI embeddings and chat models.

## Value Proposition
- Eliminates duplicate bookmarks using semantic similarity analysis (not just URL matching)
- Automatically tags and organizes bookmarks with AI-generated categories
- Provides intelligent folder placement suggestions
- Reduces manual bookmark maintenance effort through scheduled automation
- Preserves bookmark quality through preview-before-delete workflow

## Key Features

### AI-Powered Deduplication
- Uses Azure OpenAI embeddings to detect semantically similar bookmarks
- Configurable similarity threshold (default 90%)
- Cosine similarity comparison for vector matching
- Review queue with similarity scores before deletion

### Auto-Tagging
- AI-generated relevant category tags for bookmarks
- Tag quality filtering and validation
- Batch tagging operations

### Smart Organization
- Suggests optimal folder placement based on content analysis
- Folder hierarchy management
- Conflict resolution for sync operations

### Scheduled Cleanup
- Daily or weekly automatic cleanup via Chrome Alarms API
- Manual trigger option with keyboard shortcut (Ctrl+Shift+L)
- Progress notifications during cleanup operations

### Import/Export
- Standard Netscape HTML format support
- Bulk bookmark operations
- Parent folder specification for imports

### Performance & Reliability
- Built-in rate limiting (8 concurrent requests, exponential backoff)
- Vector caching with 30-day TTL to minimize API costs
- Storage quota management with device-only mode option
- Offscreen document pattern for DOM parsing (Chrome 116+)

## Target Users

### Primary Users
- Power users with large bookmark collections (500+ bookmarks)
- Users experiencing bookmark clutter and duplicates
- Professionals managing research bookmarks across multiple topics

### Use Cases
1. **Initial Cleanup**: One-time deduplication of accumulated bookmarks
2. **Ongoing Maintenance**: Scheduled weekly cleanup to prevent clutter
3. **Organization**: AI-assisted tagging and folder structuring
4. **Migration**: Import/export for moving bookmarks between browsers or backups
5. **Research Management**: Semantic search and organization of research materials

## Technical Requirements
- Microsoft Edge (Chromium) version 116 or higher
- Azure OpenAI resource with chat and embeddings model deployments
- Node.js 18+ for building the popup interface
