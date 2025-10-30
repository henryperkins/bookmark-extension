import { cosineSimilarity } from '../lib/cosine.js';

export class DuplicateDetector {
  constructor(threshold = 0.9) {
    this.threshold = threshold;
  }

  isDuplicate(vec1, vec2, url1, url2) {
    const similarity = cosineSimilarity(vec1, vec2) || 0;

    // Use stricter threshold for same domain
    try {
      const d1 = url1 ? new URL(url1).hostname : '';
      const d2 = url2 ? new URL(url2).hostname : '';
      const t = d1 && d2 && d1 === d2 ? this.threshold : (this.threshold + 0.05);
      return similarity > t;
    } catch {
      // Fallback if URL parsing fails
      return similarity > this.threshold;
    }
  }
}
