// Enforces the checkable half of the look rule in AGENTS.md:
// - Colours come from the :root tokens in apps/frontend/src/styles.css: no colour
//   literals elsewhere in CSS, and none in TS/TSX strings or Tailwind classes.
// - No pill-shaped controls: buttons, inputs and other controls keep radii of at
//   most 8px (var(--radius) or a literal), in CSS, Tailwind classes and inline styles.
//   Surfaces such as the sheet are not controls, so their radii are not capped.
// Not checked: "greys for every control" (which colour a control uses), the
// deck.gl colour arrays ([r, g, b, a]) in TS, and fonts.
// A deliberate exception: put /* look-ok: why */ just before the rule or declaration.
// Run with `bun scripts/check-look.ts` (part of `mise run check`).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const MAX_RADIUS_PX = 8;

export type Source = { file: string; text: string };
export type Problem = { file: string; line: number; snippet: string; why: string };

function radiusProblem(value: string): string | null {
  const rest = value
    .replace(/calc\([^;]*var\(--radius\)[^;]*\)/g, '')
    .replace(/var\(--radius\)/g, '')
    .trim();
  for (const part of rest.split(/[\s/]+/).filter(Boolean)) {
    if (part === '0') continue;
    const px = /^(\d+(?:\.\d+)?)(px)?$/.exec(part);
    if (!px) return `radius "${part}": use var(--radius) or px up to ${MAX_RADIUS_PX}`;
    if (Number(px[1]) > MAX_RADIUS_PX) return `radius ${part} is over ${MAX_RADIUS_PX}px`;
  }
  return null;
}

// --- TSX: control elements and the classes they carry ---

const controlTag = /<(button|input|select|textarea)\b/g;
const roleControl = /\brole=["'](button|tab|switch|checkbox|radio|slider)["']/g;

/** The opening tag starting at `start`, skipping `>` inside {...}, strings and `=>`. */
function openingTag(text: string, start: number): string {
  let depth = 0;
  let quote = '';
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && text[i - 1] !== '=') return text.slice(start, i + 1);
  }
  return text.slice(start);
}

const pillClass = /\brounded(-[trbl]{1,2}|-[se]{1,2})?-(xl|2xl|3xl|4xl|full|\[[^\]]*\])/;

// --- CSS ---

const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
const namedColour =
  /\b(white|black|red|green|blue|yellow|orange|purple|violet|pink|gr[ae]y|teal|cyan|magenta|amber|navy|silver|gold)\b/i;
const colourProperty =
  /(color|background|border|outline|fill|stroke|shadow|caret|accent|decoration)/;

// --- TS/TSX colour strings and Tailwind colours ---

