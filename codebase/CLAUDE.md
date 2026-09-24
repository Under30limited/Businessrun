# CLAUDE.md

This file orients any Claude session (chat or Claude Code) working on this
repo. Read it fully before touching code. **More features will be added to
this project after this point** — this file describes the state as of the
Personal Wealth OS, multi-currency, contact/feedback, and payment-session
work already completed. Treat it as a living document: when you add or
change something significant, update this file in the same session rather
than leaving it stale.

**Before starting any new task**, in addition to reading this file:
1. Read the actual current contents of any file you're about to touch —
   never assume this document's description of it is still 100% current.
2. Re-scan the codebase (or at least the area relevant to the task) for
   anything that looks broken, inconsistent, duplicated, or unfinished, and
   surface it — even if it's unrelated to what you were asked to do. Don't
   silently work around a bug you notice; name it. See "Known issues /
   technical debt" below for what's already been flagged — check whether
   your task touches any of it, and add to that list anything new you find.
3. Never restructure or "clean up" working code as a side effect of an
   unrelated task. Fix only what the task needs, or what you're explicitly
   asked to review.

---

## 1. What this project is

**BusinessRun** — an SME toolkit for a Nigerian/African small-business
audience, with two logged-in product surfaces sharing one identity system,
plus a public marketing site:

- **Business OS** — inventory, sales, day log, CFO tools, reports, team
  management, an AI business advisor, and subscription billing.
- **Personal Wealth OS** — a separate, free (no plan-gating), single-user
  personal finance tracker: accounts, income, expenses, assets, goals,
  debts, a day log, net worth, and its own AI wealth advisor.
- **Public site** — marketing pages, lead-gen tools (profit calculator,
  receipt generator, etc.), and the shared sign-up/log-in entry points for
  both OS products.

One person (one "identity") can own/belong to a business **and** have a
personal space, at the same time, and switches between them via a session
picker at login.

---

## 2. Tech stack

- **Backend**: Node.js, Express 4, DynamoDB (via `@aws-sdk/lib-dynamodb`),
  S3 (images), JWT session cookies, PM2 (`ecosystem.config.js`)
- **Payments**: Paystack (hosted checkout, webhook + client verify)
- **AI**: Google Gemini (`services/gemini.service.js`), used by both the
  Business advisor and the Wealth advisor, plus Day Log free-text
  extraction
- **Email**: Resend (`services/email.service.js`)
- **Frontend**: React (Create React App / `react-scripts`), React Router,
  Tailwind-style utility classes, `lucide-react` icons, `fetch()` directly
  against the API (no SDK/client layer)

---

## 3. Repo layout — READ THIS BEFORE WRITING IMPORTS

**Frontend root**: `businessrun-frontend/src`

```
src/
  App.jsx                     ← owns most top-level modal state (GYB, Personal, Contact, Space picker)
  context/
    AuthContext.jsx
  utils/
    currency.js
  components/                 ← ONE level from context/ and utils/
    HomePage.jsx, Navbar.jsx, Footer.jsx (unused — see below)
    GrowYourBusinessModal.jsx, PersonalWealthModal.jsx, SpaceChoiceModal.jsx
    RoadmapPage.jsx           ← Business OS dashboard shell
    WealthDashboard.jsx       ← Personal Wealth OS dashboard shell
    ContactModal.jsx, ContactTrigger.jsx
    BillingPage.jsx, BillingCallbackPage.jsx
    TeamSettings.jsx, InventoryDashboard.jsx, SalesDayBook.jsx, DayLog.jsx,
    ReportsView.jsx, SubscriptionAlerts.jsx, LowStockBanner.jsx, ...
    wealth/                   ← TWO levels from context/ and utils/ — needs ../../
      AccountsScreen.jsx, IncomeScreen.jsx, ExpensesScreen.jsx,
      AssetsScreen.jsx, GoalsScreen.jsx, DebtsScreen.jsx,
      DayLogScreen.jsx, NetWorthScreen.jsx, AdvisorScreen.jsx
```

**⚠️ Import-depth gotcha (already caused one broken build):** components
directly under `components/` import context/utils as `../context/...` /
`../utils/...`. Components under `components/wealth/` need `../../context/...`
/ `../../utils/...`. Get this wrong and `react-scripts build` fails outright
with "Module not found" — it's a hard build failure, not a lint warning.
Always check which folder a file actually lives in before writing a
relative import; don't assume based on a zip/upload's flattened structure.

**`Footer.jsx` exists but is dead code** — not imported anywhere. The real,
rendered home-page footer is written inline inside `HomePage.jsx`. Don't
edit `Footer.jsx` expecting it to show up on the site.

**Backend root**: `businessrun-backend` (or equivalent)

