import { describe, expect, it } from 'vitest';
import { catchAllFolders } from './folders';

describe('catchAllFolders', () => {
  it('flags the scripts folders this repo once had, at any depth', () => {
    // The layout before checks/ and apps/backend/export_openapi.py.
    const files = [
      'scripts/check-look.ts',
      'scripts/tsconfig.json',
      'apps/backend/scripts/export_openapi.py',
      'checks/look.ts',
    ];
    expect(catchAllFolders(files)).toEqual(['scripts', 'apps/backend/scripts']);
  });

  it('passes a file named like a catch-all', () => {
    expect(catchAllFolders(['lib.ts', 'apps/frontend/src/use-media-query.ts'])).toEqual([]);
  });
});
