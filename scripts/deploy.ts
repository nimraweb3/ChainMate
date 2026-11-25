import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createPublicClient, createWalletClient, http, type Hex, type Abi } from 'viem';
import { anvil } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const rpc = 'http://127.0.0.1:8545';
const client = createPublicClient({ chain: anvil, transport: http(rpc) });
if ((await client.getChainId()) !== 31337)
  throw Error('This setup script only deploys to local Anvil (31337).');
execFileSync(
  process.execPath,
  ['scripts/foundry.mjs', 'forge', 'build', '--root', 'packages/contracts'],
  { stdio: 'inherit' },
);
const accounts = await createWalletClient({ chain: anvil, transport: http(rpc) }).getAddresses();
if (!accounts[0]) throw Error('Start Anvil before deployment.');
const wallet = createWalletClient({ chain: anvil, account: accounts[0], transport: http(rpc) });
const key = generatePrivateKey(),
  signer = privateKeyToAccount(key);
async function deploy(name: string, args: unknown[] = []) {
  const artifact = JSON.parse(
    await readFile(`packages/contracts/out/${name}.sol/${name}.json`, 'utf8'),
  );
  const hash = await wallet.deployContract({
    abi: artifact.abi as Abi,
    bytecode: artifact.bytecode.object as Hex,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw Error('Deployment failed');
  return receipt.contractAddress;
}
const token = await deploy('MockToken');
const escrow = await deploy('ChessEscrow', [token, signer.address]);
// Preserve unrelated local configuration; only update owned local-chain fields.
let env = '';
try {
  env = await readFile('.env', 'utf8');
} catch {}
const values = {
  CHAIN_ID: '31337',
  RPC_URL: rpc,
  TOKEN_ADDRESS: token,
  ESCROW_ADDRESS: escrow,
  RESULT_SIGNER_KEY: key,
};
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp('^' + name + '=.*$', 'm');
  env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : env + `\n${name}=${value}`;
}
await writeFile('.env', env.trim() + '\n');
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/deployment.json',
  JSON.stringify({ chainId: 31337, token, escrow, authority: signer.address }, null, 2),
);
console.log(
  'Deployed local mock token and escrow. Public addresses saved to .local/deployment.json. Restart the API to load its private signer configuration.',
);
