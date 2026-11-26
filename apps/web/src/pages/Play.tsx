import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { realtime, type Realtime } from '../realtime';
import { Globe2, Users, BrainCircuit, Clock3 } from 'lucide-react';
import { bots, controls, type Control } from '../../../../packages/shared/types';
import { api, useAuth } from '../lib';
export default function Play() {
  const { mode } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    { user } = useAuth();
  const [bot, setBot] = useState(params.get('bot') || 'bitcoin'),
    [control, setControl] = useState<Control>(
      params.get('control') && params.get('control')! in controls
        ? (params.get('control') as Control)
        : '10+0',
    ),
    [rated, setRated] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(params.get('invite') || ''),
    [socket, setSocket] = useState<Realtime>();
  useEffect(() => {
    if (mode !== 'online' || !user) return;
    const s = realtime('queue');
    setSocket(s);
    s.on('match:found', (g) => navigate('/game/' + g.id));
    s.on('queue:expired', () => {
      setBusy(false);
      setError('No rival found yet. You can search again.');
    });
    s.on('connect_error', (e) => {
      setError(e.message);
      setBusy(false);
    });
    return () => {
      s.disconnect();
    };
  }, [mode, user?.id, navigate]);
  async function start() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'friend') {
        const invitation = new URL(code || '/', location.origin);
        const challengeId =
          invitation.searchParams.get('invite') ||
          invitation.pathname.split('/').filter(Boolean).pop();
        const g = code
          ? await api('/challenges/' + encodeURIComponent(challengeId || '') + '/join', {})
          : await api('/challenges', { control, rated });
        navigate('/game/' + g.id);
      } else if (mode === 'online') {
        if (!socket?.connected) throw Error('Connecting to the game server. Please try again.');
        socket.emit('queue:join', { control, rated }, (r: any) => {
          if (!r.ok) {
            setError(r.error);
            setBusy(false);
          }
        });
      } else navigate('/game/bot?bot=' + bot + '&control=' + encodeURIComponent(control));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!mode)
    return (
      <div className="page">
        <div className="page-heading">
          <div className="eyebrow">PULL UP A CHAIR</div>
          <h1>
            Your game.
            <br />
            <em>Your way.</em>
          </h1>
          <p>A little practice, a friendly rivalry, or your next great match.</p>
        </div>
        <div className="mode-grid">
          {[
            {
              to: 'bot',
              icon: BrainCircuit,
              title: 'Play a bot',
              copy: 'Three personalities. A challenge at every level.',
              tag: 'NO ACCOUNT NEEDED',
            },
            {
              to: 'online',
              icon: Globe2,
              title: 'Play the world',
              copy: 'Find a real opponent. Casual or rated.',
              tag: 'REAL-TIME MULTIPLAYER',
            },
            {
              to: 'friend',
              icon: Users,
              title: 'Challenge a friend',
              copy: 'A private table and a link to share.',
              tag: 'YOUR PRIVATE CLUB',
            },
          ].map((m) => (
            <Link className="mode-card" to={'/play/' + m.to} key={m.to}>
              <m.icon size={32} />
              <span className="eyebrow">{m.tag}</span>
              <h2>{m.title}</h2>
              <p>{m.copy}</p>
              <span className="text-link">Take a seat</span>
            </Link>
          ))}
        </div>
      </div>
    );
  return (
    <div className="page">
      <Link className="back-link" to="/play">
        All ways to play
      </Link>
      <div className="page-heading">
        <div className="eyebrow">
          {mode === 'bot' ? 'A WORTHY OPPONENT' : 'THE HUMAN SIDE OF CHESS'}
        </div>
        <h1>
          {mode === 'bot'
            ? 'Choose your mind.'
            : mode === 'friend'
              ? 'Better with a rival.'
              : 'Find your next rival.'}
        </h1>
        <p>
          {mode === 'bot'
            ? 'Real Stockfish. Three distinct skill settings. Always ready.'
            : mode === 'friend'
              ? 'Create a private challenge, or join an invitation.'
              : 'Join the queue. You’ll be paired with a real player.'}
        </p>
      </div>
      {mode === 'bot' ? (
        <div className="bot-picker">
          {bots.map((b, i) => (
            <button
              aria-pressed={bot === b.id}
              className={'bot-card ' + (bot === b.id ? 'selected' : '')}
              onClick={() => setBot(b.id)}
              key={b.id}
            >
              <div className={'bot-art bot-art-' + i}>
                <img
                  src={'/art/' + b.id + '.webp'}
                  alt={`${b.name} chess sculpture`}
                  width="591"
                  height="887"
                />
              </div>
              <div className="bot-card-info">
                <span className="difficulty">{b.difficulty}</span>
                <h3>{b.name}</h3>
                <span className="muted">{b.title}</span>
                <p>{b.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : !user ? (
        <div className="notice">
          Sign in to keep your matches and reconnect securely. <Link to="/login">Sign in</Link> or{' '}
          <Link to="/register">join the club</Link>.
        </div>
      ) : null}
      <div className="setup-panel">
        <div>
          <h3>
            <Clock3 size={19} /> Set the pace
          </h3>
          <div className="control-options">
            {Object.keys(controls).map((c) => (
              <button
                aria-pressed={control === c}
                className={control === c ? 'chosen' : ''}
                key={c}
                onClick={() => setControl(c as Control)}
              >
                {c}
                <small>
                  {c === '1+0'
                    ? 'Bullet'
                    : c.startsWith('3') || c.startsWith('5')
                      ? 'Blitz'
                      : 'Rapid'}
                </small>
              </button>
            ))}
          </div>
        </div>
        {mode !== 'bot' && (
          <label className="check-label">
            <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />{' '}
            Rated match <small>Verified human games affect your club rating.</small>
          </label>
        )}
        {mode === 'friend' && (
          <label>
            Have an invitation?
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste a match link or ID"
            />
          </label>
        )}
        <button className="button" disabled={busy || (mode !== 'bot' && !user)} onClick={start}>
          {busy
            ? 'Waiting for a real opponent…'
            : mode === 'bot'
              ? 'Let’s play'
              : mode === 'friend'
                ? code
                  ? 'Join challenge'
                  : 'Create private challenge'
                : 'Find a match'}
        </button>
        {busy && mode === 'online' && (
          <button
            className="text-link"
            onClick={() => {
              socket?.emit('queue:leave', {}, () => {});
              setBusy(false);
            }}
          >
            Leave queue
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
