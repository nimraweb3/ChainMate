import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const [tool, ...args] = process.argv.slice(2);
const binary = require.resolve(`@foundry-rs/${tool}/bin.mjs`);
const p = spawn(process.execPath, [binary, ...args], {
  stdio: 'inherit',
  env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: '1' },
});
p.on('exit', (code) => process.exit(code || 0));
