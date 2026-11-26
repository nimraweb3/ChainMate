import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X, Wallet } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, useAccount } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { anvil, baseSepolia, base } from 'wagmi/chains';
import { AuthProvider, useAuth } from './lib';
import {AppearanceProvider} from './appearance';
import './experience.css';
import Home from './pages/Home';
import './style.css';
import './redesign.css';
const Play = lazy(() => import('./pages/Play'));
const Game = lazy(() => import('./pages/Game'));
const Account = lazy(() => import('./pages/Account'));
const Arena = lazy(() => import('./pages/Arena'));
const Settings = lazy(() => import('./pages/Settings'));
const BoardStudio = lazy(() => import('./pages/BoardStudio'));
const LearnPieces = lazy(() => import('./pages/LearnPieces'));
const WalletPage = lazy(() => import('./pages/Wallet'));
const config = createConfig({
  chains: [anvil, baseSepolia, base],
  connectors: [
    injected(),
    ...(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [anvil.id]: http('http://127.0.0.1:8545'),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
  },
});
const query = new QueryClient();
function Shell() {
  const { user } = useAuth();
  const { address, isConnected } = useAccount();
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
  React.useEffect(() => {
    if (!menu) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        document.querySelector<HTMLButtonElement>('.menu-button')?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menu]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 28 34" fill="none" aria-hidden="true">
              <path
                d="M6 28h17v4H4v-4h2Zm1-3 3-8-5 2-3-4 7-8 3-5 7 5 5 9-2 9H7Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="m13 7 4 3m-8 4 2-1m6 2-3 10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          ChainMate<span className="brand-period">.</span>
        </Link>
        <nav id="main-navigation" className={menu ? 'open' : ''} aria-label="Main navigation">
          <NavLink to="/play">Play</NavLink>
          <NavLink to="/arena">
            Arena <span className="nav-tag">TESTNET</span>
          </NavLink>
          <NavLink to="/tournaments">Tournaments</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <Link className="mobile-wallet-entry" to="/arena?connect=1">
            {isConnected
              ? `Wallet ${address?.slice(0, 6)}…${address?.slice(-4)}`
              : 'Connect Wallet'}
          </Link>
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
          <Link className="wallet-entry" to="/arena?connect=1">
            <Wallet size={15} />
            {isConnected ? `${address?.slice(0, 6)}…${address?.slice(-4)}` : 'Connect Wallet'}
          </Link>
          <button
            className="icon-button menu-button"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="main-navigation"
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
              '/history',
              '/achievements',
              '/leaderboard',
              '/tournaments',
            ].map((p) => (
              <Route key={p} path={p} element={<Account />} />
            ))}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/board" element={<BoardStudio />} />
            <Route path="/learn/pieces" element={<LearnPieces />} />
            <Route path="/wallet" element={<WalletPage />} />
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
          <AppearanceProvider><Shell /></AppearanceProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>,
);
