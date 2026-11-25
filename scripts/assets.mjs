import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('apps/web/public/engine', { recursive: true });
for (const ext of ['js', 'wasm'])
  await copyFile(
    `node_modules/stockfish/bin/stockfish-19-lite-single.${ext}`,
    `apps/web/public/engine/stockfish-19-lite-single.${ext}`,
  );
await copyFile('node_modules/stockfish/Copying.txt', 'apps/web/public/engine/COPYING.txt');
console.log('Stockfish worker, WASM, and GPL license copied.');
