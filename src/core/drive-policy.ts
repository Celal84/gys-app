/** IDs are the boundary. A similarly named file elsewhere is not excluded. */
export const EXCLUDED_DRIVE_FOLDER_ID = '1L30mGITasaz_HJ-wAQadrn9Tzv81nR7I';
export const DRIVE_ROOTS = Object.freeze({
  notes: '1xhEtBvm_f_MBAzEKfGCsCg9d6EEglu20',
  common: '1lUBhEp53Hi8dOM0mcPunmj_Dl_VMxyYx',
  technical: '1Kh7su0204fEMhkxiekDvjLX3yWQgTzC4',
  historical: '1WGPmJQHECvL1S9hBpOmTUpWWfvNtGsQR',
});
export const DISTRIBUTION_FILE_ID = '1eJKixskJN8-GCwasXcv9repELqESdgcq';

export interface DriveEntry {
  id: string;
  name: string;
  kind: 'file' | 'folder' | 'shortcut';
  parentIds: readonly string[];
  shortcutTargetId?: string;
  mimeType?: string;
  modifiedAt?: string;
}
export interface DriveListing { entries: readonly DriveEntry[]; nextPageToken?: string }
export interface DriveProvider {
  /** Implementation must request a direct-child listing, never a global content search. */
  listChildren(folderId: string, pageToken?: string): Promise<DriveListing>;
}
export interface SourceInventory {
  files: DriveEntry[];
  visitedFolders: string[];
  skipped: { id: string; reason: 'excluded-id' | 'shortcut-not-followed' | 'unverified-parent' | 'already-visited' }[];
}

/**
 * A metadata-only inventory. This function deliberately never fetches file contents.
 * Shortcuts are not followed in phase 0: an alias cannot establish safe ancestry.
 * The excluded ID is rejected before any provider operation, even as a root/target.
 */
export async function crawlSources(provider: DriveProvider, options: { roots?: readonly string[] } = {}): Promise<SourceInventory> {
  const roots = options.roots ?? [DRIVE_ROOTS.notes, DRIVE_ROOTS.historical];
  const allowedRoots = new Set<string>(Object.values(DRIVE_ROOTS));
  for (const root of roots) {
    if (root === EXCLUDED_DRIVE_FOLDER_ID || !allowedRoots.has(root)) throw new Error('Source root is not permitted');
  }
  const result: SourceInventory = { files: [], visitedFolders: [], skipped: [] };
  const visited = new Set<string>();
  const filesSeen = new Set<string>();
  async function walk(folderId: string): Promise<void> {
    if (folderId === EXCLUDED_DRIVE_FOLDER_ID) {
      result.skipped.push({ id: folderId, reason: 'excluded-id' });
      return;
    }
    if (visited.has(folderId)) {
      result.skipped.push({ id: folderId, reason: 'already-visited' });
      return;
    }
    visited.add(folderId);
    result.visitedFolders.push(folderId);
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const page = await provider.listChildren(folderId, pageToken);
      for (const entry of page.entries) {
        if (entry.id === EXCLUDED_DRIVE_FOLDER_ID || entry.shortcutTargetId === EXCLUDED_DRIVE_FOLDER_ID) {
          result.skipped.push({ id: entry.id, reason: 'excluded-id' });
          continue;
        }
        // A list response that claims a different parent cannot authorize traversal.
        if (!entry.parentIds.includes(folderId) || entry.parentIds.includes(EXCLUDED_DRIVE_FOLDER_ID)) {
          result.skipped.push({ id: entry.id, reason: 'unverified-parent' });
          continue;
        }
        if (entry.kind === 'shortcut') {
          result.skipped.push({ id: entry.id, reason: 'shortcut-not-followed' });
          continue;
        }
        if (entry.kind === 'folder') await walk(entry.id);
        else if (!filesSeen.has(entry.id)) {
          filesSeen.add(entry.id);
          result.files.push(entry);
        }
      }
      pageToken = page.nextPageToken;
      if (pageToken && seenTokens.has(pageToken)) throw new Error('Repeated Drive pagination token');
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);
  }
  for (const root of roots) await walk(root);
  return result;
}
