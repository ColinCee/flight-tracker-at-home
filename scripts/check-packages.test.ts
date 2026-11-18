import { describe, expect, it } from 'vitest';
import { packageProblems } from './check-packages';

const where = (file: string, text?: string) =>
  packageProblems(file, text).map((p) => p.slice(0, p.indexOf(': ')));

describe('packageProblems', () => {
  it('flags npm and npx lines this repo once had', () => {
    // apps/frontend/Dockerfile before cf5a53f, and .mise.toml before 4ff3605.
    const dockerfile =
      'FROM node:26-slim AS builder\nWORKDIR /app\nRUN corepack enable && npm install -g bun@1.4.4\n';
    const mise = '[tasks.rulesync]\nrun = "npx rulesync@26.0.0 generate"\n';
    expect(where('apps/frontend/Dockerfile', dockerfile)).toEqual(['apps/frontend/Dockerfile:3']);
    expect(where('.mise.toml', mise)).toEqual(['.mise.toml:2']);
  });

  it('flags other managers’ lockfiles at any depth', () => {
    const lockfiles = [
      'package-lock.json',
      'apps/frontend/yarn.lock',
      'pnpm-lock.yaml',
      'apps/backend/requirements-dev.txt',
      'apps/backend/poetry.lock',
    ];
    for (const file of lockfiles) expect(where(file)).toEqual([file]);
  });

  it('flags pip install but not names, uv pip, pip uninstall or docs', () => {
    const dockerfile = [
      'RUN pip install uv',
      'RUN uv pip install --system httpx',
      // The backend Dockerfile since 46096e2.
      'RUN python3 -m pip uninstall --yes pip \\',
    ].join('\n');
    expect(where('apps/backend/Dockerfile', dockerfile)).toEqual(['apps/backend/Dockerfile:1']);
    expect(where('package.json', '{ "scripts": { "all": "npm-run-all -p a b" } }')).toEqual([]);
    expect(where('README.md', 'Not npm install: bun add.')).toEqual([]);
  });
});
