export class NotificationManager {
  constructor() {
    this.id = 'bookmark-progress';
    this.created = false;
  }

  async ensureProgress(message = 'Starting...') {
    if (this.created) return;
    try {
      await chrome.notifications.create(this.id, {
        type: 'progress',
        iconUrl: '/icons/icon128.png',
        title: 'Bookmark Cleaner',
        message,
        progress: 0
      });
      this.created = true;
    } catch (e) {
      console.warn('Failed to create progress notification:', e);
    }
  }

  async showProgress(current, total, message) {
    if (!this.created) await this.ensureProgress(message);
    const progress = total ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
    try {
      await chrome.notifications.update(this.id, { message, progress });
    } catch (e) {
      console.warn('Failed to update progress notification:', e);
    }
  }

  async showComplete(stats) {
    if (this.created) {
      try {
        await chrome.notifications.clear(this.id);
      } catch (e) {
        console.warn('Failed to clear progress notification:', e);
      }
      this.created = false;
    }

    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: 'Cleanup Complete',
      message: `Processed ${stats.total} bookmarks. Found ${stats.duplicates} duplicates.`
    });
  }
}
