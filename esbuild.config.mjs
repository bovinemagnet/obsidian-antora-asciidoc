import esbuild from 'esbuild';
import process from 'node:process';

const prod = process.argv.includes('--production');

esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', 'child_process', 'util', 'node:child_process', 'node:util'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  outfile: 'main.js',
  logLevel: 'info',
}).catch(() => process.exit(1));
