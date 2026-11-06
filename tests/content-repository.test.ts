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
