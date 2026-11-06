import { isAvailableFor, type Question, type SourceSnapshot } from './core/content';
export interface ContentManifest {
  schemaVersion: number;
  contentEdition: 'preparation' | 'exam';
  totalApproved: number;
  topics: { topicId: string; count: number; questionIds?: string[]; path: string; sha256: string }[];
}
export interface ContentChunk { schemaVersion: number; questions: Question[]; snapshots: SourceSnapshot[] }

/** Only the small manifest is loaded at startup. Topic chunks are verified and parsed on demand. */
export function createContentRepository(manifest: ContentManifest, fetcher: typeof fetch = fetch) {
  if (manifest.schemaVersion !== 1 || manifest.topics.reduce((n,t) => n + t.count,0) !== manifest.totalApproved) throw new Error('İçerik envanteri geçersiz.');
  const loaded = new Map<string, ContentChunk>();
  const inflight = new Map<string, Promise<ContentChunk | null>>();
  return {
    totalCount: () => manifest.totalApproved,
    countFor: (topicId: string) => manifest.topics.find(t => t.topicId === topicId)?.count ?? 0,
    loadedChunks: () => [...loaded.values()],
    async loadTopic(topicId: string): Promise<ContentChunk | null> {
      if (loaded.has(topicId)) return loaded.get(topicId)!;
      if (inflight.has(topicId)) return inflight.get(topicId)!;
      const entry = manifest.topics.find(t => t.topicId === topicId);
      if (!entry) return null;
      if (!/^content\/[OT]\d{2}\.json$/.test(entry.path)) throw new Error('Geçersiz içerik yolu.');
      const promise = (async () => {
        const response = await fetcher(`./${entry.path}`);
        if (!response.ok) throw new Error('Soru paketi yüklenemedi; bağlantı veya çevrimdışı önbelleği kontrol edin.');
        const text = await response.text();
        if (!globalThis.crypto?.subtle) throw new Error('İçerik doğrulaması için HTTPS güvenli bağlantısı gerekir.');
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2,'0')).join('');
        if (hash !== entry.sha256) throw new Error('Soru paketi bütünlük denetiminden geçmedi.');
        const chunk: ContentChunk = JSON.parse(text);
        if (chunk.schemaVersion !== 1 || !Array.isArray(chunk.questions) || !Array.isArray(chunk.snapshots)
          || chunk.questions.length !== entry.count || new Set(chunk.questions.map(q => q.id)).size !== chunk.questions.length
          || chunk.questions.some(q => q.topicId !== topicId || !isAvailableFor(q,'study',{snapshot:chunk.snapshots.find(s => s.id === q.sourceSnapshotId)}))) {
          throw new Error('Yayın onayı veya soru paketi dağılımı geçersiz.');
        }
        loaded.set(topicId, chunk);
        return chunk;
      })();
      inflight.set(topicId,promise);
      try { return await promise; } finally { inflight.delete(topicId); }
    },
  };
}
