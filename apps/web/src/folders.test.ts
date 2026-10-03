import { describe, expect, it } from 'vitest';
import { folderOf, LOOSE_FILES, summarizeFolders } from './folders';

describe('folderOf', () => {
  it('takes the parent folder of picked and dropped paths', () => {
    expect(folderOf('DCIM/Camera/IMG_1.jpg')).toBe('DCIM/Camera');
    expect(folderOf('/Phone/DCIM/Camera/IMG_1.jpg')).toBe('Phone/DCIM/Camera'); // drag & drop fullPath
    expect(folderOf('IMG_1.jpg')).toBe(LOOSE_FILES);
    expect(folderOf('')).toBe(LOOSE_FILES);
  });
});

describe('summarizeFolders', () => {
  it('counts outcomes per folder, biggest first', () => {
    const stats = summarizeFolders([
      { folder: 'WhatsApp Images', outcome: 'noLocation' },
      { folder: 'DCIM/Camera', outcome: 'located' },
      { folder: 'DCIM/Camera', outcome: 'located' },
      { folder: 'DCIM/Camera', outcome: 'noDate' },
      { folder: 'Screenshots', outcome: 'noLocation' },
      { folder: 'Screenshots', outcome: 'failed' },
    ]);
    expect(stats.map((s) => s.folder)).toEqual(['DCIM/Camera', 'Screenshots', 'WhatsApp Images']);
    expect(stats[0]).toEqual({ folder: 'DCIM/Camera', total: 3, withLocation: 2, noLocation: 0, noDate: 1, failed: 0 });
    expect(stats[1]).toMatchObject({ total: 2, noLocation: 1, failed: 1 });
  });

  it('handles an empty scan', () => {
    expect(summarizeFolders([])).toEqual([]);
  });
});
