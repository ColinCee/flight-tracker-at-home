// Enforces the checkable half of the look (AGENTS.md):
// - CSS colours come from the :root tokens in apps/frontend/src/styles.css; no
//   colour literals elsewhere in CSS, and none in TS/TSX strings or Tailwind classes.
// - Radii stay small: var(--radius), or literal radii of at most 8px; no pills.
// A deliberate exception goes on the line above or the same line:
//   /* look-ok: why */
// Not checked: deck.gl colour arrays ([r, g, b, a]) in TS, which carry the
// aircraft and busy-times colours by design.
// Run with `bun scripts/check-look.ts` (part of `mise run check`).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_RADIUS_PX = 8;
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', 'apps/frontend/src'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter((f) => f && !f.endsWith('/generated.ts'));

const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const namedColour =
  /\b(white|black|red|green|blue|yellow|orange|purple|violet|pink|gr[ae]y|teal|cyan|magenta|amber|navy|silver|gold)\b/i;
const colourProperty =
  /(color|background|border|outline|fill|stroke|shadow|caret|accent|decoration)/;
const radiusProperty = /^\s*border(-[a-z]+)*-radius\s*:/;

const problems: string[] = [];
const report = (file: string, line: number, text: string, why: string) =>
  problems.push(`${file}:${line}: ${text.trim()}\n      ${why}`);

function radiusProblem(value: string): string | null {
  const rest = value
    .replace(/calc\([^;]*var\(--radius\)[^;]*\)/g, '')
    .replace(/var\(--radius\)/g, '')
    .trim();
  for (const part of rest.split(/[\s/]+/).filter(Boolean)) {
    if (part === '0') continue;
    const px = /^(\d+(?:\.\d+)?)px$/.exec(part);
    if (!px) return `radius "${part}": use var(--radius) or px up to ${MAX_RADIUS_PX}`;
    if (Number(px[1]) > MAX_RADIUS_PX) return `radius ${part} is over ${MAX_RADIUS_PX}px`;
  }
  return null;
}

function checkCss(file: string, text: string) {
  let inRoot = false;
  let inComment = false;
  const lines = text.split('\n');
  lines.forEach((raw, i) => {
    const exempt = raw.includes('look-ok:') || (lines[i - 1] ?? '').includes('look-ok:');
    // Drop comments, carrying multi-line ones across lines.
    let line = '';
    let rest = raw;
    while (rest) {
      if (inComment) {
        const end = rest.indexOf('*/');
        if (end < 0) rest = '';
        else {
          rest = rest.slice(end + 2);
          inComment = false;
        }
      } else {
        const start = rest.indexOf('/*');
        if (start < 0) {
          line += rest;
          rest = '';
        } else {
          line += rest.slice(0, start);
          rest = rest.slice(start + 2);
          inComment = true;
        }
      }
    }
    if (/^\s*:root\s*\{/.test(line)) inRoot = true;
    if (inRoot) {
      const radius = /^\s*--radius\s*:\s*([^;]+);/.exec(line);
      if (radius) {
        const why = radiusProblem(radius[1]);
        if (why) report(file, i + 1, raw, `--radius: ${why}`);
      }
      if (line.includes('}')) inRoot = false;
      return;
    }
    if (exempt) return;
    const decl = /^\s*([\w-]+)\s*:\s*(.+?);?\s*$/.exec(line);
    if (!decl || line.trim().endsWith('{')) return;
    const [, prop, value] = decl;
    if (colourLiteral.test(value) || (colourProperty.test(prop) && namedColour.test(value))) {
      report(file, i + 1, raw, 'colour literal: add a token to :root in styles.css and use var()');
    }
    if (radiusProperty.test(line)) {
      const why = radiusProblem(value);
      if (why) report(file, i + 1, raw, why);
    }
  });
}

const stringColour = /(['"`])(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab)\([^'"`]*\))\1/;
const pillClass = /\brounded-(xl|2xl|3xl|4xl|full|\[)/;
const arbitraryColourClass = /\b[a-z-]+-\[(#|rgb|hsl|oklch)/;

function checkTs(file: string, text: string) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('look-ok:') || (lines[i - 1] ?? '').includes('look-ok:')) return;
    if (stringColour.test(line)) {
      report(file, i + 1, line, 'colour literal: use a CSS token (var(--...)) from styles.css');
    }
    if (pillClass.test(line)) {
      report(file, i + 1, line, `Tailwind radius over ${MAX_RADIUS_PX}px: use rounded-lg or less`);
    }
    if (arbitraryColourClass.test(line)) {
      report(file, i + 1, line, 'arbitrary Tailwind colour: use a CSS token');
    }
  });
}

for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted but not yet staged
  }
  if (file.endsWith('.css')) checkCss(file, text);
  else if (/\.(ts|tsx)$/.test(file)) checkTs(file, text);
}

if (problems.length) {
  console.error(
    'Look: colours come from the :root tokens; radii stay at 8px or less (AGENTS.md).\n',
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('Look OK: colours from tokens, radii at most 8px.');