const stringColour = /(['"`])(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab)\([^'"`]*\))\1/;
const arbitraryColourClass = /\b[a-z-]+-\[(#|rgb|hsl|oklch)/;

/**
 * Look problems in the frontend's sources, in the order the command prints them:
 * TSX controls first, then each CSS, TS and TSX file in turn. `controlClasses` are the
 * class names seen on TSX controls; a CSS rule for one of them is a control's rule.
 */
export function checkLook(sources: Source[]): {
  problems: Problem[];
  controlClasses: Set<string>;
} {
  const problems: Problem[] = [];
  const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;
  const report = (file: string, text: string, index: number, snippet: string, why: string) =>
    problems.push({ file, line: lineOf(text, index), snippet: snippet.trim(), why });

  const controlClasses = new Set<string>();
  const controlTags: { file: string; text: string; index: number; tag: string }[] = [];
  for (const { file, text } of sources) {
    if (!file.endsWith('.tsx')) continue;
    const starts = [...text.matchAll(controlTag)].map((m) => m.index);
    for (const m of text.matchAll(roleControl)) starts.push(text.lastIndexOf('<', m.index));
    for (const index of new Set(starts)) {
      const tag = openingTag(text, index);
      controlTags.push({ file, text, index, tag });
      // Static class names in className="..." or className={`...`} (skipping ${...}).
      for (const m of tag.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
        const names = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
        for (const name of names.split(/\s+/).filter(Boolean)) controlClasses.add(name);
      }
    }
  }

  for (const { file, text, index, tag } of controlTags) {
    const firstLine = tag.split('\n')[0] ?? '';
    if (pillClass.test(tag)) {
      report(file, text, index, firstLine, 'control with a large or pill radius class');
    }
    const inline = /borderRadius:\s*(?:'([^']*)'|"([^"]*)"|(\d+(?:\.\d+)?))/.exec(tag);
    if (inline) {
      const why = radiusProblem(inline[1] ?? inline[2] ?? inline[3] ?? '');
      if (why) report(file, text, index, firstLine, `control's inline ${why}`);
    }
  }

  /** Whether a selector's subject (its last compound) is a control. */
  function selectsControl(selector: string): boolean {
    return selector.split(',').some((part) => {
      const subject =
        part
          .trim()
          .split(/\s*[\s>+~]\s*/)
          .pop() ?? '';
      if (/^(button|input|select|textarea)\b/.test(subject)) return true;
      if (/\[role=["']?(button|tab|switch|checkbox|radio|slider)/.test(subject)) return true;
      return [...subject.matchAll(/\.([\w-]+)/g)].some((m) => controlClasses.has(m[1] ?? ''));
    });
  }

  function checkCss(file: string, text: string) {
    // Blank out comments (keeping offsets), remembering where look-ok ones end.
    const exemptAt: number[] = [];
    const css = text.replace(/\/\*[\s\S]*?\*\//g, (c, at: number) => {
      if (c.includes('look-ok:')) exemptAt.push(at + c.length);
      return c.replace(/[^\n]/g, ' ');
    });
    const exempt = (start: number) =>
      exemptAt.some((end) => end <= start && /^\s*$/.test(css.slice(end, start)));

    const selectors: { text: string; exempt: boolean }[] = [];
    let segmentStart = 0;
    const declaration = (start: number, end: number) => {
      const raw = css.slice(start, end);
      const m = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(raw);
      const rule = selectors.at(-1);
      if (!m || !rule || rule.text.startsWith('@')) return;
      const [, prop = '', value = ''] = m;
      const at = start + raw.search(/\S/);
      if (rule.text === ':root') {
        if (prop === '--radius') {
          const why = radiusProblem(value);
          if (why) report(file, text, at, raw, `--radius: ${why}`);
        }
        return;
      }
      if (rule.exempt || exempt(at)) return;
      if (colourLiteral.test(value) || (colourProperty.test(prop) && namedColour.test(value))) {
        report(
          file,
          text,
          at,
          raw,
          'colour literal: add a token to :root in styles.css and use var()',
        );
      }
      if (/^border(-[a-z]+)*-radius$/.test(prop) && selectsControl(rule.text)) {
        const why = radiusProblem(value);
        if (why) report(file, text, at, raw, `control (${rule.text}): ${why}`);
      }
    };
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === '{') {
        const prelude = css.slice(segmentStart, i);
        const start = segmentStart + prelude.search(/\S/);
        selectors.push({ text: prelude.trim().replace(/\s+/g, ' '), exempt: exempt(start) });
        segmentStart = i + 1;
      } else if (c === ';') {
        declaration(segmentStart, i);
        segmentStart = i + 1;
      } else if (c === '}') {
        declaration(segmentStart, i); // a last declaration without ';'
        selectors.pop();
        segmentStart = i + 1;
      }
    }
  }

  function checkTs(file: string, text: string) {
    const lines = text.split('\n');
    let offset = 0;
    lines.forEach((line, i) => {
      const exempt = line.includes('look-ok:') || (lines[i - 1] ?? '').includes('look-ok:');
      if (!exempt && stringColour.test(line)) {
        report(
          file,
          text,
          offset,
          line,
          'colour literal: use a CSS token (var(--...)) from styles.css',
        );
      }
      if (!exempt && arbitraryColourClass.test(line)) {
        report(file, text, offset, line, 'arbitrary Tailwind colour: use a CSS token');
      }
      offset += line.length + 1;
    });
  }

  for (const { file, text } of sources) {
    if (file.endsWith('.css')) checkCss(file, text);
    else if (/\.(ts|tsx)$/.test(file)) checkTs(file, text);
  }
  return { problems, controlClasses };
}

if (import.meta.main) {
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'apps/frontend/src'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter((f) => f && !f.endsWith('/generated.ts'));
  const sources: Source[] = [];
  for (const file of files) {
    try {
      sources.push({ file, text: readFileSync(file, 'utf8') });
    } catch {
      // deleted but not yet staged
    }
  }
  const { problems, controlClasses } = checkLook(sources);
  if (problems.length) {
    console.error(
      'Look: colours come from the :root tokens; controls are never pill-shaped (AGENTS.md).\n',
    );
    for (const p of problems) console.error(`  ${p.file}:${p.line}: ${p.snippet}\n      ${p.why}`);
    process.exit(1);
  }
  console.log(
    `Look OK: colours from tokens; ${controlClasses.size} control classes and their elements at radii of ${MAX_RADIUS_PX}px or less.`,
  );
}
