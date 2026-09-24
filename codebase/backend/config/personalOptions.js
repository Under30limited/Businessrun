/**
 * config/personalOptions.js
 *
 * Every fixed choice-list used across the Personal Wealth OS module —
 * onboarding questions, account/asset/expense/income/goal/debt
 * categories. Centralized here (not scattered across controllers or,
 * worse, duplicated in the frontend) so the onboarding wizard, every
 * personal-finance controller's validation, and any future edit form
 * all agree on the exact same set of values — the same principle
 * config/plans.js already follows for billing.
 *
 * NONE of this overlaps with or reads from config/plans.js — Personal
 * Wealth OS has no billing/plan-gating for now (see PROMO-less,
 * plan-less design: every personal space just works, no
 * requireFeature/requirePlan check anywhere in this module).
 */

'use strict';

const { CURRENCIES, CURRENCY_SYMBOLS } = require('./currencies');

// The currency a fresh personal space displays in until the person
// changes it — chosen at Step 1 of onboarding (see
// personalOnboarding.controller.js) and changeable at any time
// afterward via PATCH /api/personal/profile
// (personalProfile.controller.js). NGN because that's this app's
// primary market; every other currency in config/currencies.js is
// equally selectable, this is only the pre-filled default.
const DEFAULT_DISPLAY_CURRENCY = 'NGN';

// ── Onboarding: Step 1 — The Basics ─────────────────────────────────
// Country is intentionally free-text (validated as non-empty only,
// not a fixed enum) — a hardcoded country list is easy to get subtly
// wrong (naming, missing territories) and isn't worth the fragility
// for a single profile field. Revisit with a proper i18n country list
// if the product needs stricter validation later.

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

// ── Onboarding: Step 2 — Financial Profile ──────────────────────────
const PRIMARY_INCOME_SOURCES = [
  'Salary / 9-to-5 Job',
  'Business Owner / Founder',
  'Freelance / Creator',
  'Investments & Multiple Streams',
];

const ASSET_LOCATIONS = [
  'Local Naira Bank Accounts',
  'USD / FX Domiciliary Accounts',
  'Real Estate & Fixed Assets',
  'Crypto & Foreign Stocks',
  'Mutual Funds / Treasury Bills',
];

const MONTHLY_INCOME_BRACKETS = [
  'Under ₦200k',
  '₦200k – ₦2M',
  '₦2M – ₦10M',
  'Over ₦10M',
];

const FINANCIAL_HEADACHES = [
  'Tracking Daily Leakages & Spending',
  'Separating Personal Money from Business Capital',
  'Hedging Against Inflation & Devaluation (FX)',
  'Building a Consistent Emergency / Investment Fund',
  'No Savings',
];

// ── Currency ─────────────────────────────────────────────────────
// CURRENCIES itself is imported (not redeclared) from ./currencies —
// see this file's header. Every one of the 13 codes there is a valid
// record currency and a valid display currency.

// ── Accounts ─────────────────────────────────────────────────────
const ACCOUNT_TYPES = ['bank', 'fintech', 'domiciliary', 'investment', 'crypto'];

// ── Income ───────────────────────────────────────────────────────
const INCOME_STREAM_TYPES = [
  'Salary / Founder Drawing',
  'Consulting / Retainer',
  'Business Dividend / Profit Share',
  'Asset Yield / Rental Income',
  'One-Off Deal / Project Fee',
  'Investment Return',
  'Gift / Transfer Inflow',
];

const INCOME_FREQUENCIES = ['Monthly Recurring', 'Weekly', 'One-Time Windfall'];

// ── Expenses ─────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'Housing & Utilities',
  'Food & Groceries',
  'Transport & Logistics',
  'Family Support & Black Tax',
  'Subscriptions & Tech',
  'Health & Wellness',
  'Entertainment & Lifestyle',
  'Business Expense (Paid Personally)',
];

const REIMBURSEMENT_STATUSES = ['pending', 'reimbursed', 'none'];

// Used only for the Cash Flow screen's "discretionary burn" vs
// "essential spend" split — Business Expense (Paid Personally) is
// deliberately in neither bucket (it's a reimbursement-tracking
// category, not a lifestyle-spend signal either way).
const DISCRETIONARY_EXPENSE_CATEGORIES = ['Entertainment & Lifestyle', 'Subscriptions & Tech'];

// ── Assets ───────────────────────────────────────────────────────
const ASSET_CATEGORIES = [
  'Electronics & Gadgets',
  'Vehicles',
  'Real Estate & Land',
  'Cash & Bank Vaults',
  'FX & Domiciliary',
  'Crypto & Equities',
];

// Only this category gets live price lookups (services/marketData.
// service.js) — everything else is a manual-value asset. Mutual
// funds/treasury bills are deliberately NOT market-tracked (see the
// build discussion): no standard public API quotes them reliably,
// each Nigerian asset manager prices its own funds independently.
const MARKET_TRACKED_ASSET_CATEGORIES = ['Crypto & Equities'];

const LIQUIDITY_LEVELS = ['instant', 'short_term', 'long_term'];

// ── Goals ────────────────────────────────────────────────────────
const GOAL_CATEGORIES = [
  'Emergency Reserve',
  'Travel & Lifestyle',
  'Asset / Real Estate',
  'Debt Elimination',
];

// ── Debts & IOUs ─────────────────────────────────────────────────
// Deliberately ONE entity for both directions and both formal/informal
// debt — see the build discussion for why this replaced a separate
// "Liabilities" concept: `purpose` is free text, so a bank loan and a
// verbal IOU to a cousin are both just a DebtRecord with a different
// `type`.
const DEBT_TYPES = ['i_owe', 'owed_to_me'];

module.exports = {
  GENDER_OPTIONS,
  PRIMARY_INCOME_SOURCES,
  ASSET_LOCATIONS,
  MONTHLY_INCOME_BRACKETS,
  FINANCIAL_HEADACHES,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  DEFAULT_DISPLAY_CURRENCY,
  ACCOUNT_TYPES,
  INCOME_STREAM_TYPES,
  INCOME_FREQUENCIES,
  EXPENSE_CATEGORIES,
  REIMBURSEMENT_STATUSES,
  DISCRETIONARY_EXPENSE_CATEGORIES,
  ASSET_CATEGORIES,
  MARKET_TRACKED_ASSET_CATEGORIES,
  LIQUIDITY_LEVELS,
  GOAL_CATEGORIES,
  DEBT_TYPES,
};
