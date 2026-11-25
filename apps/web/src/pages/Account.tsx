import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trophy, BookOpen, ShieldCheck, UserRound } from 'lucide-react';
import { api, useAuth, useResource } from '../lib';
import type { GameState, User } from '../../../../packages/shared/types';
function History({ games }: { games: GameState[] }) {
  return games.length ? (
    <div className="history-list">
      {games.map((g) => (
        <Link key={g.id} to={'/game/' + g.id + (g.status === 'finished' ? '/replay' : '')}>
          <span className="avatar">♟</span>
          <div>
            <strong>
              {g.whiteName} vs {g.blackName}
            </strong>
            <small>
              {g.control} · {g.rated ? 'Rated' : 'Casual'} ·{' '}
              {new Date(g.created).toLocaleDateString()}
            </small>
          </div>
          <span>
            {g.status === 'finished'
              ? g.outcome === 'draw'
                ? 'Draw'
                : g.outcome === 'white'
                  ? 'White won'
                  : 'Black won'
              : g.status}
          </span>
        </Link>
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <BookOpen />
      <h3>Your next chapter is unwritten.</h3>
      <p>Completed online games will appear here with their full move history.</p>
      <Link to="/play" className="button outline">
        Play your first game
      </Link>
    </div>
  );
}
export default function Account() {
  const { pathname } = useLocation(),
    navigate = useNavigate(),
    { username } = useParams(),
    [params] = useSearchParams(),
    { user, refresh, loading } = useAuth();
  const isAuth = pathname === '/login' || pathname === '/register',
    register = pathname === '/register';
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [forgot, setForgot] = useState(false),
    [bio, setBio] = useState<string>();
  const url =
    pathname === '/leaderboard'
      ? '/leaderboard'
      : pathname.startsWith('/profile/')
        ? '/profile/' + username
        : '/history';
  const resource = useResource<any>(isAuth ? '/auth/me' : url);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (params.get('reset')) {
        await api('/auth/reset', { token: params.get('reset'), password: fields.password });
        setError('Password updated. Sign in with your new password.');
        navigate('/login');
      } else if (forgot) {
        const r = await api('/auth/forgot', fields);
        setError(r.message);
      } else {
        await api('/auth/' + (register ? 'register' : 'login'), fields);
        await refresh();
        navigate('/dashboard');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (isAuth)
    return (
      <div className="auth-page">
        <div className="auth-art">
          <div className="eyebrow">YOUR SEAT IS WAITING</div>
          <h1>
            Great games
            <br />
            start with
            <br />
            <em>hello.</em>
          </h1>
          <div className="auth-piece">♞</div>
          <p>A timeless game. A club of your own.</p>
        </div>
        <div className="auth-form">
          <div className="eyebrow">WELCOME TO CHAINMATE</div>
          <h2>
            {params.get('reset')
              ? 'A fresh start.'
              : forgot
                ? 'Back in the game.'
                : register
                  ? 'Join the club.'
                  : 'Welcome back.'}
          </h2>
          <p>
            {register
              ? 'Make your next move a memorable one.'
              : 'Your board. Your rivals. Your next chapter.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Username
                <input
                  name="username"
                  autoComplete="username"
                  required
                  pattern="[a-zA-Z0-9_]{3,24}"
                  placeholder="Your name at the table"
                />
              </label>
            )}
            {!params.get('reset') && (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
            )}
            {!forgot && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register || params.get('reset') ? 12 : 1}
                  maxLength={128}
                  placeholder={register ? 'At least 12 characters' : 'Your password'}
                />
              </label>
            )}
            <button className="button" disabled={busy}>
              {busy
                ? 'One moment…'
                : params.get('reset')
                  ? 'Update password'
                  : forgot
                    ? 'Send reset link'
                    : register
                      ? 'Create account'
                      : 'Sign in'}
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
          <div className="auth-links">
            {!register && (
              <button className="text-link" onClick={() => setForgot(!forgot)}>
                {forgot ? 'Back to sign in' : 'Forgot password?'}
              </button>
            )}
            <p>
              {register ? 'Already a member?' : 'New to the club?'}{' '}
              <Link to={register ? '/login' : '/register'}>
                {register ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
            <Link to="/play/bot">Just here to play? Try a bot.</Link>
          </div>
        </div>
      </div>
    );
  if (pathname === '/leaderboard')
    return (
      <div className="page">
        <div className="page-heading">
          <div className="eyebrow">THE CLUB</div>
          <h1>
            Earn your
            <br />
            <em>place.</em>
          </h1>
          <p>Real players. Verified rated games. A story behind every rating.</p>
        </div>
        {resource.error ? (
          <p className="error">{resource.error}</p>
        ) : !resource.data ? (
          <p>Loading the club…</p>
        ) : resource.data.length ? (
          <div className="leaderboard">
            {resource.data.map((u: User, i: number) => (
              <Link to={'/profile/' + u.username} key={u.id}>
                <span>{i + 1}</span>
                <span className="avatar">
                  <UserRound />
                </span>
                <strong>{u.username}</strong>
                <b>{u.rating}</b>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Trophy />
            <h2>The first chapter is yours.</h2>
            <p>No rated games have been completed yet. The standings will grow with the club.</p>
            <Link className="button" to="/play/online">
              Play a rated match
            </Link>
          </div>
        )}
      </div>
    );
  if (pathname === '/tournaments')
    return (
      <div className="page empty-state">
        <Trophy />
        <h1>
          Something worth
          <br />
          <em>playing for.</em>
        </h1>
        <p>Tournaments are planned. Registration is not open yet.</p>
        <Link to="/play/online" className="button">
          Play an online match
        </Link>
      </div>
    );
  if (loading) return <div className="page">Finding your seat…</div>;
  if (!user && !pathname.startsWith('/profile/'))
    return (
      <div className="page empty-state">
        <UserRound />
        <h1>
          Your own corner
          <br />
          <em>of the club.</em>
        </h1>
        <p>Sign in to see your games, rating, and profile.</p>
        <Link to="/login" className="button">
          Sign in
        </Link>
      </div>
    );
  if (pathname === '/settings')
    return (
      <div className="page narrow">
        <div className="eyebrow">MAKE YOURSELF AT HOME</div>
        <h1>Your preferences.</h1>
        <form
          className="setup-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/profile', { bio: bio ?? user?.bio ?? '' }, 'PATCH');
              await refresh();
              setError('Profile saved.');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            About you
            <textarea
              maxLength={240}
              value={bio ?? user?.bio ?? ''}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Your chess story, in a few words."
            />
          </label>
          <p className="muted">
            Your username, bio, join date, and finished matches are public. Email and wallet address
            are excluded from public profiles.
          </p>
          <button className="button">Save profile</button>
          <p role="status">{error}</p>
          <Link to="/arena">Connect or change your wallet in the Arena</Link>
          <button
            type="button"
            onClick={async () => {
              await api('/auth/logout', {});
              await refresh();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    );
  if (pathname === '/achievements')
    return (
      <div className="page">
        <div className="eyebrow">MILESTONES THAT MATTER</div>
        <h1>
          A game of <em>growth.</em>
        </h1>
        <div className="empty-state">
          <ShieldCheck />
          <h3>On-chain badges are coming later.</h3>
          <p>
            Verified match hashes are available in Arena settlements. Badge minting is not enabled.
          </p>
          <Link className="button outline" to="/history">
            Explore your match history
          </Link>
        </div>
      </div>
    );
  const profile = pathname.startsWith('/profile/') ? resource.data?.user : user;
  const games: GameState[] = pathname.startsWith('/profile/')
    ? resource.data?.games || []
    : resource.data || [];
  return (
    <div className="page">
      <div className="profile-heading">
        <div className="large-avatar">♔</div>
        <div>
          <div className="eyebrow">
            {pathname === '/history' ? 'YOUR GAMES, REMEMBERED' : 'A MEMBER OF THE CLUB'}
          </div>
          <h1>
            {pathname === '/history' ? 'Every game tells a story.' : profile?.username || 'Player'}
          </h1>
          <p>{profile?.bio || 'One move closer to your best game.'}</p>
        </div>
        {profile && (
          <div className="rating">
            <strong>{profile.rating}</strong>
            <span>CLUB RATING</span>
          </div>
        )}
      </div>
      <div className="account-nav">
        <Link to="/dashboard">Overview</Link>
        <Link to="/history">Match history</Link>
        <Link to="/achievements">Achievements</Link>
        <Link to="/settings">Settings</Link>
      </div>
      {Array.isArray(games) && profile && (
        <div className="player-stat-strip" aria-label="Results in recent match history">
          <div>
            <span>RECENT GAMES</span>
            <strong>{games.filter((g) => g.status === 'finished').length}</strong>
          </div>
          <div>
            <span>WINS</span>
            <strong>
              {
                games.filter(
                  (g) =>
                    g.status === 'finished' &&
                    ((g.white === profile.id && g.outcome === 'white') ||
                      (g.black === profile.id && g.outcome === 'black')),
                ).length
              }
            </strong>
          </div>
          <div>
            <span>LOSSES</span>
            <strong>
              {
                games.filter(
                  (g) =>
                    g.status === 'finished' &&
                    g.outcome !== 'draw' &&
                    ((g.white === profile.id && g.outcome === 'black') ||
                      (g.black === profile.id && g.outcome === 'white')),
                ).length
              }
            </strong>
          </div>
          <div>
            <span>DRAWS</span>
            <strong>
              {games.filter((g) => g.status === 'finished' && g.outcome === 'draw').length}
            </strong>
          </div>
        </div>
      )}
      {resource.error ? (
        <p className="error">{resource.error}</p>
      ) : !resource.data ? (
        <p>Loading your games…</p>
      ) : (
        <History games={games} />
      )}
    </div>
  );
}
