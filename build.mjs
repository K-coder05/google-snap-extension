import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

// hook.js runs in the page's own global scope (MAIN world) — IIFE format is
// mandatory there so bundler globals never leak into a live page.
const entries = [
  { in: 'src/content/hook.js', out: 'dist/hook.js', format: 'iife' },
  { in: 'src/content/bridge.js', out: 'dist/bridge.js', format: 'iife' }
];

const contexts = await Promise.all(
  entries.map(({ in: entryPoint, out: outfile, format }) =>
    esbuild.context({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      format,
      target: 'chrome111',
      logLevel: 'info'
    })
  )
);

if (watch) {
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(contexts.map((ctx) => ctx.rebuild()));
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
