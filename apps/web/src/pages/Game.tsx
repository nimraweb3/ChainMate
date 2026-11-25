import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { io, type Socket } from 'socket.io-client';
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
import { api, download, useAuth } from '../lib';
import Board from '../components/Board';
function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export default function Game({ replay = false }: { replay?: boolean }) {
  const { gameId } = useParams(),
    [params] = useSearchParams(),
    { user } = useAuth();
  const local = gameId === 'bot';
  const bot = bots.find((b) => b.id === params.get('bot')) || bots[0];
  const control = (params.get('control') || '10+0') as Control;
  const initial = (controls[control] || controls['10+0'])[0] * 1000;
  const [chess, setChess] = useState(() => new Chess()),
    [game, setGame] = useState<GameState>(),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [connected, setConnected] = useState(false),
    [flipped, setFlipped] = useState(false),
    [muted, setMuted] = useState(localStorage.getItem('cm-muted') === 'true'),
    [warm, setWarm] = useState(localStorage.getItem('cm-board') === 'warm'),
    [times, setTimes] = useState([initial, initial]),
    [end, setEnd] = useState(''),
    [confirm, setConfirm] = useState(false),
    [index, setIndex] = useState<number | null>(replay ? 0 : null),
    [epoch, setEpoch] = useState(0);
  const worker = useRef<Worker | null>(null),
    sock = useRef<Socket | null>(null),
    current = useRef(chess),
    lastTick = useRef(Date.now()),
    status = useRef(''),
    resultDialog = useRef<HTMLDialogElement | null>(null),
    orientationFor = useRef<string | null>(null),
    sound = useRef<AudioContext | null>(null);
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
  function beep() {
    if (muted) return;
    try {
      const c = sound.current || new AudioContext();
      sound.current = c;
      const o = c.createOscillator(),
        g = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      o.frequency.value = 430;
      g.gain.setValueAtTime(0.035, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      o.start();
      o.stop(c.currentTime + 0.08);
    } catch {
      /* Audio is optional. */
    }
  }
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
          setTimes((t) => [t[0], t[1] + (controls[control] || controls['10+0'])[1] * 1000]);
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
    const s = io({ withCredentials: true });
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
  useEffect(
    () => () => {
      sound.current?.close();
    },
    [],
  );
  function play(from: string, to: string, promotion: string) {
    if (finished || replay || index !== null) return false;
    try {
      const c = new Chess();
      if (chess.pgn()) c.loadPgn(chess.pgn());
      else c.load(chess.fen());
      c.move({ from, to, promotion });
      if (local) {
        if (chess.turn() !== 'w' || !ready) return false;
        setTimes((t) => [t[0] + (controls[control] || controls['10+0'])[1] * 1000, t[1]]);
        adopt(c);
        beep();
      } else {
        if (!connected || !game) return false;
        sock.current?.emit(
          'move:submit',
          { id: gameId, from, to, promotion, revision: game.revision },
          (r: any) => {
            if (!r.ok) setError(r.error);
            else {
              setError('');
              beep();
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
    <div className="game-page">
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
          <div className="player-bar">
            <span
              className={local ? 'avatar bot-avatar' : 'avatar'}
              data-bot={local ? bot.id : undefined}
            >
              {local ? bot.symbol : '♚'}
            </span>
            <div>
              <strong>
                {flipped
                  ? local
                    ? user?.username || 'You'
                    : game?.whiteName
                  : local
                    ? bot.name
                    : game?.blackName || 'Opponent'}
              </strong>
              <small>
                {local
                  ? bot.difficulty + ' · ' + bot.title
                  : connected
                    ? 'Connected to game server'
                    : 'Reconnecting…'}
              </small>
            </div>
            <time
              className={
                chess.turn() === (flipped ? 'w' : 'b') && !finished ? 'clock active' : 'clock'
              }
            >
              {clock(times[flipped ? 0 : 1])}
            </time>
          </div>
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
            lastMove={last}
            warm={warm}
          />
          <div className="player-bar">
            <span className="avatar">♔</span>
            <div>
              <strong>
                {flipped
                  ? local
                    ? bot.name
                    : game?.blackName
                  : local
                    ? user?.username || 'You'
                    : game?.whiteName || 'You'}
              </strong>
              <small>
                {local
                  ? 'Practice makes progress'
                  : game?.rated
                    ? 'Rated club match'
                    : 'Friendly competition'}
              </small>
            </div>
            <time
              className={
                chess.turn() === (flipped ? 'b' : 'w') && !finished ? 'clock active' : 'clock'
              }
            >
              {clock(times[flipped ? 1 : 0])}
            </time>
          </div>
          <div className="board-tools">
            <button onClick={() => setFlipped((x) => !x)}>
              <FlipVertical2 size={16} /> Flip board
            </button>
            <button
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              onClick={() => {
                setMuted(!muted);
                localStorage.setItem('cm-muted', String(!muted));
              }}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              onClick={() => {
                setWarm(!warm);
                localStorage.setItem('cm-board', warm ? 'green' : 'warm');
              }}
            >
              Board: {warm ? 'Walnut' : 'Slate'}
            </button>
          </div>
        </section>
        <aside className="game-panel">
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
                      disabled={!finished && !replay}
                      className={index === i * 2 + j + 1 ? 'current' : ''}
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
          {(finished || replay) && (
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
                onClick={() => setIndex((i) => Math.min(history.length, (i ?? history.length) + 1))}
              >
                <ChevronRight />
              </button>
              <button onClick={() => setIndex(null)}>Final</button>
            </div>
          )}
          <div className="captured">
            Captured:{' '}
            {history
              .filter((m) => m.captured)
              .map((m) => ({ p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' })[m.captured!])
              .join(' ') || '—'}
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
