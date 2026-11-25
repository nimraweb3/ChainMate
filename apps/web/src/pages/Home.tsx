import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Globe2,
  MoveUpRight,
  ChevronDown,
  Mouse,
  Users,
  Layers3,
  Flame,
} from 'lucide-react';
import World from '../components/World';
import { bots } from '../../../../packages/shared/types';
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> THE NEXT MOVE IS YOURS
          </div>
          <h1>
            Every move
            <br />
            <em>matters.</em>
          </h1>
          <p>
            A timeless game. A new way to play.
            <br />
            Challenge minds. Find your rivals.
            <br />
            Take your victories on-chain.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/play">
              Play chess <span>♞</span>
            </Link>
            <Link className="text-link" to="/arena">
              Explore the Arena
            </Link>
          </div>
          <div className="hero-fine">
            <ShieldCheck size={15} /> Free to play. No wallet required.
          </div>
        </div>
        <World />
        <div className="hero-bottom">
          <span>STRATEGY MEETS POSSIBILITY</span>
          <a href="#rivals">
            <Mouse size={16} /> Scroll to explore <ChevronDown size={15} />
          </a>
          <span className="hero-coordinate">64 SQUARES. YOUR NEXT CHAPTER.</span>
        </div>
      </section>
      <div className="value-strip">
        <span>
          <Globe2 /> A game without borders
        </span>
        <span>
          <Users /> Real rivals. Real connections.
        </span>
        <span>
          <Layers3 /> Your game, verified.
        </span>
      </div>
      <section className="section rivals" id="rivals">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE HUMAN SIDE OF CHESS</div>
            <h2>
              Find your
              <br />
              <em>next rival.</em>
            </h2>
          </div>
          <p>
            Across the table or across the world.
            <br />
            There’s nothing quite like a real opponent.
          </p>
        </div>
        <div className="play-paths">
          <Link className="path path-primary" to="/play/online">
            <span className="path-icon">
              <Globe2 size={28} />
            </span>
            <span className="path-kicker">MEET YOUR MATCH</span>
            <h3>
              The world is
              <br />
              your chess club.
            </h3>
            <p>
              Find an opponent. Make your opening.
              <br />
              Play a game worth remembering.
            </p>
            <span className="path-action">
              Play online <MoveUpRight size={20} />
            </span>
            <div className="line-globe" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </Link>
          <Link className="path" to="/play/friend">
            <span className="path-icon">
              <Users size={28} />
            </span>
            <span className="path-kicker">A FRIENDLY CHALLENGE</span>
            <h3>
              Settle it
              <br />
              on the board.
            </h3>
            <p>
              Your friend. Your time control.
              <br />A private table, just for two.
            </p>
            <span className="path-action">
              Invite a friend <MoveUpRight size={20} />
            </span>
            <span className="giant-knights" aria-hidden="true">
              ♞♘
            </span>
          </Link>
        </div>
      </section>
      <section className="section bot-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THREE MINDS. THREE CHALLENGES.</div>
            <h2>
              Meet your <em>match.</em>
            </h2>
          </div>
          <Link className="text-link" to="/play/bot">
            Explore the bots
          </Link>
        </div>
        <div className="bot-row">
          {bots.map((b, i) => (
            <Link className="bot-card" to={'/play/bot?bot=' + b.id} key={b.id}>
              <div className={'bot-art bot-art-' + i}>
                <span>{b.symbol}</span>
                <i />
                <i />
              </div>
              <div className="bot-card-info">
                <span className="difficulty">{b.difficulty}</span>
                <h3>
                  {b.name}
                  <span> / {b.title}</span>
                </h3>
                <p>{b.description}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="section-footnote">
          Powered by Stockfish. Distinct skill settings. No invented Elo ratings.
        </p>
      </section>
      <section className="arena-story section" id="arena-story">
        <div className="vault-art" aria-hidden="true">
          <div className="vault-ring" />
          <div className="vault-ring second" />
          <div className="vault-cube">
            <ShieldCheck size={66} />
          </div>
          <div className="vault-tag">CHESS × SMART CONTRACTS</div>
          <span className="vault-orbit orbit-a">♔</span>
          <span className="vault-orbit orbit-b">◇</span>
        </div>
        <div className="arena-story-copy">
          <div className="eyebrow">
            WELCOME TO THE WEB3 ARENA <span className="pill">TESTNET</span>
          </div>
          <h2>
            A new way
            <br />
            <em>to compete.</em>
          </h2>
          <p>
            Same beautiful game. A verifiable finish.
            <br />
            Explore matches backed by transparent, test-token escrow.
          </p>
          <ul className="feature-lines">
            <li>
              <ShieldCheck /> Equal deposits. Clear rules.
            </li>
            <li>
              <Layers3 /> Verified results. Visible settlement.
            </li>
            <li>
              <Flame /> Play for the experience. Tokens have no value.
            </li>
          </ul>
          <Link className="button outline" to="/arena">
            Enter the Arena
          </Link>
          <small>Testnet only. Trusted result verification. No real-money stakes.</small>
        </div>
      </section>
      <section className="identity section">
        <div className="eyebrow">YOUR STORY, ONE MOVE AT A TIME</div>
        <h2>
          Make your
          <br />
          moves <em>count.</em>
        </h2>
        <p>
          Build your rating. Revisit your games.
          <br />
          Become the player you want to be.
        </p>
        <Link to="/register" className="button">
          Find your place at the table
        </Link>
        <div className="identity-piece" aria-hidden="true">
          ♔
        </div>
      </section>
    </>
  );
}
