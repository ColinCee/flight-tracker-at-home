import { describe, expect, it } from 'vitest';
import { checkLook, type Source } from './look';

const lines = (sources: Source[]) => checkLook(sources).problems.map((p) => `${p.file}:${p.line}`);
const lineWith = (text: string, needle: string) =>
  text.split('\n').findIndex((line) => line.includes(needle)) + 1;

// apps/frontend/src/styles.css before #132 moved its last literals into tokens (9353207^),
// cut to the :root block and the rules around them.
const stylesBefore132 = `@import "tailwindcss";

/* Neutral: greys for every piece of chrome, so the aircraft are the only colour. */
:root {
  color-scheme: dark;
  --ink: #111214;
  --sheet: #18191b;
  --raise: #242528;
  --line: #36383c;
  --text: #f4f4f5;
  --dim: #a9acb1;
  --landing: #ffb347;
  --departing: #4fd6c4;
  --selected: #5aa9ff;
  --emergency: #ff5c5c;
  --bar: #3a3c40;
  --radius: 8px;
  --shadow: 0 6px 20px rgb(0 0 0 / 0.45);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --font: "Atkinson Hyperlegible Next Variable", system-ui, sans-serif;
}

.sheet {
  padding: 0 16px max(env(safe-area-inset-bottom), 12px);
  background: var(--sheet);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -10px 30px rgb(0 0 0 / 0.5);
  touch-action: none;
  transition: height 300ms var(--ease-out);
}
.chip[aria-pressed="true"] {
  background: var(--text);
  border-color: var(--text);
  color: var(--ink);
}
.chip[aria-pressed="true"] .chip-n {
  color: #55585d;
}

/* MapLibre's attribution: themed, and clear of the search bar on phones. */
.maplibregl-map .maplibregl-ctrl.maplibregl-ctrl-attrib {
  background: rgb(24 25 27 / 0.8);
  color: var(--dim);
  font-family: var(--font);
}
`;

describe('checkLook', () => {
  it('flags the colour literals #132 moved into tokens, and none of the :root tokens', () => {
    const css = 'src/styles.css';
    expect(lines([{ file: css, text: stylesBefore132 }])).toEqual([
      `${css}:${lineWith(stylesBefore132, 'rgb(0 0 0 / 0.5)')}`,
      `${css}:${lineWith(stylesBefore132, '#55585d')}`,
      `${css}:${lineWith(stylesBefore132, 'rgb(24 25 27')}`,
    ]);
  });

  it("caps the radius of a class used on a <button> at 8px, but not a surface's", () => {
    const tsx = {
      file: 'src/a.tsx',
      text: '<div className="panel"><button className="pill">Go</button><button className="ok" /></div>',
    };
    const css = {
      file: 'src/a.css',
      text: '.pill { border-radius: 12px; }\n.ok { border-radius: 8px; }\n.panel { border-radius: 16px; }\n',
    };
    expect(lines([tsx, css])).toEqual(['src/a.css:1']);
  });

  it('flags rounded-full on a control, not on other elements', () => {
    const text = '<span className="rounded-full" />\n<button\n  className="h-8 rounded-full"\n/>';
    expect(lines([{ file: 'src/a.tsx', text }])).toEqual(['src/a.tsx:2']);
  });

  it('lets a look-ok comment exempt the declaration after it', () => {
    const text = '.logo {\n  /* look-ok: brand colour */\n  color: #e11;\n  background: #fff;\n}\n';
    expect(lines([{ file: 'src/a.css', text }])).toEqual(['src/a.css:4']);
  });

  it('flags named colours in CSS but, as AGENTS.md says, misses them in TS', () => {
    const sources = [
      { file: 'src/a.css', text: '.x {\n  color: red;\n}\n' },
      { file: 'src/a.ts', text: "export const c = 'red';\n" },
    ];
    expect(lines(sources)).toEqual(['src/a.css:2']);
  });
});
