import { readFile, writeFile } from 'node:fs/promises';
const [environment, databaseId, bucket, accountId] = process.argv.slice(2);
if (
  !['staging', 'production'].includes(environment) ||
  !databaseId ||
  !/^[0-9a-f-]{36}$/i.test(databaseId) ||
  databaseId.startsWith('00000000') ||
  !bucket ||
  !/^[a-z0-9-]{3,63}$/.test(bucket)
)
  throw Error(
    'Usage: node scripts/prepare-cloudflare.mjs staging|production REAL_D1_UUID REAL_R2_BUCKET [ACCOUNT_ID]',
  );
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
config.name = environment === 'staging' ? 'chainmate-staging' : 'chainmate';
if (accountId) config.account_id = accountId;
config.d1_databases[0].database_id = databaseId;
config.d1_databases[0].database_name = 'chainmate-' + environment;
config.r2_buckets[0].bucket_name = bucket;
config.vars = {
  ENVIRONMENT: environment,
  CHAIN_ID: '84532',
  RPC_URL: 'https://sepolia.base.org',
  MAINNET_FINANCIAL_ENABLED: 'false',
};
await writeFile(`wrangler.${environment}.json`, JSON.stringify(config, null, 2) + '\n');
console.log(
  `Prepared wrangler.${environment}.json with the supplied resource bindings. No resources were created or deployed.`,
);
