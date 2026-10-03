export type Outcome = 'located' | 'noLocation' | 'noDate' | 'failed';

export interface FolderStat {
  folder: string;
  total: number;
  withLocation: number;
  noLocation: number;
  noDate: number;
  failed: number;
}

/** Files picked individually carry no path, so they share one group. */
export const LOOSE_FILES = 'Selected photos';

/** Parent folder of a relative path: "DCIM/Camera/IMG_1.jpg" → "DCIM/Camera". */
export function folderOf(path: string): string {
  const trimmed = path.replace(/^\/+/, '');
  const slash = trimmed.lastIndexOf('/');
  return slash > 0 ? trimmed.slice(0, slash) : LOOSE_FILES;
}

/** Count outcomes per folder, biggest folders first. */
export function summarizeFolders(records: { folder: string; outcome: Outcome }[]): FolderStat[] {
  const byFolder = new Map<string, FolderStat>();
  for (const { folder, outcome } of records) {
    let s = byFolder.get(folder);
    if (!s) {
      s = { folder, total: 0, withLocation: 0, noLocation: 0, noDate: 0, failed: 0 };
      byFolder.set(folder, s);
    }
    s.total++;
    if (outcome === 'located') s.withLocation++;
    else s[outcome]++;
  }
  return [...byFolder.values()].sort((a, b) => b.total - a.total || a.folder.localeCompare(b.folder));
}
