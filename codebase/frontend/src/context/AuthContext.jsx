/**
 * context/AuthContext.jsx
 *
 * Global authentication state for BusinessRun.
 *
 * HOW THE COOKIE SESSION WORKS — end to end:
 *
 *   1. USER LOGS IN (or completes GYB signup):
 *      - Server verifies credentials / creates account
 *      - Server signs a JWT and sets it as an HTTP-only cookie named 'br_token'
 *      - Server returns the profile in the response body
 *      - Frontend calls login(profile) → stores profile in React state only
 *      - React state is fast; cookie is the durable source of truth
 *
 *   2. USER REFRESHES THE PAGE (or opens a new tab):
 *      - React state is wiped (it lives only in memory)
 *      - AuthContext calls GET /api/auth/me on mount
 *      - Browser automatically sends the 'br_token' cookie with the request
 *      - Server verifies the JWT, returns the profile
 *      - AuthContext calls login(profile) to re-populate React state
 *      - RoadmapPage renders with real data — user never sees a loading blip
 *        if /api/auth/me responds before the guard effect fires
 *
 *   3. USER IS NOT LOGGED IN (direct URL visitor, expired cookie):
 *      - GET /api/auth/me returns 401
 *      - AuthContext sets user = null, isAuthenticated = false
 *      - RoadmapPage guard redirects to home
 *
 *   4. USER LOGS OUT:
 *      - Frontend calls logout()
 *      - POST /api/auth/logout — server clears the cookie (only the server
 *        can clear an HTTP-only cookie; JS cannot touch it)
 *      - React state cleared, user redirected to home
 *
 * WHY NO sessionStorage / localStorage:
 *   With HTTP-only cookies, no token ever touches JS-accessible storage.
 *   XSS attacks cannot steal the session token because they cannot read
 *   HTTP-only cookies. This is the industry-standard approach.
 *
 * ── SPACE TYPE ─────────────────────────────────────────────────────
 * 'business' | 'personal' — which kind of session this is. Personal
 * Wealth OS is a separate space type from a business (see the build
 * discussion) — same login/session mechanism, different dashboard.
 * Every endpoint that establishes a session now returns `spaceType`
 * alongside `profile`; components should branch on this (e.g. which
 * dashboard route to send someone to) rather than guessing from the
 * shape of `profile` alone.
 *
 * ── SUBSCRIPTION STATE ────────────────────────────────────────────
 * Every endpoint that establishes or refreshes a session (GET /me,
 * POST /login, /select-business, /switch-business, and GYB signup)
 * now also returns `subscription` (plan/status/days-remaining info)
 * and `teamAccessBlocked` (true when a team member's business has
 * dropped to a plan that doesn't support team members at all). Both
 * are stored here so any component can read them via useAuth()
 * without a separate fetch.
 *
 * USAGE:
 *   // In App.jsx (once):
 *   <AuthProvider> ... </AuthProvider>
 *
 *   // Anywhere in the tree:
 *   const { user, subscription, teamAccessBlocked, isAuthenticated, isRestoring, login, logout } = useAuth();
 */

import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef,
} from 'react';