```
index.js
config/           personalOptions.js, currencies.js, corsOptions.js, plans.js
controllers/      one per route group — thin, asyncHandler-wrapped
middleware/       auth.js (protect/optionalAuth), permissions.js, plan.js,
                  rateLimiter.js, requirePersonalSpace.js
routes/           one per route group, mirrors controllers/
services/         db.service.js (business), personal.service.js,
                  contact.service.js, marketData.service.js,
                  subscription.service.js, paystack (via payments.controller),
                  fx.service.js, email.service.js, gemini.service.js,
                  wealthAdvisor.service.js
utils/            jwt.js, ApiError.js, sanitise.js, asyncHandler.js
scripts/          setup-personal-tables.js, setup-contact-table.js,
                  setup-paystack-plans.js, migrate-subscriptions.js
```

**⚠️ Known dead/duplicate files (not yet cleaned up):** `middleware/auth.js`
≡ `utils/auth.js`, `middleware/permissions.js` ≡ `utils/permissions.js`,
`routes/team.routes.js` ≡ `controllers/team.routes.js` — byte-identical
duplicates. Only the `middleware/`/`routes/` copies are actually
`require()`'d anywhere. Don't edit the `utils/`/`controllers/` copies
expecting the change to take effect — nothing points at them.

---

## 4. Identity & auth model

