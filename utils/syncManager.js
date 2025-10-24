export class SyncManager {
  async resolveConflicts(local, remote) {
    const conflicts = [];

    for (const b of local) {
      const r = remote.find(x => x.url === b.url);
      if (!r) continue;

      const lt = b.dateAdded || 0;
      const rt = r.dateAdded || r.dateGroupModified || 0;

      if (rt > lt) {
        conflicts.push({
          local: b,
          remote: r,
          suggestion: 'keep_remote'
        });
      }
    }

    return conflicts;
  }
}
