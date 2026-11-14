import esbuild from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');
const distDir = path.join(apiRoot, 'dist');
const entryFile = path.join(distDir, 'main.js');
const bundleTempFile = path.join(distDir, 'main.bundle.js');

if (!fs.existsSync(entryFile)) {
  throw new Error(`Expected compiled Nest entrypoint at ${entryFile}`);
}

const require = createRequire(path.join(apiRoot, 'package.json'));
const prismaClientEntry = require.resolve('@prisma/client');
const dotPrismaDir = path.dirname(
  require.resolve('.prisma/client/default', {
    paths: [path.dirname(prismaClientEntry)],
  }),
);

await esbuild.build({
  entryPoints: [entryFile],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: bundleTempFile,
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    'class-transformer/storage',
  ],
  logLevel: 'info',
});

const stagedDir = path.join(apiRoot, '.dist-vercel-staging');
fs.rmSync(stagedDir, { recursive: true, force: true });
fs.mkdirSync(stagedDir, { recursive: true });

fs.renameSync(bundleTempFile, path.join(stagedDir, 'main.js'));

for (const fileName of fs.readdirSync(dotPrismaDir)) {
  const isPrismaRuntimeAsset =
    fileName === 'schema.prisma' ||
    fileName.endsWith('.node') ||
    fileName.endsWith('.wasm');

  if (!isPrismaRuntimeAsset || fileName.includes('.tmp')) {
    continue;
  }

  fs.copyFileSync(
    path.join(dotPrismaDir, fileName),
    path.join(stagedDir, fileName),
  );
  console.log(`Copied Prisma runtime asset to dist/: ${fileName}`);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.renameSync(stagedDir, distDir);
console.log('Self-contained Vercel API bundle ready at dist/main.js');
