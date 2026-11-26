import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = process.argv.slice(2).filter((x) => x !== '--')[0] || 'wrangler.production.json';
let config;
try {
  config = JSON.parse(await readFile(file, 'utf8'));
} catch {
  throw Error(
    'Create wrangler.production.json with real provisioned resource IDs first. See CLOUDFLARE_DEPLOYMENT.md.',
  );
}
if (
  !['production', 'staging'].includes(config.vars?.ENVIRONMENT) ||
  config.vars?.CHAIN_ID !== '84532' ||
  config.vars?.MAINNET_FINANCIAL_ENABLED !== 'false' ||
  !config.d1_databases?.[0]?.database_id ||
  config.d1_databases[0].database_id.startsWith('00000000') ||
  !config.r2_buckets?.[0]?.bucket_name
)
  throw Error(
    'Deployment blocked: production/staging bindings and testnet-only configuration are required.',
  );
if (config.vars.RESULT_SIGNER_KEY || config.vars.EMAIL_API_KEY)
  throw Error('Use Wrangler secrets, never plaintext configuration credentials.');
const result = spawnSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', file],
  { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' } },
);
process.exit(result.status ?? 1);
