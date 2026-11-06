import manifest from '../data/content-manifest.json';
import watch from '../public/content/legal-watch.json';
import type {ContentManifest} from '../src/content-repository';
import type {SourceObservation} from '../src/core/legal-watch';
import { it, expect, vi } from 'vitest';
import { createContentRepository } from '../src/content-repository';
const digest = async(text:string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
it('does not fetch or parse the full bank when showing topic counts',async()=>{
 const fetcher=vi.fn();const repository=createContentRepository({schemaVersion:1,contentEdition:'preparation',totalApproved:5,topics:[{topicId:'O02',count:5,path:'content/O02.json',sha256:'a'.repeat(64)}]},fetcher);
 expect(repository.totalCount()).toBe(5);expect(repository.countFor('O02')).toBe(5);expect(repository.countFor('T01')).toBe(0);
 expect(repository.loadedChunks()).toEqual([]);expect(await repository.loadTopic('T01')).toBeNull();expect(fetcher).not.toHaveBeenCalled();
});
it('rejects tampered bytes before accepting question data',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('{"schemaVersion":1,"questions":[],"snapshots":[]}'));
 const repository=createContentRepository({schemaVersion:1,contentEdition:'preparation',totalApproved:1,topics:[{topicId:'O02',count:1,path:'content/O02.json',sha256:'a'.repeat(64)}]},fetcher);
 await expect(repository.loadTopic('O02')).rejects.toThrow('bütünlük');expect(repository.loadedChunks()).toEqual([]);
});
it('rejects a hash-matching but unapproved injected chunk',async()=>{
 const text=JSON.stringify({schemaVersion:1,questions:[{id:'bad',topicId:'O02',verificationStatus:'ValidationPending',options:[]}],snapshots:[]});
 const repository=createContentRepository({schemaVersion:1,contentEdition:'preparation',totalApproved:1,topics:[{topicId:'O02',count:1,path:'content/O02.json',sha256:await digest(text)}]},vi.fn().mockResolvedValue(new Response(text)));
 await expect(repository.loadTopic('O02')).rejects.toThrow('Yayın onayı');expect(repository.loadedChunks()).toEqual([]);
});

it('blocks aliased source identities by official URL and does not revive an old package after the watch baseline advances',()=>{
 const repository=createContentRepository(manifest as ContentManifest,vi.fn());
 const entry=manifest.topics.find(t=>t.topicId==='O01')!;expect(repository.countFor('O01')).toBe(entry.count);
 const row={...watch.observations.find(o=>o.topicId==='O01')!,checkedAt:'2026-11-07T00:00:00Z',result:'Verified',change:'ContentChanged',rawResponseSHA256:'f'.repeat(64),decodedContentSHA256:'e'.repeat(64)} as SourceObservation;
 repository.setSourceObservations([row]);expect(repository.countFor('O01')).toBe(0);
 repository.setSourceObservations([{...row,checkedAt:'2026-11-08T00:00:00Z',baselineRawResponseSHA256:row.rawResponseSHA256,baselineDecodedContentSHA256:row.decodedContentSHA256,change:'Unchanged'}]);
 expect(repository.countFor('O01')).toBe(0);expect(repository.countFor('O02')).toBeGreaterThan(0);
});
