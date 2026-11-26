import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useAuth, useResource } from '../lib';
import { useAppearance } from '../appearance';
function ImageEditor({
  kind,
  onSaved,
}: {
  kind: 'avatar' | 'banner';
  onSaved: () => Promise<void>;
}) {
  const [source, setSource] = useState(''),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState(50),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    bitmap = useRef<HTMLImageElement | null>(null);
  function draw() {
    const img = bitmap.current,
      c = canvas.current;
    if (!img || !c) return;
    const w = kind === 'avatar' ? 512 : 1600,
      h = kind === 'avatar' ? 512 : 600;
    c.width = w;
    c.height = h;
    const scale = Math.max(w / img.width, h / img.height) * zoom;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ecece5';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(
      img,
      (w - img.width * scale) / 2,
      ((h - img.height * scale) * offset) / 100,
      img.width * scale,
      img.height * scale,
    );
  }
  useEffect(() => {
    draw();
  }, [zoom, offset, source]);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  return (
    <section className="setup-panel image-editor">
      <h3>{kind === 'avatar' ? 'Your portrait' : 'Your profile banner'}</h3>
      <label>
        Choose an image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 8 * 1024 * 1024) {
              setStatus('Choose an image under 8 MB.');
              return;
            }
            const url = URL.createObjectURL(f),
              img = new Image();
            img.onload = () => {
              bitmap.current = img;
              setZoom(1);
              setOffset(50);
              setSource(url);
              setStatus('Adjust the crop, then save.');
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              setStatus('That image could not be opened.');
            };
            img.src = url;
          }}
        />
      </label>
      {source && (
        <>
          <canvas ref={canvas} aria-label={`${kind} crop preview`} />
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step=".05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <label>
            Vertical position
            <input
              type="range"
              min="0"
              max="100"
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
            />
          </label>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const blob = await new Promise<Blob>((resolve, reject) =>
                  canvas.current!.toBlob(
                    (b) => (b ? resolve(b) : reject(Error('Image encoding failed.'))),
                    'image/jpeg',
                    0.88,
                  ),
                );
                const response = await fetch('/api/profile/media/' + kind, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'image/jpeg' },
                  body: blob,
                });
                const data = await response.json();
                if (!response.ok) throw Error(data.error);
                await onSaved();
                setStatus('Image saved.');
                setSource('');
              } catch (e) {
                setStatus((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save {kind}
          </button>
        </>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
export default function Settings() {
  const { appearance, apply } = useAppearance();
  const { user, refresh, loading } = useAuth(),
    [params] = useSearchParams();
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const deletion = useRef<HTMLDialogElement>(null);
  const { data: wallets, setData: setWallets } =
    useResource<{ address: string; primary_wallet: number }[]>('/wallets');
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="page">Loading your profile…</div>;
  if (!user)
    return (
      <div className="page">
        <h1>Your own corner.</h1>
        <Link className="button" to="/login">
          Sign in
        </Link>
      </div>
    );
  return (
    <div className="page settings-page">
      <div className="eyebrow">MAKE YOURSELF AT HOME</div>
      <h1>
        Your identity.
        <br />
        <em>Your terms.</em>
      </h1>
      <p className="muted">Profile, privacy, and the way you play.</p>
      <Link className="button" to="/settings/board">
        Open Board Studio →
      </Link>
      <div className="settings-grid">
        <form
          className="setup-panel"
          key={user.id + user.username}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              const settings = {
                board: f.get('board') as 'slate' | 'warm',
                muted: f.get('muted') === 'on',
                notifications: f.get('notifications') === 'on',
                network: String(f.get('network')),
              };
              await api(
                '/profile',
                {
                  username: f.get('username'),
                  display_name: f.get('display_name'),
                  bio: f.get('bio'),
                  country: f.get('country'),
                  private: f.get('private') === 'on',
                  wallet_public: f.get('wallet_public') === 'on',
                  settings,
                },
                'PATCH',
              );
              localStorage.setItem('cm-board', settings.board);
              localStorage.setItem('cm-muted', String(settings.muted));
              if (
                settings.board !== user.settings?.board ||
                settings.muted !== user.settings?.muted
              )
                await apply({
                  ...appearance,
                  ...(settings.board !== user.settings?.board
                    ? {
                        boardThemeId: settings.board === 'warm' ? 'walnut' : 'pearl',
                        customColors: false,
                      }
                    : {}),
                  soundEnabled: !settings.muted,
                });
              await refresh();
              setStatus('Profile and preferences saved.');
            });
          }}
        >
          <h3>Profile details</h3>
          <label>
            Username
            <input
              name="username"
              defaultValue={user.username}
              required
              pattern="[a-zA-Z0-9_]{3,24}"
              maxLength={24}
            />
          </label>
          <label>
            Display name
            <input name="display_name" defaultValue={user.display_name} maxLength={60} />
          </label>
          <label>
            About you
            <textarea name="bio" defaultValue={user.bio} maxLength={240} />
          </label>
          <label>
            Country (optional)
            <input name="country" defaultValue={user.country} maxLength={60} />
          </label>
          <label className="check-row">
            <input type="checkbox" name="private" defaultChecked={!!user.private} /> Private profile
          </label>
          <label className="check-row">
            <input type="checkbox" name="wallet_public" defaultChecked={!!user.wallet_public} />{' '}
            Show linked wallets on my public profile
          </label>
          <label>
            Board finish
            <select name="board" defaultValue={user.settings?.board || 'slate'}>
              <option value="slate">Pearl & graphite</option>
              <option value="warm">Warm walnut</option>
            </select>
          </label>
          <label>
            Preferred network
            <select name="network" defaultValue={user.settings?.network || '84532'}>
              <option value="84532">Base Sepolia — testnet</option>
              <option value="8453">Base — mainnet wallet only</option>
              <option value="31337">Anvil — local development</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" name="muted" defaultChecked={user.settings?.muted} /> Mute move
            sounds
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked={user.settings?.notifications}
            />{' '}
            Enable in-app match notifications
          </label>
          <button className="button" disabled={busy}>
            Save profile
          </button>
        </form>
        <div className="settings-media">
          <ImageEditor kind="avatar" onSaved={refresh} />
          <ImageEditor kind="banner" onSaved={refresh} />
        </div>
        <section className="setup-panel">
          <h3>Connected wallets</h3>
          <p>Wallet addresses stay private unless you choose otherwise.</p>
          {wallets?.map((w) => (
            <div className="linked-wallet" key={w.address}>
              <code>{w.address}</code>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api('/wallets/' + w.address, {}, 'DELETE');
                    setWallets(wallets.filter((x) => x.address !== w.address));
                    await refresh();
                    setStatus('Wallet unlinked.');
                  })
                }
              >
                Unlink
              </button>
            </div>
          ))}
          <Link className="button outline" to="/wallet">
            Link a wallet
          </Link>
        </section>
        <section className="setup-panel">
          <h3>Account security</h3>
          {user.email && (
            <>
              <p>Email: {user.email_verified ? 'verified' : 'not verified'}</p>
              {params.get('verify') ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api('/auth/verify', { token: params.get('verify') });
                      await refresh();
                      setStatus('Email verified.');
                    })
                  }
                >
                  Confirm email verification
                </button>
              ) : (
                !user.email_verified && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api('/auth/verification', {});
                        setStatus(
                          'Verification requested. Development links are stored in the local mail outbox.',
                        );
                      })
                    }
                  >
                    Request verification email
                  </button>
                )
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = Object.fromEntries(new FormData(e.currentTarget));
                  run(async () => {
                    await api('/auth/password', f);
                    setStatus('Password changed; other sessions signed out.');
                  });
                }}
              >
                <label>
                  Current password
                  <input type="password" name="current" autoComplete="current-password" required />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <button disabled={busy}>Change password</button>
              </form>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api('/auth/logout', {});
                await refresh();
              })
            }
          >
            Sign out
          </button>
          <button className="danger" onClick={() => deletion.current?.showModal()}>
            Delete account
          </button>
        </section>
      </div>
      <p role="status" className="settings-status">
        {status}
      </p>
      <dialog ref={deletion} className="wallet-dialog" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete your account?</h2>
        <p>
          Your profile, uploads, wallets and sessions will be removed. Match records remain with an
          anonymized identity.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            run(async () => {
              await api('/auth/account', f, 'DELETE');
              deletion.current?.close();
              await refresh();
            });
          }}
        >
          <label>
            Type DELETE
            <input name="confirmation" required pattern="DELETE" />
          </label>
          {user.email && (
            <label>
              Current password
              <input name="password" type="password" required />
            </label>
          )}
          <button className="button" disabled={busy}>
            Permanently delete account
          </button>
          <button type="button" onClick={() => deletion.current?.close()}>
            Keep my account
          </button>
        </form>
      </dialog>
    </div>
  );
}
