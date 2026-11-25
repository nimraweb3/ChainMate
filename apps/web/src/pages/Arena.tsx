import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { createSiweMessage } from 'viem/siwe';
import { formatUnits, isAddress, parseUnits, type Address, type Hex } from 'viem';
import { ShieldCheck, Wallet, LockKeyhole, Scale } from 'lucide-react';
import { escrowAbi, tokenAbi } from '../../../../packages/shared/contracts';
import { api, useAuth, useResource } from '../lib';
type Config = { configured: boolean; chainId: number; address: Address; token: Address };
type Match = {
  id: Hex;
  white: Address;
  black: Address;
  stake: string;
  state: number;
  whitePaid: boolean;
  blackPaid: boolean;
  outcome: number;
  fundingDeadline: number;
  recoveryDeadline: number;
  disputeDeadline: number;
  recordHash: Hex;
};
export default function Arena() {
  const { matchId } = useParams(),
    navigate = useNavigate(),
    { user, refresh } = useAuth(),
    { address, chainId, isConnected } = useAccount(),
    { connectAsync, connectors } = useConnect(),
    { disconnect } = useDisconnect(),
    { switchChainAsync } = useSwitchChain(),
    { data: wallet } = useWalletClient(),
    client = usePublicClient();
  const { data: config, error: configError } = useResource<Config>('/web3/config');
  const [match, setMatch] = useState<Match>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tx, setTx] = useState<Hex>(),
    [txState, setTxState] = useState(''),
    [balance, setBalance] = useState('—'),
    [opponent, setOpponent] = useState(''),
    [stake, setStake] = useState('5'),
    [invite, setInvite] = useState('');
  async function reload() {
    if (matchId) setMatch(await api('/web3/match/' + matchId));
    if (client && config?.configured && address)
      setBalance(
        formatUnits(
          await client.readContract({
            address: config.token,
            abi: tokenAbi,
            functionName: 'balanceOf',
            args: [address],
          }),
          6,
        ),
      );
  }
  useEffect(() => {
    reload().catch((e) => setError(e.message));
    const t = setInterval(() => reload().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [matchId, config?.configured, address, chainId]);
  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(false);
    }
  }
  async function write(contract: Address, abi: any, name: string, args: readonly unknown[] = []) {
    if (!wallet || !client || !address) throw Error('Connect a wallet first.');
    if (chainId !== config?.chainId) throw Error('Switch to the supported test network.');
    setTxState('Confirm in your wallet');
    const hash = await wallet.writeContract({
      address: contract,
      abi,
      functionName: name,
      args,
      account: address,
      chain: wallet.chain,
    });
    setTx(hash);
    setTxState('Submitted · waiting for confirmation');
    const r = await client.waitForTransactionReceipt({
      hash,
      onReplaced: (r) => setTx(r.transaction.hash),
    });
    if (r.status !== 'success') throw Error('Transaction reverted. No action was completed.');
    setTxState('Confirmed on-chain');
    await reload();
  }
  async function signIn() {
    if (!address || !wallet || !config) throw Error('Connect your wallet first.');
    if (chainId !== config.chainId) {
      await switchChainAsync({ chainId: config.chainId });
      return;
    }
    const { nonce } = await api('/web3/nonce');
    const message = createSiweMessage({
      address,
      chainId: config.chainId,
      domain: location.host,
      uri: location.origin,
      version: '1',
      nonce,
      statement: 'Sign in to ChainMate. This does not authorize token transfers.',
      issuedAt: new Date(),
      expirationTime: new Date(Date.now() + 300000),
    });
    const signature = await wallet.signMessage({ message });
    await api('/web3/verify', { message, signature });
    await refresh();
  }
  const stateNames = [
    'Not created',
    'Awaiting deposits',
    'Funded · ready to play',
    'Result pending',
    'Disputed',
    'Settled',
    'Refunded',
  ];
  return (
    <div className="page arena-page">
      <div className="arena-heading">
        <div>
          <div className="eyebrow">
            A NEW WAY TO COMPETE <span className="pill">TESTNET ONLY</span>
          </div>
          <h1>
            Your move.
            <br />
            <em>On the record.</em>
          </h1>
          <p>
            The strategy you know. A transparent way to settle.
            <br />
            Non-redeemable demo tokens. No real-money stakes.
          </p>
        </div>
        <div className="arena-emblem">
          <ShieldCheck size={90} />
        </div>
      </div>
      <div className="notice arena-disclaimer">
        <ShieldCheck />
        <span>
          Escrow holds demo tokens. A trusted server verifies chess results; it does not prove fair
          play. Players have 2 minutes to dispute a submitted result, with a 24-hour recovery path.
        </span>
      </div>
      {configError && <p className="error">{configError}</p>}
      {config && !config.configured && (
        <div className="notice">
          <strong>The local Arena is not deployed yet.</strong>
          <p>
            Ordinary chess is ready without a wallet. For the local test-token experience, run{' '}
            <code>pnpm chain</code>, then <code>pnpm contracts:deploy</code>, and restart the API.
          </p>
          <Link to="/play">Play chess</Link>
        </div>
      )}
      <div className="arena-grid">
        <section className="setup-panel">
          <h3>
            <Wallet size={20} /> Your seat at the table
          </h3>
          {!isConnected ? (
            <>
              <p>Connect an Ethereum-compatible wallet to explore the test-token Arena.</p>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!connectors[0]) throw Error('Install an injected EVM wallet to continue.');
                    await connectAsync({ connector: connectors[0] });
                  })
                }
              >
                Connect wallet
              </button>
            </>
          ) : (
            <>
              <label>
                Connected wallet
                <input readOnly value={address} />
              </label>
              <div className="wallet-meta">
                <span>
                  {chainId === 31337
                    ? 'Anvil local'
                    : chainId === 84532
                      ? 'Base Sepolia'
                      : 'Unsupported network'}
                </span>
                <button onClick={() => disconnect()}>Disconnect</button>
              </div>
              {chainId !== config?.chainId ? (
                <button
                  className="button"
                  onClick={() =>
                    run(async () => {
                      await switchChainAsync({ chainId: config?.chainId || 31337 });
                    })
                  }
                >
                  Switch to test network
                </button>
              ) : user?.wallet !== address?.toLowerCase() ? (
                <button className="button" disabled={busy} onClick={() => run(signIn)}>
                  Sign in with Ethereum
                </button>
              ) : (
                <div className="notice">Wallet ownership verified.</div>
              )}
              <div className="balance">
                <span>YOUR DEMO BALANCE</span>
                <strong>
                  {balance} <small>cmUSD</small>
                </strong>
              </div>
              <button
                disabled={busy || !config?.configured}
                onClick={() => run(() => write(config!.token, tokenAbi, 'faucet'))}
              >
                Get free test tokens
              </button>
            </>
          )}
        </section>
        <section className="setup-panel">
          <h3>
            <LockKeyhole size={20} /> {matchId ? 'Your escrow match' : 'Create a challenge'}
          </h3>
          {match ? (
            <>
              <div className="pill">{stateNames[match.state]}</div>
              <dl className="match-details">
                <dt>Stake per player</dt>
                <dd>{formatUnits(BigInt(match.stake), 6)} cmUSD</dd>
                <dt>Total test-token pot</dt>
                <dd>{formatUnits(BigInt(match.stake) * 2n, 6)} cmUSD</dd>
                <dt>Time control</dt>
                <dd>10 + 0 rapid · casual</dd>
                <dt>White deposit</dt>
                <dd>{match.whitePaid ? 'Confirmed' : 'Not funded'}</dd>
                <dt>Black deposit</dt>
                <dd>{match.blackPaid ? 'Confirmed' : 'Not funded'}</dd>
                <dt>Recovery deadline</dt>
                <dd>{new Date(match.recoveryDeadline * 1000).toLocaleString()}</dd>
              </dl>
              <label>
                Share this match
                <input readOnly value={location.href} />
              </label>
              {match.state === 1 && (
                <button
                  className="button"
                  disabled={busy || !user?.wallet}
                  onClick={() =>
                    run(async () => {
                      await write(config!.token, tokenAbi, 'approve', [
                        config!.address,
                        BigInt(match.stake),
                      ]);
                      await write(config!.address, escrowAbi, 'fund', [match.id]);
                    })
                  }
                >
                  Approve & deposit {formatUnits(BigInt(match.stake), 6)} cmUSD
                </button>
              )}
              {match.state === 2 && (
                <>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const g = await api('/web3/match/' + match.id + '/start', {});
                        navigate('/game/' + g.id);
                      })
                    }
                  >
                    Enter verified chess match
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const a = await api('/web3/match/' + match.id + '/attestation', {});
                        await write(config!.address, escrowAbi, 'submitResult', [
                          match.id,
                          a.outcome,
                          a.recordHash,
                          BigInt(a.nonce),
                          BigInt(a.expiry),
                          a.signature,
                        ]);
                      })
                    }
                  >
                    Submit completed game result
                  </button>
                </>
              )}
              {match.state === 3 && (
                <>
                  <p>
                    Dispute window closes{' '}
                    {new Date(match.disputeDeadline * 1000).toLocaleTimeString()}.
                  </p>
                  <button
                    disabled={busy || Date.now() < match.disputeDeadline * 1000}
                    onClick={() =>
                      run(() => write(config!.address, escrowAbi, 'settle', [match.id]))
                    }
                  >
                    Settle verified result
                  </button>
                  <button
                    disabled={busy || Date.now() >= match.disputeDeadline * 1000}
                    onClick={() =>
                      run(async () => {
                        const { keccak256, toBytes } = await import('viem');
                        await write(config!.address, escrowAbi, 'dispute', [
                          match.id,
                          keccak256(toBytes('Player requests review: ' + match.id)),
                        ]);
                      })
                    }
                  >
                    Dispute result
                  </button>
                </>
              )}
              {[1, 2, 4].includes(match.state) && (
                <button
                  disabled={
                    busy ||
                    Date.now() <
                      (match.state === 1 ? match.fundingDeadline : match.recoveryDeadline) * 1000
                  }
                  onClick={() =>
                    run(() => write(config!.address, escrowAbi, 'recover', [match.id]))
                  }
                >
                  Recover eligible deposits
                </button>
              )}
              {match.state === 4 && (
                <p>
                  A trusted arbiter can resolve this dispute. If no resolution arrives, both players
                  can recover their deposits after the recovery deadline.
                </p>
              )}
              {match.state === 5 && (
                <div className="notice">
                  Settled:{' '}
                  {match.outcome === 3
                    ? 'both deposits refunded'
                    : match.outcome === 1
                      ? 'white receives the pot'
                      : 'black receives the pot'}
                  .<small>Record hash: {match.recordHash}</small>
                </div>
              )}
            </>
          ) : (
            <>
              <label>
                Opponent wallet address
                <input
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="0x…"
                />
              </label>
              <label>
                Demo stake per player
                <input
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <p className="muted">
                10-minute rapid. 15-minute funding deadline. No platform fee. Network gas is
                separate. Maximum 1,000 cmUSD per player.
              </p>
              <button
                className="button"
                disabled={busy || !config?.configured || !user?.wallet}
                onClick={() =>
                  run(async () => {
                    if (!isAddress(opponent) || opponent.toLowerCase() === address?.toLowerCase())
                      throw Error('Enter a different, valid opponent address.');
                    if (!/^\d+(\.\d{1,6})?$/.test(stake))
                      throw Error('Use up to 6 decimal places.');
                    const amount = parseUnits(stake, 6);
                    if (amount <= 0n || amount > 1000_000000n)
                      throw Error('Stake must be between 0 and 1,000 cmUSD.');
                    const id = ('0x' +
                      Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
                        b.toString(16).padStart(2, '0'),
                      ).join('')) as Hex;
                    await write(config!.address, escrowAbi, 'create', [id, opponent, amount]);
                    navigate('/arena/match/' + id);
                  })
                }
              >
                Create test-token match
              </button>
              <label>
                Already invited?
                <input
                  placeholder="Match ID (0x…)"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                />
              </label>
              <button
                disabled={!/^0x[0-9a-fA-F]{64}$/.test(invite)}
                onClick={() => navigate('/arena/match/' + invite)}
              >
                Open match
              </button>
            </>
          )}
        </section>
      </div>
      {busy && <p role="status">{txState || 'Waiting for your wallet…'}</p>}
      {tx && (
        <div className="notice transaction">
          <strong>{txState}</strong>
          <span>{tx}</span>
          {chainId === 84532 && (
            <a href={'https://sepolia.basescan.org/tx/' + tx} target="_blank" rel="noreferrer">
              View on Base Sepolia explorer
            </a>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="arena-rules">
        <Scale />
        <div>
          <h3>Clear rules. Before your first move.</h3>
          <p>
            Only the two named wallets can fund. Both deposits are required to play. Winners receive
            both deposits; draws return each deposit. Unfunded challenges expire after 15 minutes.
            Active or disputed matches can be refunded after 24 hours. Contracts are unaudited and
            restricted to Anvil and Base Sepolia.
          </p>
        </div>
      </div>
    </div>
  );
}