// ── Context ───────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,              setUser]              = useState(null);
  const [spaceType,         setSpaceType]         = useState(null); // 'business' | 'personal' | null (not logged in)
  const [subscription,      setSubscription]      = useState(null);
  const [teamAccessBlocked, setTeamAccessBlocked]  = useState(false);
  const [isRestoring,       setIsRestoring]        = useState(true);  // true while /me is in-flight

  // Prevent double-firing in React 18 StrictMode (mounts twice in dev)
  const restoredRef = useRef(false);

  // ── Session restore on mount ────────────────────────────────────
  // On every page load / refresh, ask the server "is my cookie still valid?"
  // The browser sends the HTTP-only cookie automatically — no JS cookie access.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    async function restoreSession() {
      // Safety net — if /api/auth/me never resolves (network stall,
      // server down, CORS issue), we must still clear isRestoring so
      // the page never stays permanently blank. 8 seconds is generous
      // enough for slow connections but short enough to feel responsive.
      const safetyTimer = setTimeout(() => {
        setIsRestoring(false);
      }, 8000);

      try {
        const res = await fetch('/api/auth/me', {
          method:      'GET',
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.profile) {
            setUser(data.profile);
            setSpaceType(data.spaceType || 'business');
            setSubscription(data.subscription ?? null);
            setTeamAccessBlocked(Boolean(data.teamAccessBlocked));
          }
        }
        // 401 = no valid cookie — user stays null (not logged in)
      } catch {
        // Network error — stay null, let the page guard handle it
      } finally {
        clearTimeout(safetyTimer);
        setIsRestoring(false);
      }
    }

    restoreSession();
  }, []);

  // ── login ────────────────────────────────────────────────────────
  /**
   * Called immediately after a successful login or signup response.
   * The profile comes from the server response body — the cookie was
   * already set by the server in the same response.
   *
   * @param {Object} profile  Normalised profile from server response
   * @param {Object} [meta]   Optional — { subscription, teamAccessBlocked, spaceType }.
   *                           spaceType defaults to 'business' when omitted —
   *                           every call site predates Personal Wealth OS
   *                           except the new personal onboarding/login ones.
   */
  const login = useCallback((profile, meta = {}) => {
    setUser(profile);
    setSpaceType(meta.spaceType || 'business');
    setSubscription(meta.subscription ?? null);
    setTeamAccessBlocked(Boolean(meta.teamAccessBlocked));
  }, []);

  // ── logout ───────────────────────────────────────────────────────
  /**
   * Calls POST /api/auth/logout to clear the HTTP-only cookie server-side
   * (JS cannot clear HTTP-only cookies itself), then clears React state.
   *
   * @param {Function} [navigate]  Optional — pass navigate to redirect after logout
   */
  const logout = useCallback(async (navigate) => {
    try {
      await fetch('/api/auth/logout', {
        method:      'POST',
        credentials: 'include',
      });
    } catch {
      // If the network request fails, clear React state anyway —
      // the cookie will expire naturally in 7 days
      console.warn('[Auth] Logout request failed — clearing local state only.');
    }
    setUser(null);
    setSpaceType(null);
    setSubscription(null);
    setTeamAccessBlocked(false);
    if (typeof navigate === 'function') {
      navigate('/', { replace: true });
    }
  }, []);

  // ── setUserProfile ───────────────────────────────────────────────
  /**
   * Merges partial updates into the current user profile.
   * Does NOT update the cookie — call a server endpoint and re-login()
   * if you need the cookie to reflect new data.
   *
   * @param {Object} updates  Partial profile fields to merge
   */
  const setUserProfile = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  // ── refreshSubscription ───────────────────────────────────────────
  /**
   * Re-fetches just /api/auth/me and updates subscription/
   * teamAccessBlocked in place, without touching `user` or
   * `isRestoring`. Used right after a payment completes (the billing
   * callback page) or after any action that could change plan state,
   * so the rest of the app sees fresh limits/features immediately
   * instead of waiting for the next full page load.
   */
  const refreshSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { method: 'GET', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription ?? null);
        setTeamAccessBlocked(Boolean(data.teamAccessBlocked));
      }
    } catch {
      // Silent — this is a best-effort refresh, not a session check
    }
  }, []);

  // ── setDisplayCurrency ───────────────────────────────────────────
  /**
   * Personal Wealth OS only — changes which currency the dashboard
   * displays totals in "at will" (WealthDashboard.jsx's currency
   * switcher calls this). Optimistic: updates `user.displayCurrency`
   * immediately via setUserProfile so every screen re-renders
   * converted amounts instantly, then persists the choice with PATCH
   * /api/personal/profile in the background so it sticks across
   * sessions/devices. A failed PATCH is logged but does NOT roll back
   * the local switch — the person is still looking at the currency
   * they asked for; it just may not have saved as their new default
   * yet. This never touches any stored record's own `currency` — see
   * personalProfile.controller.js's header comment.
   *
   * @param {string} newCurrency  A code from utils/currency.js's CURRENCIES
   */
  const setDisplayCurrency = useCallback(async (newCurrency) => {
    setUserProfile({ displayCurrency: newCurrency });
    try {
      const res = await fetch('/api/personal/profile', {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ displayCurrency: newCurrency }),
      });
      if (!res.ok) {
        console.warn('[Auth] Failed to persist display currency change — will retry next change.');
      }
    } catch {
      console.warn('[Auth] Network error persisting display currency change.');
    }
  }, [setUserProfile]);

  // ── updateSubscription ────────────────────────────────────────────
  /**
   * Directly update subscription state without calling /api/auth/me.
   * Used by BillingCallbackPage when the login session expired during
   * checkout but the payment was successful — the verify endpoint
   * returns the subscription data directly so we can update state
   * without needing a valid session.
   *
   * @param {Object} newSubscription  The subscription object from the server
   */
  const updateSubscription = useCallback((newSubscription) => {
    if (newSubscription) {
      setSubscription(newSubscription);
    }
  }, []);

  const value = {
    user,
    spaceType,
    subscription,
    teamAccessBlocked,
    // Boolean(user), NOT `user !== null` — a caller that accidentally
    // calls login(undefined, ...) (e.g. a login response the client
    // doesn't fully recognize yet) must NOT be treated as
    // authenticated. `undefined !== null` is true, which would have
    // silently flipped this on with no real profile behind it.
    isAuthenticated: Boolean(user),
    isRestoring,    // true while /api/auth/me is in-flight — guards can wait on this
    login,
    logout,
    setUserProfile,
    refreshSubscription,
    updateSubscription,
    setDisplayCurrency,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── useAuth hook ──────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>.');
  }
  return ctx;
}
