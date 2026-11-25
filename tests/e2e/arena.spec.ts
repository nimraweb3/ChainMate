import { test, expect, type BrowserContext } from '@playwright/test';
import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { anvil } from 'viem/chains';
import { tokenAbi } from '../../packages/shared/contracts';
// A deterministic EIP-1193 test adapter backed by two distinct unlocked Anvil wallets.
// No extension, real wallet, private key, or public network is used by this test.
async function inject(context: BrowserContext, address: Address) {
  await context.exposeBinding(
    'localWalletRequest',
    async (_source, { method, params }: { method: string; params: any[] }) => {
      if (['eth_requestAccounts', 'eth_accounts'].includes(method)) return [address];
      if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
      if (method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
      if (method === 'wallet_switchEthereumChain') return null;
      const r = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
      });
      const j = await r.json();
      if (j.error) throw Error(j.error.message);
      return j.result;
    },
  );
  await context.addInitScript(() => {
    const callbacks: Record<string, ((...args: unknown[]) => void)[]> = {};
    (window as any).ethereum = {
      isMetaMask: true,
      isConnected: () => true,
      request: (args: any) => (window as any).localWalletRequest(args),
      on: (event: string, fn: (...args: unknown[]) => void) => {
        (callbacks[event] ||= []).push(fn);
      },
      removeListener: (event: string, fn: (...args: unknown[]) => void) => {
        callbacks[event] = (callbacks[event] || []).filter((x) => x !== fn);
      },
    };
  });
}
test('two wallets fund, play, authorize and settle a real local escrow', async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const config = await (await request.get('/api/web3/config')).json();
  test.skip(
    !config.configured,
    'Requires pnpm chain and pnpm contracts:deploy, then an API restart.',
  );
  expect(config.chainId).toBe(31337);
  const rpc = createPublicClient({ chain: anvil, transport: http('http://127.0.0.1:8545') });
  const wallets = createWalletClient({ chain: anvil, transport: http('http://127.0.0.1:8545') });
  const [wa, wb] = await wallets.getAddresses();
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  await inject(ca, wa);
  await inject(cb, wb);
  const a = await ca.newPage(),
    b = await cb.newPage();
  for (const p of [a, b]) {
    await p.goto('/arena');
    await p.getByRole('button', { name: 'Connect wallet' }).click();
    await p.getByRole('button', { name: 'Sign in with Ethereum' }).click();
    await expect(p.getByText('Wallet ownership verified.')).toBeVisible();
    await p.getByRole('button', { name: 'Get free test tokens' }).click();
    await expect(p.locator('.transaction strong')).toBeVisible();
  }
  const beforeA = await rpc.readContract({
      address: config.token,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [wa],
    }),
    beforeB = await rpc.readContract({
      address: config.token,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [wb],
    });
  await a.getByLabel('Opponent wallet address').fill(wb);
  await a.getByRole('button', { name: 'Create test-token match' }).click();
  await expect(a).toHaveURL(/arena\/match\/0x/);
  const matchUrl = a.url();
  await b.goto(matchUrl);
  for (const p of [a, b]) {
    await p.getByRole('button', { name: 'Approve & deposit 5 cmUSD' }).click();
    await expect(p.locator('.transaction strong')).toBeVisible();
  }
  await expect(a.getByRole('button', { name: 'Enter verified chess match' })).toBeVisible({
    timeout: 15000,
  });
  await a.getByRole('button', { name: 'Enter verified chess match' }).click();
  await b.getByRole('button', { name: 'Enter verified chess match' }).click();
  await expect(a.getByLabel('Keyboard move')).toBeEnabled();
  await a.getByLabel('Keyboard move').fill('e2e4');
  await a.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(b.locator('.move-pair button').first()).toHaveText('e4');
  await b.getByRole('button', { name: 'Resign', exact: true }).click();
  await b.getByRole('button', { name: 'Confirm resignation' }).click();
  await expect(a.getByText(/wins · Resignation/)).toBeVisible();
  await a.goto(matchUrl);
  await a.getByRole('button', { name: 'Submit completed game result' }).click();
  await expect(a.getByText('Result pending', { exact: true })).toBeVisible();
  await fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_increaseTime', params: [121] }),
  });
  await fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'evm_mine', params: [] }),
  });
  await a.clock.install();
  await a.clock.fastForward(122000);
  await expect(a.getByRole('button', { name: 'Settle verified result' })).toBeEnabled();
  await a.getByRole('button', { name: 'Settle verified result' }).click();
  await expect(a.getByText('Settled: white receives the pot.')).toBeVisible();
  expect(
    await rpc.readContract({
      address: config.token,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [wa],
    }),
  ).toBe(beforeA + 5000000n);
  expect(
    await rpc.readContract({
      address: config.token,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [wb],
    }),
  ).toBe(beforeB - 5000000n);
  await a.screenshot({ path: '.local/arena-settled.png', fullPage: true });
  await ca.close();
  await cb.close();
});
