// Fails when another package manager slips in: bun for JS, uv for Python.
// Run with `bun scripts/check-packages.ts` (part of `mise run check`).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const forbiddenFiles: [RegExp, string][] = [
  [/^package-lock\.json$|^npm-shrinkwrap\.json$/, 'npm lockfile: use `bun add`'],
  [/^yarn\.lock$|^\.yarnrc(\.yml)?$/, 'yarn file: use `bun add`'],
  [/^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$/, 'pnpm file: use `bun add`'],
  [
    /^requirements.*\.txt$|^Pipfile(\.lock)?$|^poetry\.lock$/,
    'pip/pipenv/poetry file: use `uv add`',
  ],
];

// Places that run commands: tasks, manifests, CI, hooks, images.
const commandFile =
  /(^|\/)(\.mise\.toml|package\.json|Dockerfile)$|^\.github\/workflows\/|^\.githooks\//;
const forbiddenCommands: [RegExp, string][] = [
  [/\b(npm|npx|yarn|pnpm)\b/, 'use bun / bunx'],
  [/\bpip3?\s+install\b|-m\s+pip\s+install\b/, 'use uv'],
];

// Tracked files plus new ones not yet committed (ignored files excluded).
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const problems: string[] = [];
for (const file of files) {
  for (const [pattern, why] of forbiddenFiles) {
    if (pattern.test(basename(file))) problems.push(`${file}: ${why}`);
  }
  if (!commandFile.test(file)) continue;
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted but not yet staged
  }
  text.split('\n').forEach((line, i) => {
    for (const [pattern, why] of forbiddenCommands) {
      if (pattern.test(line)) problems.push(`${file}:${i + 1}: ${line.trim()} (${why})`);
    }
  });
}

if (problems.length) {
  console.error('Packages: bun for JS, uv for Python (AGENTS.md).\n');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('Package managers OK: bun and uv only.');
