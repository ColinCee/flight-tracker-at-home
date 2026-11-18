// Fails when another package manager slips in: bun for JS, uv for Python.
// Lockfiles and manifests fail at any depth; commands are checked only in the
// files that run them (tasks, manifests, CI, hooks, Dockerfiles), not in docs or code.
// Run with `bun checks/packages.ts` (part of `mise run check`).
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
  // The tool as a command word: not part of a name like `npm-run-all` or `yarn.lock`.
  [/(?<![\w@/.-])(npm|npx|yarn|pnpm)(?![\w.-])/, 'use bun / bunx'],
  // pip itself, but not `uv pip install`, which is uv.
  [/(?<!\buv\s+)\bpip3?\s+install\b|-m\s+pip\s+install\b/, 'use uv'],
];

/** Whether the file runs commands, so the command check needs its text. */
export function runsCommands(file: string): boolean {
  return commandFile.test(file);
}

/**
 * Problems with one repo file: a forbidden lockfile or manifest by its name, and
 * forbidden commands in `text` when the file runs commands.
 */
export function packageProblems(file: string, text: string | undefined): string[] {
  const problems: string[] = [];
  for (const [pattern, why] of forbiddenFiles) {
    if (pattern.test(basename(file))) problems.push(`${file}: ${why}`);
  }
  if (text === undefined || !runsCommands(file)) return problems;
  text.split('\n').forEach((line, i) => {
    for (const [pattern, why] of forbiddenCommands) {
      if (pattern.test(line)) problems.push(`${file}:${i + 1}: ${line.trim()} (${why})`);
    }
  });
  return problems;
}

if (import.meta.main) {
  // Tracked files plus new ones not yet committed (ignored files excluded).
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  const problems: string[] = [];
  for (const file of files) {
    let text: string | undefined;
    if (runsCommands(file)) {
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        // deleted but not yet staged
      }
    }
    problems.push(...packageProblems(file, text));
  }

  if (problems.length) {
    console.error('Packages: bun for JS, uv for Python (AGENTS.md).\n');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('Package managers OK: bun and uv only.');
}