- **`identityUid`** = the real person. **`businessUid`**/**`personalUid`**
  = which space a session is scoped to. One identity can have a business
  membership *and* a personal space simultaneously.
- JWT cookie **`br_token`** (httpOnly, 7-day, `sameSite: lax`) carries
  `spaceType: 'business' | 'personal'` plus the relevant uid(s).
- A **pre-auth token** handles the case where login resolves to more than
  one space (business + personal, or 2+ businesses) — `POST
  /api/auth/select-space` finishes the login once the person picks one.
  `GrowYourBusinessModal.jsx` and `PersonalWealthModal.jsx` both need to
  handle `requiresSpaceSelection` in the login response, not just the
  older `requiresBusinessSelection` shape.
- A separate cookie **`br_pmt_token`** (1-hour, path-scoped to
  `/api/payments`) proves "this browser started this specific Paystack
  checkout" independent of whether `br_token` survives the redirect —
  see §7.
- **Two independent authorization axes**, checked separately, on purpose:
  `requireFeature` (did the business owner grant this team member access
  — re-checked live from DB every request, not just JWT-trusted, so
  revocation is instant) vs. `requirePlan` (does the subscription tier
  include this feature at all — blocks owners too).
- `middleware/auth.js`'s `protect` and `optionalAuth` share one
  `buildReqUser` helper and both correctly handle business *and* personal
  sessions. `optionalAuth` sets `req.user = null` for anonymous requests
  rather than 401ing — used for anything that needs to work both logged
  in and anonymous (public advisor widget, `/api/contact`).

---

## 5. Business OS

Entry: `RoadmapPage.jsx` (dashboard shell — sidebar, mobile drawer, sticky
header, internal tab router). Tabs: Business OS overview, AI Advisor,
Digital CFO, Inventory, Sales, Day Log, Team, Billing.

Subscription logic (`services/subscription.service.js`) is **lazy/computed,
not cron-driven** — every request recomputes trial/period status against
`Date.now()`. Plans live in `config/plans.js`, with a generated
`paystack-plans.generated.json` holding live Paystack plan codes (produced
by `scripts/setup-paystack-plans.js`).

---

## 6. Personal Wealth OS

Entry: `WealthDashboard.jsx` — deliberately mirrors `RoadmapPage.jsx`'s
shell conventions (same sidebar/drawer pattern, separate `localStorage` key
so state doesn't collide). No Team or Billing tabs — single-user, free,
no plan-gating anywhere in this module by design.

**Domain**: Accounts, Income (with envelope budgeting), Expenses (with
reimbursement + receipt upload), Assets (manual or market-tracked via
`marketData.service.js` — CoinGecko/Finnhub, 10-min cache, never fabricates
a price), Goals, Debts (`i_owe` / `owed_to_me` as one unified entity type),
Day Log (AI-assisted cash/promise extraction), Net Worth (+ history +
cash flow, computed fresh, `null` for anything not honestly computable —
never a guessed number).

**Onboarding**: `PersonalWealthModal.jsx`, a 4-step wizard mirroring
`GrowYourBusinessModal.jsx`'s pattern — Basics (incl. currency choice) →
Business Pulse → Trust & Match → Secure Account, resolved via OTP.
`SpaceChoiceModal.jsx` is the universal "Personal vs Business" chooser
every sign-up/log-in trigger site-wide opens first.

**Backend**: `services/personal.service.js` (own DynamoDB tables, `br-
personal*`), one controller/route pair per sub-domain, all validated
against `config/personalOptions.js`'s shared constant lists.

---

## 7. Payments (Paystack) — history of bugs found & fixed here

This area has had several real, subtle bugs — read this before touching
anything payment-related again:

1. **`services/fx.service.js` was missing `convertAmount`** —
   `personal.service.js` imported it but it didn't exist, crashing any
   income/expense creation linked to an account. Fixed by adding it (and
   later superseded — `personal.service.js` now uses the multi-currency
   `convertAmount` in `config/currencies.js` instead, since accounts can
   now be in any of 13 currencies, not just NGN/USD).
2. **`GrowYourBusinessModal.jsx` didn't handle `requiresSpaceSelection`** —
   only checked the older `requiresBusinessSelection` shape, so a mixed
   business+personal identity logging in fell through to
   `login(undefined, ...)`. Fixed with a `spacePicker` state + `POST
   /api/auth/select-space` handling. Related: `AuthContext.jsx`'s
   `isAuthenticated` was `user !== null` instead of `Boolean(user)` —
   `undefined !== null` is `true`, which would have silently "authenticated"
   a broken session. Fixed.
3. **`controllers/payments.controller.js`'s `verify()` computed
   `sessionValid: Boolean(req.user)` only** — ignoring `tokenMatchesThisReference`,
   which the same function already used to authorize the rest of the
   request. This meant `verify()` could correctly apply a plan upgrade via
   the payment-token proof, but still report `sessionValid: false` and
   show "Session Expired" to the user. Fixed to
   `Boolean(req.user) || tokenMatchesThisReference`.
4. **Root cause of "session expired immediately after payment" (bigger
   than #3 alone)**: `utils/jwt.js`'s cookie options had no `domain`
   attribute, making both `br_token` and `br_pmt_token` host-only cookies.
   `config/corsOptions.js` whitelists both `thebusinessrun.com` and
   `www.thebusinessrun.com` as the same logical site, but
   `payments.controller.js`'s Paystack `callback_url` always points at a
   single fixed `APP_URL` host. A user logged in on `www.` and redirected
   back to the bare domain (or vice versa) lost **both** cookies — not a
   flaky redirect issue, a deterministic host mismatch. Fixed by adding an
   explicit `domain: '.thebusinessrun.com'` (production only; must stay
   `undefined` in dev or `localhost` breaks) to `COOKIE_OPTIONS` and
   `PAYMENT_COOKIE_OPTIONS`, propagated automatically to the `CLEAR_*`
   variants since they spread from the same object.

**If a payment/session bug ever resurfaces**, check in this order: (a) is
`domain` actually deployed and is `NODE_ENV=production` set, (b) does
`sessionValid` still account for both proofs, (c) does `APP_URL` match a
real, consistently-used host, (d) was PM2 actually restarted after the
deploy.

---

## 8. Multi-currency support

- **Single source of truth, both sides**: `config/currencies.js`
  (backend) and `utils/currency.js` (frontend) — 13 currencies (USD, NGN,
  KES, GHS, ZAR, GBP, CAD, EUR, AED, RWF, UGX, AUD, INR), static USD-pivot
  rates, symbols. **Keep these two files in sync by hand** — nothing
  currently enforces they match.
- Every personal-finance controller's currency validation reads
  `CURRENCIES` from `config/personalOptions.js`, which re-exports from
  `config/currencies.js` — adding a currency there is a one-place change.
- **Records keep their own currency always.** `displayCurrency` (set at
  onboarding, changeable any time via the dashboard header dropdown → 
  `PATCH /api/personal/profile`) only controls what screens convert *into*
  for display — it never rewrites a stored record's `currency` field.
- Screens that aggregate server-side (Net Worth, Cash Flow) re-fetch with
  `?currency=X` on switch. Everything else (Accounts, Income, Expenses,
  Assets, Goals, Debts lists) converts client-side instantly via
  `formatUnifiedAmount`/`getCurrencySymbol` — no round trip needed.
- Found and fixed while wiring this in: `personalAssets.controller.js`'s
  market-asset pricing was hand-rolled NGN/USD-only math; the Day Log AI
  extraction prompt only recognized `$`/`₦`. Both now use the shared
  13-currency table.

---

## 9. AI Advisors (Business + Personal)

Both go through `services/gemini.service.js`'s `callGemini`/
`parseJsonResponse`. **Not every message re-fetches the DB.** A full data
refresh (accounts/income/expenses/assets/debts/goals/day-log — 7 parallel
queries for the Wealth advisor) only happens when the frontend sends
`refreshContext: true`, which is only true on the first message after the
tab/component mounts (switching tabs unmounts it — conditional rendering,
not just hidden) or right after "Clear chat". Every other message in the
same session relies purely on conversation history, **not** fresh data —
the base-data injection is ephemeral and never persisted to the saved
chat history. A message referencing something the user just changed
mid-conversation (without leaving the tab) may not reflect it yet — this
is a known, accepted staleness window, not a bug, but worth knowing before
"fixing" it as if it were one.

The AI **never writes data directly** — Day Log extraction only proposes
`parsedCash`/`parsedPromise`; the user explicitly confirms via
`move-to-expense`/`toggle-reminder` before anything is actually created.

---

## 10. Contact / Feedback feature

One shared backend (`services/contact.service.js`, `br-contactSubmissions`
table + `status-index` GSI, no admin UI yet but queryable),  one endpoint
(`POST /api/contact`, `optionalAuth`), used by all three surfaces. Trust
model: when logged in, `source`/`name`/`email` are derived from the
verified session server-side, never trusted from the request body.

Frontend: `ContactModal.jsx` (shared form, one consistent dark theme on
purpose even inside the light-themed dashboards — a modal is its own
layer), `ContactTrigger.jsx` (bottom-**right** floating message icon with
a "Lay a Complaint" hover tooltip on both dashboards — deliberately NOT a
nav item). Home page uses a plain footer link instead, wired through
`App.jsx`'s own modal-state pattern.

Requires `CONTACT_NOTIFICATION_EMAIL` env var (your team's inbox). Reply
happens by directly replying to the notification email (`reply_to` is set
to the submitter) — no in-app messaging system exists.

---

## 11. Conventions to follow for anything new

- **Single source of truth over duplicated constant lists.** If a value
  (currency codes, category lists, etc.) is needed in more than one file,
  it goes in `config/` and gets imported, not retyped.
- **`asyncHandler` + `ApiError.badRequest/notFound/forbidden/unauthorized(...)`**
  for every controller — never a raw `throw` or manual try/catch per route.
- **`sanitise(req.body, [...])` + `requireFields(...)`** for input
  validation — never read `req.body.x` directly in a controller.
- **Lazy/computed over cron-driven** for anything time-based (trial
  expiry, net worth snapshots) — recompute against `Date.now()` on read,
  don't rely on a background job to keep state fresh.
- **Never fabricate a number.** If something can't be honestly computed
  yet (a price with no cache, a trend with too little history), return
  `null` and let the frontend say "unavailable" — never a guessed value
  or a silent 0.
- **New feature domains get their own service file** with their own
  DynamoDB client (`personal.service.js`, `contact.service.js`,
  `marketData.service.js`) rather than growing `db.service.js` further.
- **Dashboards mirror each other's shell conventions** deliberately
  (`WealthDashboard.jsx` copies `RoadmapPage.jsx`'s patterns). If you add
  a third dashboard-like surface, follow the same shell pattern rather
  than inventing a new one.
- **Verify before shipping**: run `node --check` on every backend `.js`
  file you touch, and at minimum a brace/paren/bracket balance check on
  every `.jsx` file (real JSX parsing isn't available in this environment)
  before considering an edit done.
- **Only change what the task needs.** Don't reformat, restructure, or
  "improve" surrounding code that already works, even if you notice
  something you'd do differently — flag it instead (see §12).

---

## 12. Known issues / technical debt (flag more here as you find them)

- Duplicate dead files: `utils/auth.js`, `utils/permissions.js`,
  `controllers/team.routes.js` (see §3) — safe to delete once confirmed
  nothing references them, but confirm first.
- `utils/currency.js` (frontend) and `config/currencies.js` (backend) must
  be kept in sync by hand — no shared source, no test enforcing agreement.
- No admin UI for contact submissions yet — `status-index` GSI exists so
  one can be added without a schema change, but right now triage is
  email-only + manual DynamoDB queries.
- `personalAssets.controller.js` and `personalNetWorth.controller.js` each
  have their own currency-conversion call sites; they now both correctly
  use the shared `convertAmount`, but keep an eye out for a third place
  reimplementing this logic instead of importing it.
- Wealth advisor and Business advisor context-refresh staleness (§9) is
  accepted behavior today, not a bug — but if a future feature makes
  real-time accuracy mid-conversation more important, this is the place
  to revisit (e.g. a manual "refresh my data" action separate from
  "Clear chat").
- No automated tests exist anywhere in this repo, as far as this file's
  author has seen. All verification so far has been manual (`node
  --check`, balance checks, targeted manual testing). Worth raising with
  the project owner if a testing setup would help before the codebase
  grows further.

---

## 13. What's next

More features are coming. Before starting the next one:
- Re-read the relevant sections of this file, then the actual current
  files, not just this summary.
- Do a quick pass for anything newly broken, inconsistent, or worth
  flagging in the area you're about to touch, and say so before or while
  you work — don't wait to be asked.
- Update this file's changelog-style sections (§7, §12) with anything you
  fix or discover, so the next session doesn't have to rediscover it.
