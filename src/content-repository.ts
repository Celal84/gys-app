import { OFFICIAL_WATCH_IDENTITIES, type SourceObservation } from './core/legal-watch';
import { isAvailableFor, type Question, type SourceSnapshot } from './core/content';
export interface ContentManifest {
  schemaVersion: number;
  contentEdition: 'preparation' | 'exam';
  totalApproved: number;
  topics: { topicId: string; count: number; questionIds?: string[]; sourceSnapshots?: (SourceSnapshot & { count: number; decodedContentHash?: string })[]; path: string; sha256: string }[];
}
export interface ContentChunk { schemaVersion: number; questions: Question[]; snapshots: SourceSnapshot[] }

/** Only the small manifest is loaded at startup. Topic chunks are verified and parsed on demand. */
export function createContentRepository(manifest: ContentManifest, fetcher: typeof fetch = fetch) {
  if (manifest.schemaVersion !== 1 || manifest.topics.reduce((n,t) => n + t.count,0) !== manifest.totalApproved) throw new Error('İçerik envanteri geçersiz.');
  const observations = new Map<string, SourceObservation>();
  function current(snapshot: Pick<SourceSnapshot,'sourceId'|'sourceUrl'|'contentHash'> & {decodedContentHash?:string}): boolean {
    const observation=observations.get(snapshot.sourceId)||observations.get(snapshot.sourceUrl);
    if(!observation)return true;
    if(observation.rawResponseSHA256===snapshot.contentHash)return true;
    if(snapshot.decodedContentHash){
      const versionChanged=observation.change==='ContentChanged'&&observation.baselineOfficialContentVersion!==null&&String(observation.officialContentVersion)!==String(observation.baselineOfficialContentVersion);
      return !versionChanged&&observation.decodedContentSHA256===snapshot.decodedContentHash;
    }
    return observation.baselineRawResponseSHA256===snapshot.contentHash&&['Unchanged','TransportOnlyChanged'].includes(observation.change);
  }
  const topicCount=(topic:ContentManifest['topics'][number])=>topic.sourceSnapshots?.reduce((sum,s)=>sum+(current(s)?s.count:0),0) ?? topic.count;
  const loaded = new Map<string, ContentChunk>();
  const inflight = new Map<string, Promise<ContentChunk | null>>();
  return {
    sourceDependencies:()=>manifest.topics.flatMap(topic=>(topic.sourceSnapshots||[]).map(source=>({sourceId:OFFICIAL_WATCH_IDENTITIES[topic.topicId]?.sourceId||source.sourceId,questionIds:topic.questionIds||[],explanationIds:(topic.questionIds||[]).map(id=>'EXPLANATION:'+id)}))),
    isSourceCurrent:current,
    topicIds:()=>manifest.topics.map(t=>t.topicId),
    totalCount: () => manifest.topics.reduce((sum,t)=>sum+topicCount(t),0),
    countFor: (topicId: string) => { const topic=manifest.topics.find(t=>t.topicId===topicId);return topic?topicCount(topic):0; },
    loadedChunks: () => [...loaded.values()].map(chunk=>({...chunk,questions:chunk.questions.filter(q=>{const snapshot=chunk.snapshots.find(s=>s.id===q.sourceSnapshotId);return Boolean(snapshot&&current(snapshot));})})),
    setSourceObservations(rows:readonly SourceObservation[]) {
      for(const row of rows){if(row.result!=='Verified')continue;const old=observations.get(row.sourceId);if(!old||row.checkedAt>old.checkedAt){observations.set(row.sourceId,row);observations.set(row.sourceUrl,row);}}
    },
    async loadTopic(topicId: string): Promise<ContentChunk | null> {
      if (loaded.has(topicId)) { const chunk=loaded.get(topicId)!;if(chunk.snapshots.some(s=>!current(s)))throw new Error('Kaynak değişti; bu paket yeniden doğrulama bekliyor.');return chunk; }
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
        if(chunk.snapshots.some(s=>!current(s)))throw new Error('Kaynak değişti; bu paket yeniden doğrulama bekliyor.');
        loaded.set(topicId, chunk);
        return chunk;
      })();
      inflight.set(topicId,promise);
      try { return await promise; } finally { inflight.delete(topicId); }
    },
  };
}
