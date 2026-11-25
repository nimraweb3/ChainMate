import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  MoveUpRight,
  ShieldCheck,
  MousePointer2,
} from 'lucide-react';
import { bots, type User } from '../../../../packages/shared/types';
import { useResource } from '../lib';
const PreviewBoard = lazy(() => import('../components/PreviewBoard'));
const modes = [
  {
    title: 'Blitz',
    value: '3 + 2',
    caption: 'A little less time. A little more instinct.',
    href: '/play/online?control=3%2B2',
  },
  {
    title: 'Rapid',
    value: '10 + 0',
    caption: 'Take a breath. Find your next move.',
    href: '/play/online?control=10%2B0',
  },
  {
    title: 'Play a bot',
    value: 'Your pace.',
    caption: 'Three minds. A challenge at every level.',
    href: '/play/bot',
  },
  {
    title: 'Web3 Arena',
    value: 'On-chain.',
    caption: 'A new way to compete. Testnet only.',
    href: '/arena',
  },
];
function Preview() {
  const ref = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="live-preview" ref={ref}>
      {visible ? (
        <Suspense fallback={<div className="preview-loading">Preparing the board…</div>}>
          <PreviewBoard />
        </Suspense>
      ) : (
        <div className="preview-loading">Your next move is waiting.</div>
      )}
    </div>
  );
}
export default function Home() {
  const hero = useRef<HTMLElement>(null);
  const { data: players, error } = useResource<User[]>('/leaderboard');
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = Math.min(1, window.scrollY / 900);
        hero.current?.style.setProperty('--camera', `${p * 28}px`);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, []);
  return (
    <div className="studio-home">
      <section className="cinema" ref={hero}>
        <picture className="cinema-art">
          <source media="(max-width: 600px)" srcSet="/art/hero-mobile.webp" />
          <img
            src="/art/hero-knight.webp"
            alt="Monumental black-chrome knight with a pearl bishop, lit by silver and subtle copper reflections"
            width="1672"
            height="941"
            fetchPriority="high"
          />
        </picture>
        <div className="cinema-shade" />
        <div className="cinema-topline">
          <span>THE ART OF THE NEXT MOVE</span>
          <span>CHESS. RECONSIDERED.</span>
        </div>
        <div className="cinema-copy">
          <h1>
            EVERY MOVE
            <br />
            <span>MATTERS.</span>
          </h1>
          <div className="cinema-intro">
            <span className="fine-cross">+</span>
            <p>
              Your next rival is one move away.
              <br />
              Play the game. Own the moment.
            </p>
          </div>
          <div className="cinema-actions">
            <Link to="/play" className="button">
              Play Now <ArrowUpRight size={21} />
            </Link>
            <Link to="/arena" className="quiet-link">
              Explore the Arena <ArrowUpRight size={15} />
            </Link>
          </div>
          <p className="cinema-note">Free to play. No wallet required.</p>
        </div>
        <div className="art-annotation">
          <span>KNIGHT / BLACK CHROME</span>
          <i />
          <span>Tradition, in a different light.</span>
        </div>
        <div className="mode-dock">
          {modes.map((m) => (
            <Link key={m.title} to={m.href}>
              <div>
                <span>{m.title}</span>
                <ArrowUpRight size={17} />
              </div>
              <strong>{m.value}</strong>
              <p>{m.caption}</p>
            </Link>
          ))}
        </div>
        <a href="#begin" className="cinema-scroll">
          SCROLL TO MAKE YOUR MOVE <ChevronDown size={15} />
        </a>
      </section>
      <section className="editorial-section beginning" id="begin">
        <div className="section-meta">
          <span>THE GAME BEGINS</span>
          <span>ONE BOARD. EVERY POSSIBILITY.</span>
        </div>
        <div className="begin-layout">
          <h2>
            A seat for
            <br />
            <span>every mind.</span>
          </h2>
          <div className="editorial-menu">
            {[
              {
                name: 'Play the world',
                copy: 'Find your next rival. Casual or rated.',
                to: '/play/online',
              },
              {
                name: 'Challenge a friend',
                copy: 'Your own table. A link to share.',
                to: '/play/friend',
              },
              {
                name: 'Meet the machines',
                copy: 'Three distinct minds. Always ready.',
                to: '/play/bot',
              },
              {
                name: 'Enter the Arena',
                copy: 'Test-token matches. Verifiable results.',
                to: '/arena',
              },
            ].map((m) => (
              <Link to={m.to} key={m.name}>
                <div>
                  <h3>{m.name}</h3>
                  <p>{m.copy}</p>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="gallery-section">
        <div className="gallery-caption">
          <span>THE CHAINMATE COLLECTION</span>
          <span>FORM FOLLOWS STRATEGY</span>
        </div>
        <picture>
          <source media="(max-width:600px)" srcSet="/art/gallery-small.webp" />
          <img
            src="/art/gallery.webp"
            alt="Copper, cobalt, pearl, and black-chrome chess sculptures on a brushed silver chessboard"
            loading="lazy"
            width="1672"
            height="941"
          />
        </picture>
        <div className="gallery-editorial">
          <h2>
            Strategy has
            <br />a new form.
          </h2>
          <div>
            <span className="dark-label">A TIMELESS GAME. A NEW PERSPECTIVE.</span>
            <p>
              Sixty-four squares. Infinite possibility.
              <br />
              Built for a generation that plays its own way.
            </p>
            <Link className="gallery-link" to="/play">
              Find your game <ArrowUpRight size={20} />
            </Link>
          </div>
        </div>
      </section>
      <section className="editorial-section real-game">
        <div className="real-game-copy">
          <span className="section-label">BEAUTIFUL IS ONLY THE BEGINNING</span>
          <h2>
            Made for
            <br />
            the next <span>move.</span>
          </h2>
          <p>
            No waiting room. No wallet.
            <br />
            Just you, the board, and what comes next.
          </p>
          <div className="preview-instructions">
            <MousePointer2 size={17} />
            <span>
              Try the board. Tap a piece, then a square.
              <br />
              Both sides are yours in this preview.
            </span>
          </div>
          <Link className="button" to="/play/bot">
            Play a full game <ArrowUpRight size={19} />
          </Link>
          <div className="game-specs">
            <span>LEGAL MOVES</span>
            <span>REAL STOCKFISH</span>
            <span>YOUR PACE</span>
          </div>
        </div>
        <Preview />
      </section>
      <section className="chain-section">
        <div className="chain-art">
          <img
            src="/art/ethereum.webp"
            alt="Reflective platinum bishop"
            loading="lazy"
            width="591"
            height="887"
          />
          <div className="chain-art-label">
            <ShieldCheck size={18} /> VERIFIED, MOVE BY MOVE.
          </div>
        </div>
        <div className="chain-copy">
          <div className="section-label">
            THE ON-CHAIN ARENA <span className="pill">TESTNET</span>
          </div>
          <h2>
            Your game.
            <br />
            <span>On-chain.</span>
          </h2>
          <p>
            Same beautiful game. A transparent finish.
            <br />
            Compete with test-token escrow and inspect every settlement.
          </p>
          <ol className="escrow-steps">
            {[
              'Two players. Equal deposits.',
              'One match. Server-verified result.',
              'Clear settlement. A lasting record.',
            ].map((s, i) => (
              <li key={s}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s}
              </li>
            ))}
          </ol>
          <Link className="button outline" to="/arena">
            Explore the Arena <ArrowUpRight size={19} />
          </Link>
          <p className="chain-disclosure">
            Non-redeemable test tokens. Trusted result verification.
            <br />
            Escrow does not independently prevent chess cheating.
          </p>
        </div>
      </section>
      <section className="editorial-section opponents-section">
        <div className="opponents-heading">
          <div>
            <span className="section-label">DIFFERENT MINDS. DIFFERENT GAMES.</span>
            <h2>
              Know your
              <br />
              <span>opponent.</span>
            </h2>
          </div>
          <p>
            From your first opening
            <br />
            to your next obsession.
          </p>
        </div>
        <div className="sculpture-bots">
          {bots.map((b) => (
            <Link className="sculpture-bot" key={b.id} to={'/play/bot?bot=' + b.id}>
              <div className="sculpture-bot-image">
                <img
                  src={'/art/' + b.id + '.webp'}
                  alt={`${b.name}: ${b.id === 'bitcoin' ? 'a copper rook' : b.id === 'ethereum' ? 'a platinum bishop' : 'a titanium knight'}`}
                  width="591"
                  height="887"
                  loading="lazy"
                />
                <span className="bot-level">{b.difficulty}</span>
              </div>
              <div className="sculpture-bot-copy">
                <div>
                  <h3>{b.name}</h3>
                  <span>{b.title}</span>
                </div>
                <ArrowUpRight size={23} />
                <p>{b.description}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="engine-credit">
          Powered by Stockfish. Real engine settings, no invented ratings.
        </p>
      </section>
      <section className="club-section editorial-section">
        <div>
          <span className="section-label">THE CLUB IS WHAT WE MAKE IT</span>
          <h2>
            Earn your
            <br />
            <span>place.</span>
          </h2>
          <Link to="/leaderboard" className="quiet-link">
            Explore the leaderboard <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="club-board">
          <div className="club-board-heading">
            <span>CLUB STANDINGS</span>
            <span>RATING</span>
          </div>
          {error ? (
            <p>Standings are unavailable right now. Please try again shortly.</p>
          ) : !players ? (
            <p>Loading the club…</p>
          ) : players.length ? (
            players.slice(0, 4).map((p, i) => (
              <Link to={'/profile/' + p.username} key={p.id}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{p.username}</strong>
                <b>{p.rating}</b>
                <MoveUpRight size={16} />
              </Link>
            ))
          ) : (
            <div className="club-empty">
              <span>THE FIRST CHAPTER IS YOURS.</span>
              <p>
                No rated games yet.
                <br />
                Be part of the opening move.
              </p>
              <Link to="/play/online">
                Play a rated match <ArrowRight size={17} />
              </Link>
            </div>
          )}
          <div className="club-event">
            <span>TOURNAMENTS</span>
            <p>In the making. Registration isn’t open yet.</p>
            <Link to="/tournaments">
              Details <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <section className="final-move">
        <div className="final-line">
          <span>THE POSSIBILITIES ARE ENDLESS.</span>
          <span>THE NEXT ONE IS YOURS.</span>
        </div>
        <h2>
          Your move<span>.</span>
        </h2>
        <Link className="button" to="/play">
          Start Playing <ArrowUpRight size={23} />
        </Link>
        <span className="final-signature">CHAINMATE — THE ART OF THE NEXT MOVE</span>
      </section>
    </div>
  );
}
