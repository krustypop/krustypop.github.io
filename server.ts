import { watch } from 'node:fs';
import { resolve, sep } from 'node:path';

const ROOT = import.meta.dir;
const transpiler = new Bun.Transpiler({ loader: 'ts' });

const RELOAD_PATH = '/__reload';
const RELOAD_SNIPPET = `<script>new EventSource('${RELOAD_PATH}').onmessage = () => location.reload();</script>`;
const WATCH_IGNORE = /(^|\/)(node_modules|dist|\.git|\.claude)(\/|$)/;

// Full-page reload over SSE: the scene holds too much state for module-level hot swapping.
function createReloader() {
  const encoder = new TextEncoder();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function notify() {
    for (const c of clients) {
      // A tab closing mid-send leaves a closed controller behind; drop it instead of crashing the server.
      try {
        c.enqueue(encoder.encode('data: reload\n\n'));
      } catch {
        clients.delete(c);
      }
    }
  }

  watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || WATCH_IGNORE.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(notify, 60);
  });

  return () => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    return new Response(
      new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
          clients.add(c);
          c.enqueue(encoder.encode(': connected\n\n'));
        },
        // Receives the cancel reason, not the controller.
        cancel() {
          clients.delete(controller);
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } },
    );
  };
}

export function createServer(port: number, { reload = false } = {}) {
  const subscribe = reload ? createReloader() : undefined;
  return Bun.serve({
    port,
    idleTimeout: reload ? 0 : undefined,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      if (subscribe && pathname === RELOAD_PATH) return subscribe();
      const path = resolve(ROOT, `.${decodeURIComponent(pathname)}`);
      if (path !== ROOT && !path.startsWith(ROOT + sep)) return new Response('Forbidden', { status: 403 });

      const file = Bun.file(pathname.endsWith('/') ? `${path}/index.html` : path);
      if (!(await file.exists())) return new Response('Not found', { status: 404 });
      // No caching, so edits show up on reload.
      const headers = { 'Cache-Control': 'no-store' };
      // Browsers can't run TypeScript: strip types per request, no bundling.
      if (path.endsWith('.ts')) {
        const js = transpiler.transformSync(await file.text());
        return new Response(js, { headers: { ...headers, 'Content-Type': 'text/javascript' } });
      }
      if (subscribe && file.name?.endsWith('index.html')) {
        const html = (await file.text()).replace('</body>', `${RELOAD_SNIPPET}</body>`);
        return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
      }
      return new Response(file, { headers });
    },
  });
}

if (import.meta.main) {
  const port = Number(process.env.PORT) || 4100;
  try {
    console.log(`CV avenue → http://localhost:${createServer(port, { reload: true }).port}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
    console.error(`Port ${port} is already in use (is another dev server running?).`);
    console.error(`Free it with: kill $(lsof -ti :${port})\nor pick another port: PORT=${port + 1} bun dev`);
    process.exit(1);
  }
}
