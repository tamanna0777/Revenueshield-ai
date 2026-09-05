# RevenueShield AI

> **Autonomous Subscription Revenue Recovery Engine with Financial Policy Guardrails**

RevenueShield AI is an intelligent, policy-governed revenue recovery system engineered for Indian subscription businesses. It diagnoses payment failures, dynamically orchestrates high-leverage interventions, enforces strict financial guardrails, and provides transparent, immutable audit trails.

---

## 1. Demo Mode (Zero-Config Simulation)

RevenueShield AI is **fully functional out of the box with zero external configuration**:
- **No Razorpay Account Needed**: If credentials are not provided in the environment, the engine automatically defaults to **DEMO Mode**.
- **Deterministic Synthetic Datasets**: Generates realistic subscription universes (5,000 customers, 20,000+ payment events) using seeded pseudo-random number generators (PRNG) with strict referential integrity.
- **Fair Counterfactual Simulation**: Employs a single shared random draw per recovery case (`u ~ Uniform(0, 1)`) to evaluate baseline blind retries against AI-governed interventions, guaranteeing mathematically rigorous incremental lift attribution.
- **Interactive UI Dashboard**: Instant real-time view of recovery KPIs, failure cause distributions, prioritized action queues, and interactive controls (strategy toggles, kill switches, and sample size selectors).

---

## 2. Razorpay Test-Mode Setup

RevenueShield AI integrates seamlessly with **Razorpay Test Mode** for sandbox testing and webhook processing.

### Environment Variables

Configure the following variables in your `.env` or environment secrets:

```env
# Optional: Defaults to DEMO mode if missing
RAZORPAY_KEY_ID="rzp_test_yourKeyId"
RAZORPAY_KEY_SECRET="yourTestKeySecret"
RAZORPAY_WEBHOOK_SECRET="yourWebhookSecret"
```

> **IMPORTANT**: Never configure Live credentials (`rzp_live_*`). Live execution is intentionally hardcoded to fail safely in this build.

### Webhook Endpoint

- **Path**: `POST /api/webhooks/razorpay`
- **Supported Events**:
  - `payment.failed`: Normalized and routed through diagnosis, prioritization, policy evaluation, and audit logging.
  - `payment.captured`: Tracked for successful settlement attribution.
  - `subscription.halted`: Triggers high-urgency dunning workflow.
  - `subscription.charged`: Recorded for recurring cycle continuity.
  - `invoice.paid`: Evaluated for customer ledger reconciliation.

### Local Simulation & Testing

You can simulate signed Razorpay test webhooks without needing public webhook tunnel endpoints:
- **Local Simulation Endpoint**: `POST /api/webhooks/test-simulate`
- **Automated Test Suite**: Run `npm test` to execute all 89 unit tests across Phases 1–10.

---

## 3. Financial AI Policy Guardrails

A core architectural tenet of RevenueShield AI is that **high recovery probability does not grant unconstrained authority to charge customers or dispatch interventions**. All actions pass through the deterministic Policy Engine before execution.

```
Payment Event → Normalization → Diagnosis → Prioritization → Policy Engine → Execution/Hold → Audit Trail
```

### Key Policy Guardrails

1. **Global Kill Switch (`isKillSwitchEnabled`)**:
   - An immediate administrative emergency brake.
   - When enabled, halts all automated interventions system-wide and marks requests as `BLOCKED`.
   - Can be toggled dynamically in the UI or via `POST /api/policy/kill-switch`.

2. **Cooldown Period (`cooldownMinutes`)**:
   - Default: `60 minutes`.
   - Prevents rapid-fire repeated actions on the same customer case, protecting customer experience and preventing issuer spam flags.

3. **Maximum Automated Attempts (`maxAutomatedAttempts`)**:
   - Default: `3 attempts`.
   - Halts automated retries once the threshold is reached. Further attempts transition into `BLOCKED` or require manual operational review.

4. **Approval Threshold for High-Value Revenue (`approvalAmountThresholdInr`)**:
   - Default: `₹15,000`.
   - Enforces **Bounded Autonomy**: any transaction at risk exceeding this threshold is placed into `PENDING_APPROVAL`, even if the model predicts a 99% recovery probability.

5. **Strategy Feature Toggles**:
   - Operators can enable/disable specific intervention tactics (`allowSmartRetry`, `allowPaymentMethodUpdate`, `allowCustomerNotification`, `allowIncentiveOffer`) without redeploying code.

