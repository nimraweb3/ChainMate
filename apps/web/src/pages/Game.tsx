import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { realtime, type Realtime } from '../realtime';
import {
  FlipVertical2,
  Download,
  Flag,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { bots, controls, type Control, type GameState } from '../../../../packages/shared/types';
import { result } from '../../../../packages/game-core';
import { controlValues } from '../../../../packages/shared/types';
import { api, download, useAuth } from '../lib';
import Board from '../components/Board';
import { useAppearance } from '../appearance';
import AppearanceControls from '../components/AppearanceControls';
import CapturedPieces from '../components/CapturedPieces';
import PlayerHeader from '../components/PlayerHeader';
import GameChat from '../components/GameChat';
import { tone, unlockAudio } from '../sounds';
export default function Game({ replay = false }: { replay?: boolean }) {
  const { appearance, apply, error: appearanceError } = useAppearance();
  const [online, setOnline] = useState<string[]>([]);
  const [tab, setTab] = useState('Moves'),
    [unread, setUnread] = useState(0),
    [focus, setFocus] = useState(false);
  const { gameId } = useParams(),
    [params] = useSearchParams(),
    { user } = useAuth();
  const local = gameId === 'bot';
  const bot = bots.find((b) => b.id === params.get('bot')) || bots[0];
  const control = (params.get('control') || '10+0') as Control;
  const initial = (controlValues(control) || controls['10+0'])[0] * 1000;
  const [chess, setChess] = useState(() => new Chess()),
    [game, setGame] = useState<GameState>(),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [connected, setConnected] = useState(false),
    [flipped, setFlipped] = useState(false),
    [times, setTimes] = useState([initial, initial]),
    [end, setEnd] = useState(''),
    [confirm, setConfirm] = useState(false),
    [index, setIndex] = useState<number | null>(replay ? 0 : null),
    [epoch, setEpoch] = useState(0);
  const worker = useRef<Worker | null>(null),
    sock = useRef<Realtime | null>(null),
    current = useRef(chess),
    lastTick = useRef(Date.now()),
    status = useRef(''),
    resultDialog = useRef<HTMLDialogElement | null>(null),
    orientationFor = useRef<string | null>(null);
  current.current = chess;
  status.current = end;
  const history = chess.history({ verbose: true });
  const last = history.at(-1);
  const finished = !!end || game?.status === 'finished';
  useEffect(() => {
    if (end && !replay) resultDialog.current?.showModal();
    else resultDialog.current?.close();
  }, [end, replay]);
  useEffect(() => {
    setIndex(replay ? 0 : null);
  }, [replay]);
  const sounded = useRef(0),
    warned = useRef(false);
  useEffect(() => {
    if (history.length > sounded.current) {
      const m = history.at(-1);
      tone(
        chess.isCheckmate()
          ? 'end'
          : chess.isCheck()
            ? 'check'
            : m?.captured
              ? 'capture'
              : m?.san.startsWith('O-O')
                ? 'castle'
                : 'move',
        appearance,
      );
    }
    sounded.current = history.length;
  }, [chess]);
  useEffect(() => {
    if (end) tone('end', appearance);
  }, [end]);
  useEffect(() => {
    const own = local ? times[0] : game?.white === user?.id ? times[0] : times[1];
    if (own < 30000 && !warned.current && !finished) {
      tone('warning', appearance);
      warned.current = true;
    }
    if (own > 30000) warned.current = false;
  }, [times, finished]);
  function adopt(c: Chess) {
    setChess(c);
    const r = result(c);
    if (r)
      setEnd(
        `${r.outcome === 'draw' ? 'Draw' : r.outcome === 'white' ? 'You win' : 'Bot wins'} · ${r.reason}`,
      );
  }
  useEffect(() => {
    if (!local) return;
    setReady(false);
    const w = new Worker('/engine/stockfish-19-lite-single.js');
    worker.current = w;
    w.onerror = () => setError('The chess engine could not load. Run pnpm assets and refresh.');
    w.onmessage = (e) => {
      const line = String(e.data);
      if (line === 'uciok') {
        w.postMessage(`setoption name Skill Level value ${bot.skill}`);
        w.postMessage('isready');
      }
      if (line === 'readyok') setReady(true);
      if (line.startsWith('bestmove ') && !status.current) {
        const m = line.split(' ')[1];
        if (m === '(none)') return;
        try {
          const c = new Chess();
          c.loadPgn(current.current.pgn());
          if (c.turn() !== 'b') return;
          c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m.slice(4) || 'q' });
          setTimes((t) => [t[0], t[1] + (controlValues(control) || controls['10+0'])[1] * 1000]);
          adopt(c);
        } catch {
          setError('The engine returned an invalid move. Start a rematch.');
        }
      }
    };
    w.postMessage('uci');
    return () => {
      w.postMessage('stop');
      w.terminate();
      worker.current = null;
    };
  }, [local, bot.id, epoch]);
  useEffect(() => {
    if (!local || !ready || finished || chess.turn() !== 'b') return;
    worker.current?.postMessage(
      'position startpos moves ' +
        chess
          .history({ verbose: true })
          .map((m) => m.from + m.to + (m.promotion || ''))
          .join(' '),
    );
    worker.current?.postMessage(`go depth ${bot.depth} movetime ${bot.time}`);
  }, [chess, ready, local, finished, bot]);
  useEffect(() => {
    if (!local) return;
    lastTick.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(),
        elapsed = now - lastTick.current;
      lastTick.current = now;
      if (!ready || status.current || !current.current.history().length) return;
      const turn = current.current.turn() === 'w' ? 0 : 1;
      setTimes((old) => {
        const next = [...old];
        next[turn] = Math.max(0, next[turn] - elapsed);
        if (next[turn] === 0)
          setEnd(turn === 0 ? 'Bot wins · Time expired' : 'You win · Time expired');
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [local, ready, epoch]);
  useEffect(() => {
    if (local || !gameId) return;
    let alive = true;
    api<GameState>('/games/' + gameId)
      .then((g) => {
        if (!alive) return;
        receive(g);
      })
      .catch((e) => setError(e.message));
    if (replay)
      return () => {
        alive = false;
      };
    const s = realtime(gameId);
    sock.current = s;
    s.on('connect', () => {
      setConnected(true);
      s.emit('game:join', { id: gameId }, (r: any) => {
        if (!r.ok) setError(r.error);
      });
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (e) => setError(e.message));
    s.on('game:state', receive);
    s.on('game:presence', setOnline);
    return () => {
      alive = false;
      s.disconnect();
      sock.current = null;
    };
    function receive(g: GameState) {
      setGame(g);
      setTimes([g.whiteMs, g.blackMs]);
      const c = new Chess();
      if (g.pgn) c.loadPgn(g.pgn);
      setChess(c);
      if (orientationFor.current !== g.id) {
        setFlipped(g.black === user?.id);
        orientationFor.current = g.id;
      }
      if (g.status === 'finished')
        setEnd(
          `${g.outcome === 'draw' ? 'Draw' : g.outcome === 'white' ? g.whiteName + ' wins' : g.blackName + ' wins'} · ${g.reason}`,
        );
    }
  }, [gameId, local, replay, user?.id]);
  useEffect(() => {
    if (local || replay || game?.status !== 'active') return;
    const received = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - received;
      const whiteTurn = game.fen.split(' ')[1] === 'w';
      setTimes([
        Math.max(0, game.whiteMs - (whiteTurn ? elapsed : 0)),
        Math.max(0, game.blackMs - (whiteTurn ? 0 : elapsed)),
      ]);
    }, 100);
    return () => clearInterval(timer);
  }, [game, local, replay]);
  useEffect(() => {
    if (!local || !end) return;
    let saved: unknown[] = [];
    try {
      saved = JSON.parse(localStorage.getItem('cm-local-games') || '[]');
    } catch {
      /* A malformed local archive must not interrupt the game. */
    }
    const record = {
      id: Date.now().toString(),
      bot: bot.name,
      pgn: chess.pgn(),
      outcome: end,
      date: new Date().toISOString(),
    };
    try {
      localStorage.setItem('cm-local-games', JSON.stringify([record, ...saved].slice(0, 30)));
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, [end]);
  useEffect(() => {
    if (appearance.boardOrientation !== 'auto') setFlipped(appearance.boardOrientation === 'black');
  }, [appearance.boardOrientation]);
  function play(from: string, to: string, promotion: string) {
    unlockAudio();
    if (finished || replay || index !== null) return false;
    try {
      const c = new Chess();
      if (chess.pgn()) c.loadPgn(chess.pgn());
      else c.load(chess.fen());
      c.move({ from, to, promotion });
      if (local) {
        if (chess.turn() !== 'w' || !ready) return false;
        setTimes((t) => [t[0] + (controlValues(control) || controls['10+0'])[1] * 1000, t[1]]);
        adopt(c);
      } else {
        if (!connected || !game) return false;
        sock.current?.emit(
          'move:submit',
          { id: gameId, from, to, promotion, revision: game.revision },
          (r: any) => {
            if (!r.ok) setError(r.error);
            else {
              setError('');
            }
          },
        );
      }
      return true;
    } catch {
      return false;
    }
  }
  function action(a: string) {
    if (local) {
      if (a === 'resign') {
        setEnd('Bot wins · Resignation');
        worker.current?.postMessage('stop');
      }
      return;
    }
    sock.current?.emit('game:action', { id: gameId, action: a }, (r: any) => {
      if (!r.ok) setError(r.error);
    });
  }
  function rematch() {
    setChess(new Chess());
    setEnd('');
    setTimes([initial, initial]);
    setIndex(null);
    setError('');
    setEpoch((x) => x + 1);
  }
  const displayed =
    index === null
      ? chess
      : (() => {
          const c = new Chess();
          chess
            .history()
            .slice(0, index)
            .forEach((m) => c.move(m));
          return c;
        })();
  const myTurn = local
    ? chess.turn() === 'w'
    : game && (chess.turn() === 'w' ? game.white : game.black) === user?.id;
  return (
    <div
      className={`game-page refined-game surface-${appearance.background} ${focus ? 'focus-game' : ''}`}
    >
      <div className="game-title">
        <Link to="/play">The playing room</Link>
        <span>
          {local
            ? 'Practice · Stockfish'
            : game?.rated
              ? 'Rated · Server verified'
              : 'Casual · Server verified'}{' '}
          / {control === params.get('control') ? control : game?.control || '10+0'}
        </span>
      </div>
      <div className="game-layout">
        <section className="board-column">
          <PlayerHeader
            name={
              flipped
                ? local
                  ? user?.username || 'You'
                  : game?.whiteName
                : local
                  ? bot.name
                  : game?.blackName || 'Waiting for opponent'
            }
            ms={times[flipped ? 0 : 1]}
            active={chess.turn() === (flipped ? 'w' : 'b') && !finished}
            botId={local && !flipped ? bot.id : undefined}
            subtitle={local && !flipped ? bot.difficulty + ' · ' + bot.title : undefined}
            connection={
              !connected
                ? 'Reconnecting…'
                : online.includes((flipped ? game?.white : game?.black) || '')
                  ? 'Online'
                  : 'Offline'
            }
          />
          <Board
            chess={displayed}
            onMove={play}
            disabled={
              finished ||
              replay ||
              index !== null ||
              !myTurn ||
              (local && !ready) ||
              (!local && (!connected || game?.status !== 'active'))
            }
            flipped={flipped}
            lastMove={index === null ? last : displayed.history({ verbose: true }).at(-1)}
            arrows={local || replay || finished}
          />
          {index !== null && (
            <div className="history-banner">
              Reviewing move {index}. The live clock continues.
              <button onClick={() => setIndex(null)}>Return to Live Position</button>
            </div>
          )}
          <PlayerHeader
            name={
              flipped
                ? local
                  ? bot.name
                  : game?.blackName || 'Opponent'
                : local
                  ? user?.username || 'You'
                  : game?.whiteName || 'You'
            }
            ms={times[flipped ? 1 : 0]}
            active={chess.turn() === (flipped ? 'b' : 'w') && !finished}
            botId={local && flipped ? bot.id : undefined}
            subtitle={local ? (flipped ? bot.difficulty : 'Practice · Your side') : undefined}
            connection={
              !connected
                ? 'Reconnecting…'
                : online.includes((flipped ? game?.black : game?.white) || '')
                  ? 'Online'
                  : 'Offline'
            }
          />
          <div className="board-tools">
            <button onClick={() => setFlipped((x) => !x)}>
              <FlipVertical2 size={16} /> Flip board
            </button>
            <button
              aria-label={!appearance.soundEnabled ? 'Unmute sound' : 'Mute sound'}
              onClick={() => {
                unlockAudio();
                void apply({ ...appearance, soundEnabled: !appearance.soundEnabled }).catch(
                  () => {},
                );
              }}
            >
              {!appearance.soundEnabled ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              onClick={() => {
                setTab('Settings');
              }}
            >
              Appearance
            </button>
            <button aria-pressed={focus} onClick={() => setFocus(!focus)}>
              {focus ? 'Exit focus' : 'Focus mode'}
            </button>
          </div>
          <CapturedPieces history={history} />
        </section>
        <aside className="game-panel">
          {tab === 'Chat' && (
            <div className="mobile-clock-summary">
              <span>
                White {Math.floor(times[0] / 60000)}:
                {String(Math.ceil(times[0] / 1000) % 60).padStart(2, '0')}
              </span>
              <span>
                Black {Math.floor(times[1] / 60000)}:
                {String(Math.ceil(times[1] / 1000) % 60).padStart(2, '0')}
              </span>
              <button onClick={() => setTab('Moves')}>Close chat</button>
            </div>
          )}
          <nav className="game-tabs" aria-label="Game panels">
            {['Moves', 'Chat', 'Match', 'Settings', ...(game?.chainMatch ? ['Escrow'] : [])].map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    if (t === 'Chat') setUnread(0);
                  }}
                >
                  {t}
                  {t === 'Chat' && unread > 0 ? ` (${unread})` : ''}
                </button>
              ),
            )}
          </nav>
          {tab === 'Settings' && (
            <section className="in-game-appearance">
              <AppearanceControls
                compact
                value={appearance}
                onChange={(p) => {
                  void apply(p).catch(() => {});
                }}
              />
              <p role="status">
                {appearanceError || 'Changes apply without interrupting your game.'}
              </p>
              <Link to="/settings/board" target="_blank">
                Full Board Studio ↗
              </Link>
            </section>
          )}
          {!local && !replay && gameId && (
            <GameChat
              gameId={gameId}
              open={tab === 'Chat'}
              onUnread={() => setUnread((n) => n + 1)}
            />
          )}
          {tab === 'Chat' && (local || replay) && (
            <p className="chat-empty">
              {local
                ? 'A quiet table with Stockfish. Human chat is available in multiplayer games.'
                : 'Chat is private to the live participants.'}
            </p>
          )}
          {tab === 'Escrow' && game?.chainMatch && (
            <div className="match-details">
              <h3>Verified match</h3>
              <p>Appearance and chat never change your escrow.</p>
              <Link to={'/arena/match/' + game.chainMatch}>Open escrow & settlement →</Link>
            </div>
          )}
          <div hidden={tab !== 'Moves' && tab !== 'Match'}>
            {tab === 'Match' && (
              <div className="match-details">
                <h3>Your table</h3>
                <dl>
                  <dt>Time control</dt>
                  <dd>{game?.control || control}</dd>
                  <dt>Format</dt>
                  <dd>{local ? 'Local practice' : game?.rated ? 'Rated chess' : 'Casual chess'}</dd>
                  <dt>Connection</dt>
                  <dd>
                    {local
                      ? 'Stockfish on this device'
                      : connected
                        ? 'Connected to authoritative game server'
                        : 'Reconnecting'}
                  </dd>
                  <dt>Players</dt>
                  <dd>
                    {local
                      ? `You · ${bot.name}`
                      : `${game?.whiteName || 'White'} · ${game?.blackName || 'Waiting'}`}
                  </dd>
                </dl>
                <p>Appearance is personal. The official position and clocks remain shared.</p>
              </div>
            )}
            <div className="game-panel-head">
              <div className="eyebrow">
                {replay ? 'THE STORY OF YOUR GAME' : 'EVERY MOVE MATTERS'}
              </div>
              <h2>
                {finished
                  ? 'A game to remember.'
                  : game?.status === 'waiting'
                    ? 'Your table is ready.'
                    : local && !ready
                      ? 'Preparing your opponent…'
                      : myTurn
                        ? 'Your move.'
                        : 'A moment to think.'}
              </h2>
              <p aria-live="polite">
                {end ||
                  (chess.isCheck()
                    ? 'Check. Protect your king.'
                    : local
                      ? 'A little patience. A little possibility.'
                      : game?.status === 'waiting'
                        ? 'Invite a friend to take the other seat.'
                        : 'Engine assistance is not permitted.')}
              </p>
            </div>
            {game?.status === 'waiting' && (
              <div className="invite">
                <label>
                  Private invitation
                  <input readOnly value={location.origin + '/play/friend?invite=' + game.id} />
                </label>
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(location.origin + '/play/friend?invite=' + game.id)
                      .then(() => setError('Invitation copied.'))
                      .catch(() => setError('Copy the invitation from the field.'));
                  }}
                >
                  Copy invitation
                </button>
                <small>Expires 15 minutes after creation.</small>
              </div>
            )}
            <div className="move-header">
              <span>MOVE HISTORY</span>
              <button
                aria-label="Download PGN"
                onClick={() => download(chess.pgn(), 'chainmate.pgn')}
              >
                <Download size={17} />
              </button>
            </div>
            <div className="move-list">
              {!history.length ? (
                <div className="empty-moves">
                  <span>♙</span>Your story begins
                  <br />
                  with the first move.
                </div>
              ) : (
                Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                  <div className="move-pair" key={i}>
                    <span>{i + 1}.</span>
                    {[0, 1].map((j) => (
                      <button
                        disabled={!history[i * 2 + j]}
                        className={(index ?? history.length) === i * 2 + j + 1 ? 'current' : ''}
                        key={j}
                        onClick={() => setIndex(i * 2 + j + 1)}
                      >
                        {history[i * 2 + j]?.san || ''}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            {(finished || replay || index !== null) && (
              <div className="replay-controls">
                <button
                  aria-label="Previous move"
                  onClick={() => setIndex((i) => Math.max(0, (i ?? history.length) - 1))}
                >
                  <ChevronLeft />
                </button>
                <span>
                  {index ?? history.length} / {history.length}
                </span>
                <button
                  aria-label="Next move"
                  onClick={() =>
                    setIndex((i) => Math.min(history.length, (i ?? history.length) + 1))
                  }
                >
                  <ChevronRight />
                </button>
                <button onClick={() => setIndex(null)}>Final</button>
              </div>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {game?.drawOffer && game.drawOffer !== user?.id && !finished && (
            <div className="notice">
              Your opponent offers a draw.<button onClick={() => action('accept')}>Accept</button>
              <button onClick={() => action('decline')}>Decline</button>
            </div>
          )}
          <div className="game-actions">
            {finished ? (
              local ? (
                <button className="button" onClick={rematch}>
                  Rematch
                </button>
              ) : (
                <Link className="button" to="/play/friend">
                  Create a rematch
                </Link>
              )
            ) : (
              <>
                <button
                  disabled={!local && game?.status !== 'active'}
                  onClick={() => setConfirm(true)}
                >
                  <Flag size={16} /> Resign
                </button>
                {!local && (
                  <button disabled={game?.status !== 'active'} onClick={() => action('offer')}>
                    Offer draw
                  </button>
                )}
              </>
            )}
            {game?.chainMatch && (
              <Link to={'/arena/match/' + game.chainMatch}>View escrow & settlement</Link>
            )}
          </div>
          {confirm && (
            <div className="notice" role="group" aria-label="Confirm resignation">
              <p>Resign this game? Your opponent will win.</p>
              <button
                onClick={() => {
                  action('resign');
                  setConfirm(false);
                }}
              >
                Confirm resignation
              </button>
              <button onClick={() => setConfirm(false)}>Keep playing</button>
            </div>
          )}
        </aside>
      </div>
      <dialog className="result-dialog" ref={resultDialog} aria-labelledby="result-title">
        <div className="result-crown" aria-hidden="true">
          ♔
        </div>
        <div className="eyebrow">ANOTHER CHAPTER ON THE BOARD</div>
        <h2 id="result-title">Game complete.</h2>
        <p>
          {game?.chainMatch
            ? 'Your result is saved. Return to the Arena to submit it for settlement.'
            : 'Take a moment. Revisit your moves, or pull up a chair for another game.'}
        </p>
        <div className="result-actions">
          {local && (
            <button className="button" onClick={rematch}>
              Play again
            </button>
          )}
          {game?.chainMatch && (
            <Link className="button" to={'/arena/match/' + game.chainMatch}>
              Continue to settlement
            </Link>
          )}
          <button onClick={() => resultDialog.current?.close()}>Review the board</button>
        </div>
      </dialog>
    </div>
  );
}
