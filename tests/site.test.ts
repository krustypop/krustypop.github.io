import { afterAll, describe, expect, test } from 'bun:test';
import pkg from '../package.json';
import { build } from '../build.ts';
import { createServer } from '../server.ts';

const server = createServer(0);
const url = (path: string) => `http://localhost:${server.port}${path}`;
afterAll(() => server.stop(true));

describe('dev server', () => {
  test.each(['/', '/src/main.ts', '/style.css'])('serves %s', async (path) => {
    const res = await fetch(url(path));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('serves TypeScript as JavaScript', async () => {
    const res = await fetch(url('/src/main.ts'));
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).not.toMatch(/:\s*(string|number|boolean)\b/);
  });

  test('404s on missing files', async () => {
    expect((await fetch(url('/nope.js'))).status).toBe(404);
  });

  test('refuses paths outside the project', async () => {
    expect((await fetch(url('/..%2f..%2fetc%2fhosts'))).status).toBe(403);
  });
});

test('dev reload injects an SSE client and streams events', async () => {
  const live = createServer(0, { reload: true });
  const base = `http://localhost:${live.port}`;
  expect(await (await fetch(`${base}/`)).text()).toContain('/__reload');
  const res = await fetch(`${base}/__reload`);
  expect(res.headers.get('content-type')).toBe('text/event-stream');
  await res.body!.cancel();
  live.stop(true);
});

test('the importmap loads the same three.js version as package.json', async () => {
  const html = await Bun.file(new URL('../index.html', import.meta.url)).text();
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]);
  for (const target of Object.values(map.imports)) {
    expect(target).toContain(`three@${pkg.devDependencies.three}/`);
  }
});

test('the build emits a static site that keeps three external', async () => {
  const out = `${process.env.TMPDIR ?? '/tmp'}/cv-avenue-build-${Date.now()}`;
  await build(out);
  const html = await Bun.file(`${out}/index.html`).text();
  expect(html).toContain('src="main.js"');
  expect(await Bun.file(`${out}/style.css`).exists()).toBe(true);
  expect(await Bun.file(`${out}/main.js`).text()).toMatch(/from\s*"three"/);
});
