// Fails on a folder with a catch-all name: folders are named for their job, so
// a reader knows what goes in one and it doesn't fill with anything.
// Run with `bun checks/folders.ts` (part of `mise run check`).
import { execFileSync } from 'node:child_process';

const catchAll = new Set(['scripts', 'utils', 'lib', 'common', 'helpers', 'misc', 'shared']);

// Each with why it stays for now; keep it short.
const allowed = new Map([['apps/frontend/src/shared', 'not yet split by job; its own change']]);

/** Each folder in `files` with a catch-all name, once, outside the allowed list. */
export function catchAllFolders(files: string[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    const parts = file.split('/').slice(0, -1);
    parts.forEach((part, i) => {
      const folder = parts.slice(0, i + 1).join('/');
      if (catchAll.has(part) && !allowed.has(folder)) found.add(folder);
    });
  }
  return [...found];
}

if (import.meta.main) {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const found = catchAllFolders(files);
  if (found.length) {
    console.error(
      `Catch-all folder names; name each folder for its job (AGENTS.md):\n${found.map((f) => `  ${f}/`).join('\n')}`,
    );
    process.exit(1);
  }
  console.log('Folders OK: none with a catch-all name.');
}
