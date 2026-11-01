// Temporary: shows errors on screen with ?debug, for phones without dev tools.
export function installDebugOverlay() {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;left:0;right:0;top:0;max-height:60vh;overflow:auto;z-index:9999;margin:0;padding:8px;font:11px/1.35 monospace;color:#fff;background:rgba(120,0,0,.88);white-space:pre-wrap;word-break:break-all';
  document.body.appendChild(box);
  const add = (s: string) => {
    box.textContent += `${s}\n`;
  };
  const gl = document.createElement('canvas').getContext('webgl2');
  add(`ua ${navigator.userAgent}`);
  add(`webgl2 ${gl ? gl.getParameter(gl.VERSION) : 'NONE'} dpr ${devicePixelRatio}`);
  for (const level of ['error', 'warn'] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      add(`${level}: ${args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' ')}`.slice(0, 600));
      orig(...args);
    };
  }
  window.addEventListener('error', (e) => add(`onerror: ${e.message} @${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => add(`rejection: ${String(e.reason?.stack ?? e.reason)}`.slice(0, 600)));
  setInterval(() => {
    const c = document.querySelectorAll('canvas');
    const s = [...c].map((x) => `${x.width}x${x.height}/${x.clientWidth}x${x.clientHeight}`).join(' ');
    const line = `canvases ${s}`;
    if (!box.textContent?.includes(line)) add(line);
  }, 3000);
}
