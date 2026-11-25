import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X, Hexagon } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { anvil, baseSepolia } from 'wagmi/chains';
import { AuthProvider, useAuth } from './lib';
import Home from './pages/Home';
import './style.css';
const Play = lazy(() => import('./pages/Play'));
const Game = lazy(() => import('./pages/Game'));
const Account = lazy(() => import('./pages/Account'));
const Arena = lazy(() => import('./pages/Arena'));
const config = createConfig({
  chains: [anvil, baseSepolia],
  connectors: [injected()],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});
const query = new QueryClient();
function Shell() {
  const { user } = useAuth();
  const [light, setLight] = useState(localStorage.getItem('cm-theme') === 'light');
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  React.useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    localStorage.setItem('cm-theme', light ? 'light' : 'dark');
  }, [light]);
  React.useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Hexagon size={30} />
            <span>♞</span>
          </span>
          ChainMate<span className="brand-period">.</span>
        </Link>
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <NavLink to="/play">Play chess</NavLink>
          <NavLink to="/arena">
            Web3 Arena <span className="nav-tag">TESTNET</span>
          </NavLink>
          <NavLink to="/leaderboard">The club</NavLink>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={light ? 'Use dark theme' : 'Use light theme'}
            onClick={() => setLight(!light)}
          >
            {light ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <Link className="login-link" to={user ? '/dashboard' : '/login'}>
            {user ? user.username : 'Sign in'}
          </Link>
          <Link className="button small" to="/play">
            Let’s play
          </Link>
          <button
            className="icon-button menu-button"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<div className="page loading">Preparing your table…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<Play />} />
            <Route path="/play/:mode" element={<Play />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/game/:gameId/replay" element={<Game replay />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/arena/match/:matchId" element={<Arena />} />
            {[
              '/login',
              '/register',
              '/dashboard',
              '/profile/:username',
              '/settings',
              '/history',
              '/achievements',
              '/leaderboard',
              '/tournaments',
            ].map((p) => (
              <Route key={p} path={p} element={<Account />} />
            ))}
            <Route
              path="*"
              element={
                <div className="page">
                  <h1>Off the board.</h1>
                  <p>This page doesn’t exist.</p>
                  <Link className="button" to="/">
                    Back to the club
                  </Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <Link className="brand" to="/">
          ChainMate.
        </Link>
        <span>A timeless game. A new generation.</span>
        <div>
          <Link to="/settings">Preferences</Link>
          <Link to="/arena">Testnet only</Link>
          <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">
            Powered by Stockfish
          </a>
        </div>
      </footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={query}>
      <BrowserRouter>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>,
);
