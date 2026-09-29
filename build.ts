import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = import.meta.dir;

// Injected at build time only, so local dev visits stay out of the stats.
const ANALYTICS =
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"` +
  ` data-cf-beacon='{"token": "b7d8788c89eb4c598420869f4a89f14d"}'></script>`;

// three stays external: index.html's importmap loads it from the CDN.
export async function build(outdir = join(ROOT, 'dist')) {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [join(ROOT, 'src/main.ts')],
    outdir,
    naming: 'main.js',
    target: 'browser',
    format: 'esm',
    minify: true,
    external: ['three', 'three/addons/*'],
  });
  if (!result.success) throw new AggregateError(result.logs, 'build failed');

  const html = await Bun.file(join(ROOT, 'index.html')).text();
  await Bun.write(
    join(outdir, 'index.html'),
    html.replace('src="src/main.ts"', 'src="main.js"').replace('</head>', `  ${ANALYTICS}\n  </head>`),
  );
  await cp(join(ROOT, 'style.css'), join(outdir, 'style.css'));
}

if (import.meta.main) {
  await build();
  console.log('CV avenue → dist/');
}
