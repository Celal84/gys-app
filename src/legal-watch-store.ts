import { buildImpact, validateLegalWatchBatch, type LegalDependency, type LegalWatchBatch, type RevalidationItem } from './core/legal-watch';

export const LEGAL_WATCH_DB_NAME = 'gys_legal_watch_v1';
export interface LegalWatchExport {
  schemaVersion: 1;
  kind: 'GYSLegalWatchBackup';
  batches: LegalWatchBatch[];
  revalidationQueue: RevalidationItem[];
}
const clone = <T>(v: T): T => structuredClone(v);
const canonical = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,value]) => `${JSON.stringify(k)}:${canonical(value)}`).join(',')}}`;
  return JSON.stringify(v);
};
const request = <T>(r: IDBRequest<T>): Promise<T> => new Promise((resolve,reject) => {r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error ?? new Error('Mevzuat kaydı okunamadı.'));});
const completed = (t: IDBTransaction): Promise<void> => new Promise((resolve,reject) => {t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error ?? new Error('Mevzuat kaydı atomik olarak iptal edildi.'));t.onerror=()=>{};});
function validateDependencies(input: readonly LegalDependency[]): void {
  if (!Array.isArray(input) || input.length > 30000) throw new Error('Mevzuat etki bağlantıları geçersiz.');
  for (const d of input) {
    if (!d || typeof d.sourceId !== 'string' || !/^SRC-OFFICIAL-[\w-]{1,100}$/.test(d.sourceId)) throw new Error('Kaynak bağı geçersiz.');
    for (const key of ['legalProvisionIds','learningObjectiveIds','questionIds','optionIds','explanationIds','flashcardIds','comparisonRowIds'] as const) {
      if (d[key] !== undefined && (!Array.isArray(d[key]) || d[key]!.length > 30000 || d[key]!.some((v: unknown) => typeof v !== 'string' || !v || v.length > 250))) throw new Error('Etki kimliği geçersiz.');
    }
    if (d.articleNumbers && (!Array.isArray(d.articleNumbers) || d.articleNumbers.some((v: unknown) => typeof v !== 'number' || !Number.isInteger(v) || v <= 0))) throw new Error('Etki madde numarası geçersiz.');
  }
}
export function validateLegalWatchBackup(input: unknown): LegalWatchExport {
  if (!input || typeof input !== 'object') throw new Error('Mevzuat yedeği geçersiz.');
  const v=input as Record<string,unknown>;
  if (v.schemaVersion !== 1 || v.kind !== 'GYSLegalWatchBackup' || !Array.isArray(v.batches) || v.batches.length > 5000 || !Array.isArray(v.revalidationQueue) || v.revalidationQueue.length > 115000) throw new Error('Mevzuat yedeği şeması geçersiz.');
  const batches=v.batches.map(validateLegalWatchBatch);
  if (new Set(batches.map(b=>b.id)).size !== batches.length) throw new Error('Yinelenen kontrol kimliği.');
  const observations=new Map(batches.flatMap(b=>b.observations).map(o=>[o.id,o]));
  const queue: RevalidationItem[]=[];
  for (const raw of v.revalidationQueue) {
    if (!raw || typeof raw !== 'object') throw new Error('Yeniden doğrulama kaydı geçersiz.');
    const item=raw as RevalidationItem;
    const observation=observations.get(item.observationId);
    if (!observation || !item.affected || typeof item.affected !== 'object') throw new Error('Yeniden doğrulama kaynak bağı eksik.');
    const dependency={sourceId:observation.sourceId,...item.affected};
    validateDependencies([dependency]);
    const regenerated=buildImpact(observation,[dependency]);
    if (!regenerated || canonical(regenerated) !== canonical(item)) throw new Error('Yeniden doğrulama kaydı kanıtla tutarsız.');
    queue.push(clone(item));
  }
  if (new Set(queue.map(q=>q.id)).size !== queue.length) throw new Error('Yinelenen etki kaydı.');
  return {schemaVersion:1,kind:'GYSLegalWatchBackup',batches,revalidationQueue:queue};
}
/** Append-only public observations, in a separate database from progress and exam snapshots. */
export function createLegalWatchStore(dbName=LEGAL_WATCH_DB_NAME) {
  let connection: Promise<IDBDatabase> | undefined;
  const open=() => connection ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const r=indexedDB.open(dbName,1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('batches',{keyPath:'id'});r.result.createObjectStore('queue',{keyPath:'id'});};
    r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
    r.onerror=()=>reject(r.error ?? new Error('Mevzuat veritabanı açılamadı.'));
    r.onblocked=()=>reject(new Error('Diğer sekmedeki mevzuat kaydını kapatın.'));
  });
  async function read<T>(store: string): Promise<T[]> {
    const db=await open(); const tx=db.transaction(store,'readonly');const done=completed(tx);
    const rows=await request(tx.objectStore(store).getAll()) as T[];await done;return clone(rows);
  }
  async function merge(data: LegalWatchExport): Promise<{imported:number;total:number}> {
    const db=await open(); const tx=db.transaction(['batches','queue'],'readwrite');const done=completed(tx);
    try {
      const [oldBatches,oldQueue]=await Promise.all([request(tx.objectStore('batches').getAll()) as Promise<LegalWatchBatch[]>,request(tx.objectStore('queue').getAll()) as Promise<RevalidationItem[]>]);
      const existingBatches=new Map(oldBatches.map(v=>[v.id,v]));const existingQueue=new Map(oldQueue.map(v=>[v.id,v]));
      for (const batch of data.batches) {
        const old=existingBatches.get(batch.id);
        if (old && canonical(old)!==canonical(batch)) throw new Error('Aynı kimlikli mevzuat kontrolü farklı; eski kayıt korundu.');
      }
      for (const item of data.revalidationQueue) {
        const old=existingQueue.get(item.id);
        if (old && canonical(old)!==canonical(item)) throw new Error('Aynı kimlikli etki kaydı farklı; eski kayıt korundu.');
      }
      let imported=0;
      for (const batch of data.batches) if (!existingBatches.has(batch.id)) {tx.objectStore('batches').add(batch);imported++;}
      for (const item of data.revalidationQueue) if (!existingQueue.has(item.id)) tx.objectStore('queue').add(item);
      await done;return {imported,total:oldBatches.length+imported};
    } catch (error) {try {tx.abort();} catch {} await done.catch(()=>{});throw error;}
  }
  return {
    async importObservation(input: unknown, dependencies: readonly LegalDependency[]=[]): Promise<{imported:number;total:number}> {
      const batch=validateLegalWatchBatch(input);validateDependencies(dependencies);
      const revalidationQueue=batch.observations.map(o=>buildImpact(o,dependencies)).filter((v):v is RevalidationItem=>v!==null);
      return merge({schemaVersion:1,kind:'GYSLegalWatchBackup',batches:[batch],revalidationQueue});
    },
    async listObservations(): Promise<LegalWatchBatch[]> {return (await read<LegalWatchBatch>('batches')).sort((a,b)=>a.completedAt.localeCompare(b.completedAt));},
    async listRevalidationQueue(): Promise<RevalidationItem[]> {return (await read<RevalidationItem>('queue')).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));},
    async getStatus() {
      const [batches,queue]=await Promise.all([read<LegalWatchBatch>('batches'),read<RevalidationItem>('queue')]);
      batches.sort((a,b)=>a.completedAt.localeCompare(b.completedAt));
      const latest=batches.at(-1) ?? null;
      const success=batches.filter(b=>b.complete).at(-1) ?? null;
      const fullSuccess=batches.filter(b=>b.complete && b.requestedTopicIds.length===23).at(-1) ?? null;
      return {lastAttemptAt:latest?.completedAt ?? null,lastSuccessfulCheck:success?.completedAt ?? null,
        lastSuccessfulFullCheck:fullSuccess?.completedAt ?? null,
        lastSuccessfulTopicIds:success?.requestedTopicIds ?? [],lastAttemptComplete:latest?.complete ?? false,
        failedSources:latest?.observations.filter(o=>o.result==='Failed').length ?? 0,
        changedSources:latest?.observations.filter(o=>o.change==='ContentChanged').length ?? 0,
        pendingRevalidation:queue.length,examVersionFinalized:false as const,legalEdition:'preparation' as const,
        continuouslyRunningInBackground:false as const,observationCount:batches.length};
    },
    async exportData(): Promise<LegalWatchExport> {
      const [batches,revalidationQueue]=await Promise.all([read<LegalWatchBatch>('batches'),read<RevalidationItem>('queue')]);
      return {schemaVersion:1,kind:'GYSLegalWatchBackup',batches,revalidationQueue};
    },
    async importData(input: unknown): Promise<{imported:number;total:number}> {return merge(validateLegalWatchBackup(input));},
    async close() {if (connection) (await connection).close();connection=undefined;},
  };
}
export type LegalWatchStore = ReturnType<typeof createLegalWatchStore>;
/** Fetch an explicitly configured same-origin generated artifact, never claim it ran a fresh official scan. */
export async function fetchLegalWatchArtifact(url: string, fetcher: typeof fetch=fetch): Promise<LegalWatchBatch> {
  if (!/^\.?\/?(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.json$/.test(url) || url.includes('..')) throw new Error('Yalnız yerel mevzuat raporu yolu desteklenir.');
  const response=await fetcher(url,{cache:'no-store'});
  if (!response.ok) throw new Error('Mevzuat kontrol raporuna erişilemedi; yeni kontrol yapılmış sayılmadı.');
  const declared=Number(response.headers.get('content-length'));
  if (declared>2*1024*1024) throw new Error('Mevzuat raporu çok büyük.');
  const text=await response.text();
  if (text.length>2*1024*1024 || !text.trim()) throw new Error('Mevzuat raporu boş veya çok büyük.');
  return validateLegalWatchBatch(JSON.parse(text));
}