6. **Action Lifecycle States**:
   - `PLANNED`: Initial decision formulated.
   - `PENDING_APPROVAL`: Held by policy rules for human review.
   - `APPROVED`: Authorized by human operator.
   - `EXECUTED`: Successfully executed via test mode or dry-run.
   - `RECOVERED`: Transaction verified as successfully settled.
   - `NOT_RECOVERED`: Recovery attempt concluded unsuccessfully.
   - `BLOCKED`: Denied by policy guardrails.

---

## 4. Security Disclosures & Invariants

- **Live Mode Execution Barrier**: Live transactions are strictly prohibited. If `LIVE` mode is detected anywhere, the system fails safely with: `"Live execution is disabled in this build."`
- **Raw Request Body Webhook Verification**:
  - Webhook signatures (`X-Razorpay-Signature`) are verified against the raw, unmodified byte stream (`express.raw({ type: '*/*' })`).
  - Parsing and re-stringifying JSON prior to signature checking is strictly prevented to avoid whitespace/encoding tampering vulnerabilities.
- **Idempotency Protection**:
  - Webhooks are tracked via deterministic event identifiers (`evt_{event}_{paymentId}`).
  - Duplicate deliveries are idempotently suppressed (`200 OK`) without re-executing actions or creating duplicate ledger/audit entries.
- **Zero Secrets in Logs or Audit Records**:
  - Audit logs and diagnostic traces are guarded by `assertNoSecrets()`, which programmatically asserts that API keys, webhook secrets, and credentials can never be persisted or returned over the wire.

## 5. Hackathon Demo Features (Phase 11)

RevenueShield AI is optimized for immediate hackathon judge comprehension (the 10-second rule):

### 10-Second Executive Summary
> **"RevenueShield AI detects recurring revenue at risk, diagnoses payment failure causes, selects high-leverage interventions, applies strict financial safety guardrails, executes in a controlled test environment, and proves incremental recovered revenue via single-draw counterfactual attribution."**

### Interactive Demo Highlights in UI
1. **Interactive Demo Guide**: One-click modal accessible from the header explaining the 6-stage lifecycle, counterfactual methodology, and judge evaluation criteria.
2. **Dynamic Financial Guardrails Panel**:
   - Live Manual Approval Threshold slider (`₹500` to `₹100,000`).
   - Max Automated Attempts selector (`1` to `5`).
   - Global Execution Emergency Kill Switch toggle.
   - Strategy feature toggles (Smart Retries, Payment Method Links, Notifications).
   - Dynamic in-place re-evaluation demonstrating that **Prediction != Authorization**.
3. **Razorpay Test Webhook Simulator**:
   - Allows judges to trigger test webhook events (`payment.failed`, `subscription.halted`) with realistic bank failure codes (`BAD_REQUEST_PAYMENT_DECLINED`, `GATEWAY_ERROR`).
   - Inspects raw payload, HMAC-SHA256 signature calculation, normalization, and immediate ledger update.
4. **Zero-Secrets Audit Trail Inspector**:
   - Inspects immutable audit records for every executed decision.
   - Live security badge confirming 0 secrets, zero raw card tokens, and zero webhook secrets.
5. **Counterfactual Single-Draw Proof**:
   - Displays the exact shared uniform random draw `u ~ Uniform(0, 1)` alongside baseline vs. agent recovery thresholds, proving non-negative monotonic lift.

---

## 6. Verification & Testing

The repository features comprehensive automated test coverage across all 11 phases:

```bash
# Run the complete test suite (Phases 1 through 11 - 78 total tests)
npm test

# Typecheck and lint codebase
npm run lint

# Compile production build
npm run build
```

### Test Suite Breakdown
- `tests/phase1_phase2.test.ts`: Probability calculation, clamping, risk formulas, priority scoring (14 tests).
- `tests/phase3_phase4.test.ts`: Single-draw simulation, monotonic counterfactual proof, ledger math (11 tests).
- `tests/phase5_phase6.test.ts`: 5,000 synthetic customers, 20,000 payment events, ML model fit, ROC-AUC/PR-AUC (13 tests).
- `tests/phase7_phase8.test.ts`: Full application service, ledger reconciliation, KPI formatting, case sorting (8 tests).
- `tests/phase9_phase10.test.ts`: Razorpay test webhook signature verification, normalization, idempotency, guardrails (22 tests).
- `tests/phase11.test.ts`: Demo state reset, dynamic policy re-evaluation, simulator pipeline, zero-secrets invariants (10 tests).
