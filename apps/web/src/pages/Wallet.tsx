import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
  useReadContract,
} from 'wagmi';
import { createSiweMessage } from 'viem/siwe';
import { formatUnits, type Address } from 'viem';
import { QRCodeSVG } from 'qrcode.react';
import { Wallet as WalletIcon, ArrowUpRight, Copy, ShieldCheck } from 'lucide-react';
import { api, useAuth, useResource } from '../lib';
import { tokenAbi } from '../../../../packages/shared/contracts';
export default function Wallet() {
  const { user, refresh } = useAuth(),
    navigate = useNavigate(),
    { address, chainId, isConnected } = useAccount(),
    { connectAsync, connectors } = useConnect(),
    { disconnect } = useDisconnect(),
    { switchChainAsync } = useSwitchChain(),
    { data: wallet } = useWalletClient();
  const { data: balance, error: balanceError } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 30000 },
  });
  const { data: config } = useResource<{ configured: boolean; chainId: number; token: Address }>(
    '/web3/config',
  );
  const { data: activity, error: activityError } = useResource<{
    matches: any[];
    transactions: any[];
    confirmations: number;
  }>('/web3/activity');
  const { data: tokens, error: tokenError } = useReadContract({
    address: config?.token,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!config?.configured && chainId === config.chainId,
      refetchInterval: 30000,
    },
  });
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(false);
    }
  }
  const mainnet = chainId === 8453,
    network = mainnet
      ? 'Base Mainnet'
      : chainId === 84532
        ? 'Base Sepolia'
        : chainId === 31337
          ? 'Anvil local'
          : 'Unsupported network';
  const explorer =
    chainId === 8453
      ? 'https://basescan.org'
      : chainId === 84532
        ? 'https://sepolia.basescan.org'
        : '';
  const matches =
    activity?.matches.filter(
      (m) =>
        m.chain_id === chainId &&
        (m.white.toLowerCase() === address?.toLowerCase() ||
          m.black.toLowerCase() === address?.toLowerCase()),
    ) || [];
  const locked = matches
    .filter((m) => m.state >= 2 && m.state <= 4)
    .reduce((sum, m) => sum + BigInt(m.stake), 0n);
  return (
    <div className="page wallet-page">
      <div className="eyebrow">YOUR WALLET. YOUR CONTROL.</div>
      <h1>
        A clear view.
        <br />
        <em>On every chain.</em>
      </h1>
      <p className="muted">
        Your assets stay in your external wallet. ChainMate never holds your keys.
      </p>
      <div className="wallet-dashboard">
        <section className="setup-panel">
          <WalletIcon />
          <h3>{isConnected ? 'Your connected wallet' : 'Choose your wallet'}</h3>
          {!isConnected ? (
            <>
              <p>Connect an installed wallet, then sign in to verify ownership.</p>
              {connectors.map((c) => (
                <button
                  className="button outline"
                  key={c.uid}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await connectAsync({ connector: c });
                    })
                  }
                >
                  {c.name === 'Injected' ? 'Browser wallet' : c.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <code className="wallet-address">{address}</code>
              <label>
                Network
                <select
                  aria-label="Wallet network"
                  value={chainId}
                  disabled={busy}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    run(async () => {
                      await switchChainAsync({ chainId: id });
                    });
                  }}
                >
                  <option value="84532">Base Sepolia — Testnet</option>
                  <option value="8453">Base — Mainnet</option>
                  <option value="31337">Anvil — Local</option>
                  {![31337, 8453, 84532].includes(chainId || 0) && (
                    <option value={chainId}>Unsupported network</option>
                  )}
                </select>
              </label>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!wallet || !address || ![31337, 8453, 84532].includes(chainId || 0))
                      throw Error('Choose a supported network first.');
                    const { nonce } = await api('/web3/nonce');
                    const message = createSiweMessage({
                      address,
                      chainId: chainId!,
                      domain: location.host,
                      uri: location.origin,
                      version: '1',
                      nonce,
                      issuedAt: new Date(),
                      expirationTime: new Date(Date.now() + 300000),
                      statement: user
                        ? 'Link this wallet to your ChainMate account. No token transfer.'
                        : 'Sign in to ChainMate. No token transfer.',
                    });
                    const signature = await wallet.signMessage({ message });
                    await api('/web3/verify', { message, signature });
                    await refresh();
                    setStatus('Wallet ownership verified.');
                    if (!user) navigate('/dashboard');
                  })
                }
              >
                {user ? 'Verify / link wallet' : 'Sign in with Ethereum'}
              </button>
              <button onClick={() => disconnect()}>Disconnect</button>
            </>
          )}
        </section>
        <section className="setup-panel">
          <div className="eyebrow">EXTERNAL WALLET / {network.toUpperCase()}</div>
          <div className="wallet-amount">
            {balance
              ? Number(formatUnits(balance.value, balance.decimals)).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })
              : '—'}{' '}
            <small>ETH</small>
          </div>
          {balanceError && (
            <p className="error">
              Native balance could not load. Check your network and RPC connection.
            </p>
          )}
          <p>
            {mainnet
              ? 'Real Mainnet assets in your external wallet.'
              : 'Test-network ETH has no monetary value.'}
          </p>
          {chainId === config?.chainId && config?.configured && (
            <>
              <div className="balance">
                <span>DEMO TOKENS IN WALLET</span>
                <strong>{tokens === undefined ? '—' : formatUnits(tokens, 6)} cmUSD</strong>
              </div>
              {tokenError && <p className="error">Demo-token balance is unavailable.</p>}
              <p>Confirmed active escrow: {formatUnits(locked, 6)} cmUSD</p>
              <small>
                Indexed active and disputed matches only. Funding transactions may still be pending
                confirmation.
              </small>
              <Link className="button outline" to="/arena">
                Open testnet Arena <ArrowUpRight size={16} />
              </Link>
            </>
          )}
          {mainnet && (
            <div className="notice">
              <ShieldCheck />
              <span>
                Mainnet wallet connectivity and balance reads are enabled. Real-money matches,
                deposits and payouts are unavailable.
              </span>
            </div>
          )}
        </section>
        {address && (
          <section className="setup-panel receive-panel">
            <div>
              <h3>Receive to your wallet</h3>
              <p>
                Use {network} only. Confirm the network with the sender before transferring assets.
              </p>
              <button
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(address);
                    setStatus('Wallet address copied.');
                  })
                }
              >
                <Copy size={16} /> Copy address
              </button>
              {explorer && (
                <a href={explorer + '/address/' + address} target="_blank" rel="noreferrer">
                  View on explorer
                </a>
              )}
            </div>
            <QRCodeSVG
              value={`ethereum:${address}@${chainId}`}
              size={150}
              bgColor="#f1f0ee"
              fgColor="#121416"
              marginSize={3}
            />
          </section>
        )}
      </div>
      <p role="status">{status}</p>
      <section className="wallet-history">
        <h2>Your Arena activity.</h2>
        {!user ? (
          <p>
            <Link to="/login">Sign in</Link> to see verified wallet activity.
          </p>
        ) : activityError ? (
          <p className="error">{activityError}</p>
        ) : !matches.length ? (
          <p className="muted">No confirmed matches for this connected wallet and network.</p>
        ) : (
          matches.map((m) => (
            <Link className="wallet-match" to={'/arena/match/' + m.id} key={m.id}>
              <span>
                {m.id.slice(0, 10)}…{m.id.slice(-6)}
              </span>
              <strong>{formatUnits(BigInt(m.stake), 6)} cmUSD / player</strong>
              <span>
                {
                  [
                    'Unknown',
                    'Funding',
                    'Active',
                    'Pending result',
                    'Disputed',
                    'Settled',
                    'Refunded',
                  ][m.state]
                }
              </span>
            </Link>
          ))
        )}
        {activity?.transactions
          .filter((t) => t.chain_id === chainId)
          .map((t) => (
            <div className="wallet-match" key={t.tx + t.log_index}>
              <span>{t.name}</span>
              {explorer ? (
                <a href={explorer + '/tx/' + t.tx} target="_blank" rel="noreferrer">
                  {t.tx.slice(0, 18)}… ↗
                </a>
              ) : (
                <code>{t.tx.slice(0, 18)}…</code>
              )}
              <small>Block {t.block_number}</small>
            </div>
          ))}
      </section>
    </div>
  );
}
