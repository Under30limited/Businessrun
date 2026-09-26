/**
 * PrivacyPolicyModal.jsx
 *
 * Displays the full BusinessRun Privacy Policy in a modal.
 * Used by GrowYourBusinessModal and PersonalWealthModal at signup.
 */

import React from 'react';
import { X, Shield, Mail, ExternalLink } from 'lucide-react';

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Shield size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900">
                Privacy Policy
              </h2>
              <p className="text-xs text-zinc-500">Effective Date: September 20, 2026</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 rounded-xl transition"
          >
            <X size={20} className="text-zinc-600" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 text-sm text-zinc-700 leading-relaxed space-y-6">
          {/* Entity Info */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1">
            <p><strong>Entity:</strong> Businessrun Nig Ltd ("BusinessRun", "we", "us", or "our")</p>
            <p><strong>Corporate Registration:</strong> Registered under the Companies and Allied Matters Act (CAMA) of Nigeria</p>
            <p className="flex items-center gap-2">
              <Mail size={14} className="text-zinc-400" />
              <strong>General Inquiries:</strong> contact@thebusinessrun.com
            </p>
            <p className="flex items-center gap-2">
              <Shield size={14} className="text-zinc-400" />
              <strong>Data Protection & Compliance:</strong> maxwell@thebusinessrun.com
            </p>
          </div>

          {/* Section 1 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">1. Introduction & Scope</h3>
            <p>
              Businessrun Nig Ltd provides an automated financial operating system, digital daybook,
              and business intelligence platform for enterprises, merchants, and independent operators.
              Our services operate across web workspaces and conversational communication channels
              (including interactive messaging integrations).
            </p>
            <p className="mt-2">
              This Privacy Policy governs how BusinessRun collects, processes, stores, and protects
              your personal information in strict compliance with the <strong>Nigeria Data Protection Act
              (NDPA) 2023</strong> and guidelines established by the Nigeria Data Protection Commission (NDPC).
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">2. Categories of Personal Data Collected</h3>
            <p className="mb-2">We collect personal data on a progressive basis, requesting information strictly as required by the features you activate:</p>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>
                <strong>Basic Identity & Profile Data:</strong> Full legal name, date of birth, business trade name,
                operating address, and general contact details.
              </li>
              <li>
                <strong>Contact & Channel Identifiers:</strong> Telephone and mobile numbers (including registered
                conversational messaging numbers) and business/personal email addresses.
              </li>
              <li>
                <strong>Identity Verification & KYC Records (As Activated):</strong> Where you opt to unlock advanced
                payment, collection, or regulated financial capabilities, we may collect government-issued identity
                cards (e.g., National Identity Card, Driver's License, Voter's Card, or International Passport),
                along with statutory identifiers including the National Identification Number (NIN) and Bank
                Verification Number (BVN). These identifiers are used solely for biometric and statutory Customer
                Due Diligence (CDD) in accordance with applicable financial and anti-money laundering regulations.
              </li>
              <li>
                <strong>Financial & Operational Records:</strong> Virtual collection account numbers (NUBANs),
                settlement logs, sales invoices, ledger inputs, payment receipts, and parsed transaction alerts
                forwarded via email or conversational channels.
              </li>
              <li>
                <strong>Conversational & System Data:</strong> Inbound chat requests, transaction confirmation prompts,
                IP addresses, device identifiers, and technical logs.
              </li>
            </ol>
          </section>

          {/* Section 3 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">3. Lawful Basis for Processing</h3>
            <p className="mb-2">Pursuant to Section 25 of the NDPA 2023, personal data is processed under the following lawful grounds:</p>
            <ul className="space-y-2 pl-2">
              <li>
                <strong>Contractual Necessity:</strong> To configure your account, maintain automated bookkeeping
                ledgers, reconcile invoices, and provide conversational financial intelligence.
              </li>
              <li>
                <strong>Legal Obligation:</strong> To satisfy statutory anti-money laundering (AML), combating the
                financing of terrorism (CFT), and Know Your Customer (KYC) identity verification requirements where
                regulated transaction rails are utilized.
              </li>
              <li>
                <strong>Consent:</strong> Where you expressly opt into third-party account syncing, conversational
                bot interactions, or forwarding transaction receipts.
              </li>
              <li>
                <strong>Legitimate Interest:</strong> To maintain system uptime, detect fraudulent activity, and
                ensure platform infrastructure integrity.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">4. Third-Party Disclosures & Regulated Rails</h3>
            <p className="mb-2">
              BusinessRun does not sell, lease, or commercialize personal data. We disclose specific operational
              data strictly under written Data Processing Agreements (DPAs) to authorized entities:
            </p>
            <ul className="space-y-2 pl-2">
              <li>
                <strong>Licensed Financial Institutions & Settlement Partners:</strong> Where virtual account issuance,
                inbound collections, or outbound transfers are enabled, customer data is securely exchanged with our
                designated, licensed commercial banking and Payment Service Provider (PSP) partner(s) to process transactions.
              </li>
              <li>
                <strong>Licensed Identity Verification Providers:</strong> Accredited identity management intermediaries
                authorized to cross-check NIN and BVN records against official statutory databases (NIMC and NIBSS).
              </li>
              <li>
                <strong>Communication & Delivery Networks:</strong> Telecommunications partners, conversational messaging
                APIs (including the WhatsApp Business Platform by Meta Platforms Inc.), and secure email delivery services
                for transmitting operational alerts.
              </li>
              <li>
                <strong>Cloud Infrastructure & Hosting:</strong> Enterprise cloud hosting providers (Amazon Web Services
                and Cloudflare) maintaining end-to-end encrypted databases and compute layers.
              </li>
              <li>
                <strong>Regulatory & Statutory Authorities:</strong> Competent government institutions, judicial bodies,
                and law enforcement agencies (such as the NDPC, Central Bank of Nigeria, or NFIU) where mandated by law.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">5. Cross-Border Data Transfers</h3>
            <p className="mb-2">
              Where system operations utilize distributed cloud infrastructure hosted outside Nigeria
              (such as secure AWS facilities), transfers comply with Section 43 of the NDPA 2023. We ensure:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>
                All international data storage environments enforce security standards comparable to the NDPA,
                supported by standard contractual clauses (SCCs).
              </li>
              <li>
                Personal data remains strongly encrypted in transit (TLS 1.3) and at rest (AES-256).
              </li>
            </ol>
          </section>

          {/* Section 6 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">6. Security Architecture & Safeguards</h3>
            <p className="mb-2">BusinessRun applies comprehensive technical and administrative measures to protect personal data:</p>
            <ul className="space-y-1 pl-2">
              <li>
                <strong>Tokenization & Vaulting:</strong> Sensitive identifiers (including BVN, NIN, and identity card scans)
                are stored in restricted access vaults and isolated from day-to-day administrative tools.
              </li>
              <li>
                <strong>Data Minimization:</strong> We only collect documentation necessary for the specific service
                tiers you elect to use.
              </li>
              <li>
                <strong>Access Control:</strong> System-level access is restricted using multi-factor authentication (MFA)
                and strict role-based access controls (RBAC).
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">7. Data Retention Guidelines</h3>
            <p className="mb-2">Personal information is retained only as long as necessary to provide active platform services:</p>
            <ul className="space-y-1 pl-2">
              <li>
                <strong>Statutory KYC & Financial Transaction Data:</strong> Retained for a minimum statutory period of
                five (5) years following account closure to comply with Nigerian anti-money laundering rules.
              </li>
              <li>
                <strong>Conversational Logs & Analytical History:</strong> Maintained during account operation and deleted
                or anonymized within 90 days of an account closure request, barring statutory retention obligations.
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">8. Your Data Subject Rights</h3>
            <p className="mb-2">Under Sections 34–38 of the NDPA 2023, data subjects possess the following enforceable rights:</p>
            <ul className="space-y-1 pl-2">
              <li><strong>Right of Access:</strong> Request confirmation and copies of personal data maintained on the platform.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate, incomplete, or out-of-date records.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of personal records where there is no persisting statutory or regulatory retention mandate.</li>
              <li><strong>Right to Restrict Processing:</strong> Object to automated marketing notices or specific analytical processing.</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, standard machine-readable format.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact the Data Protection Desk at{' '}
              <a href="mailto:maxwell@thebusinessrun.com" className="text-amber-600 hover:underline">
                maxwell@thebusinessrun.com
              </a>.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h3 className="font-bold text-zinc-900 mb-2">9. Compliance Desk & Regulatory Inquiries</h3>
            <p className="mb-2">Businessrun Nig Ltd maintains a designated internal compliance desk responsible for adherence to the NDPA:</p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1">
              <p><strong>Entity:</strong> Businessrun Nig Ltd</p>
              <p><strong>Responsible Desk:</strong> Compliance & Data Protection Desk</p>
              <p><strong>Contact Officer:</strong> Maxwell Njarika (Director / Compliance Lead)</p>
              <p><strong>Direct Compliance Email:</strong> maxwell@thebusinessrun.com</p>
              <p><strong>General Inquiries:</strong> contact@thebusinessrun.com</p>
            </div>
            <p className="mt-3 flex items-center gap-2">
              <ExternalLink size={14} className="text-zinc-400" />
              <strong>Supervisory Authority:</strong> You also maintain the right to lodge a complaint directly with the{' '}
              <a
                href="https://services.ndpc.gov.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:underline"
              >
                Nigeria Data Protection Commission (NDPC)
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50">
          <button
            onClick={onClose}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
