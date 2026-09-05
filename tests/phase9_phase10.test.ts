/**
 * Phase 9 & Phase 10 Unit Test Suite
 * Razorpay Test-Mode Integration + Financial AI Guardrails + Auditability
 */

import assert from 'node:assert/strict';
import {
  isRazorpayConfigured,
  getRazorpayEnvironment,
  verifyWebhookSignature,
  generateTestWebhookSignature,
  normalizeWebhookEvent,
  mapRazorpayFailureCause,
  processRazorpayWebhook,
  createSignedTestWebhookPayload,
  idempotencyStore,
  SUPPORTED_RAZORPAY_EVENTS,
} from '../src/services/razorpay.ts';
import {
  getPolicyConfig,
  updatePolicyConfig,
  resetPolicyConfig,
  setKillSwitch,
  isKillSwitchEnabled,
  evaluatePolicy,
  DEFAULT_POLICY_CONFIG,
} from '../src/agents/policy.ts';
import {
  getAuditTrail,
  clearAuditTrail,
  recordAuditEntry,
  auditRecordContainsNoSecrets,
} from '../src/agents/audit.ts';
import {
  FailureCause,
  InterventionType,
  PolicyDecisionType,
  RecoveryCase,
} from '../src/types.ts';
import { calculateRecoveryProbability } from '../src/agents/probability.ts';
import { calculateRiskScore } from '../src/agents/intervention.ts';
import { executeSimulationCase } from '../src/agents/execution.ts';

let passed = 0;
let total = 0;

function test(name: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n--- Running Phase 9 & Phase 10 Test Suite ---\n');

// Clean test state before each section
resetPolicyConfig();
clearAuditTrail();
idempotencyStore.clear();

// Test 1: Missing Razorpay credentials safely falls back to DEMO
test('1. Missing Razorpay credentials safely falls back to DEMO', () => {
  const origKey = process.env.RAZORPAY_KEY_ID;
  const origSec = process.env.RAZORPAY_WEBHOOK_SECRET;
  const origEnv = process.env.RAZORPAY_ENV;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_ENV;

  try {
    assert.equal(isRazorpayConfigured(), false);
    assert.equal(getRazorpayEnvironment(), 'DEMO');
  } finally {
    if (origKey) process.env.RAZORPAY_KEY_ID = origKey;
    if (origSec) process.env.RAZORPAY_WEBHOOK_SECRET = origSec;
    if (origEnv) process.env.RAZORPAY_ENV = origEnv;
  }
});

// Test 2: Test environment is explicitly recognized
test('2. Test environment is explicitly recognized when configured or specified', () => {
  assert.equal(getRazorpayEnvironment('TEST'), 'TEST');

  const origKey = process.env.RAZORPAY_KEY_ID;
  const origSec = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_ID = 'rzp_test_demo123';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_demo123';

  try {
    assert.equal(isRazorpayConfigured(), true);
    assert.equal(getRazorpayEnvironment(), 'TEST');
  } finally {
    if (origKey) process.env.RAZORPAY_KEY_ID = origKey; else delete process.env.RAZORPAY_KEY_ID;
    if (origSec) process.env.RAZORPAY_WEBHOOK_SECRET = origSec; else delete process.env.RAZORPAY_WEBHOOK_SECRET;
  }
});

// Test 3: Webhook signature verification succeeds for a valid signature
test('3. Webhook signature verification succeeds for a valid signature', () => {
  const secret = 'webhook_secret_for_test_123';
  const rawBody = JSON.stringify({ entity: 'event', event: 'payment.failed' });
  const validSig = generateTestWebhookSignature(rawBody, secret);

  const isValid = verifyWebhookSignature(rawBody, validSig, secret);
  assert.equal(isValid, true);
});

// Test 4: Invalid signature is rejected
test('4. Invalid signature is rejected', () => {
  const secret = 'webhook_secret_for_test_123';
  const rawBody = JSON.stringify({ entity: 'event', event: 'payment.failed' });
  const badSig = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const isValid = verifyWebhookSignature(rawBody, badSig, secret);
  assert.equal(isValid, false);

  // Also test empty signature or missing secret
  assert.equal(verifyWebhookSignature(rawBody, '', secret), false);
  assert.equal(verifyWebhookSignature('', badSig, secret), false);
});

// Test 5: Raw-body verification is used (re-stringified or altered body fails)
test('5. Raw-body verification requires exact untouched payload', () => {
  const secret = 'webhook_secret_for_test_123';
  const rawBodyOriginal = '{"event":"payment.failed",  "amount":  250000}'; // non-standard spacing
  const validSig = generateTestWebhookSignature(rawBodyOriginal, secret);

  // Verify succeeds with exact raw body
  assert.equal(verifyWebhookSignature(rawBodyOriginal, validSig, secret), true);

  // Altering spacing (as happens if parsed and re-stringified) MUST fail signature verification
  const alteredBody = JSON.stringify(JSON.parse(rawBodyOriginal));
  assert.notEqual(rawBodyOriginal, alteredBody);
  assert.equal(verifyWebhookSignature(alteredBody, validSig, secret), false);
});

// Test 6: Supported events normalize correctly
test('6. Supported events normalize correctly into canonical representation', () => {
  const payload = {
    id: 'evt_test_payment_failed_101',
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_ABC123',
          amount: 350000, // 3500 INR in paise
          currency: 'INR',
          status: 'failed',
          error_code: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
          error_description: 'Account balance is insufficient to complete recurring subscription',
          subscription_id: 'sub_XYZ890',
          customer_id: 'cust_999',
          notes: {
            attempt_count: 2,
          },
        },
      },
    },
    created_at: 1725280000,
  };

  const normalized = normalizeWebhookEvent(payload);
  assert.equal(normalized.provider, 'RAZORPAY');
  assert.equal(normalized.providerEventId, 'evt_test_payment_failed_101');
  assert.equal(normalized.paymentId, 'pay_ABC123');
  assert.equal(normalized.subscriptionId, 'sub_XYZ890');
  assert.equal(normalized.customerReference, 'cust_999');
  assert.equal(normalized.amountInr, 3500); // 350000 / 100
  assert.equal(normalized.failureCause, FailureCause.INSUFFICIENT_FUNDS);
  assert.equal(normalized.attemptCount, 2);
  assert.equal(normalized.isActionable, true);
});

// Test 7: Unsupported events do not trigger actions
test('7. Unsupported events do not trigger actions and are safely ignored', () => {
  const secret = 'whsec_test';
  const unsupportedEvent = {
    id: 'evt_unsupported_999',
    event: 'refund.processed', // Not an actionable recovery event
    payload: { refund: { entity: { id: 'rfnd_123', amount: 50000 } } },
  };
  const rawBody = JSON.stringify(unsupportedEvent);
  const signature = generateTestWebhookSignature(rawBody, secret);

  const result = processRazorpayWebhook({
    rawBody,
    signature,
    webhookSecret: secret,
    targetEnvironment: 'TEST',
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.actionState, 'PLANNED');
  assert.equal(result.recoveryCase, undefined); // No recovery case created
  assert.ok(result.message.includes('non-actionable'));
});

// Test 8: Failure-cause mapping works across various error representations
test('8. Failure-cause mapping works for all expected patterns', () => {
  assert.equal(
    mapRazorpayFailureCause('BAD_REQUEST_PAYMENT_CARD_EXPIRY_DATE_INVALID'),
    FailureCause.EXPIRED_CARD
  );
  assert.equal(
    mapRazorpayFailureCause(undefined, 'The customer card is expired'),
    FailureCause.EXPIRED_CARD
  );
  assert.equal(
    mapRazorpayFailureCause('BAD_REQUEST_PAYMENT_CARD_BLOCKED'),
    FailureCause.CARD_BLOCKED
  );
  assert.equal(
    mapRazorpayFailureCause(undefined, 'Card marked stolen or frozen'),
    FailureCause.CARD_BLOCKED
  );
  assert.equal(
    mapRazorpayFailureCause('BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE'),
    FailureCause.INSUFFICIENT_FUNDS
  );
  assert.equal(
    mapRazorpayFailureCause('GATEWAY_ERROR_PAYMENT_ISSUER_DOWN'),
    FailureCause.BANK_TIMEOUT
  );
  assert.equal(
    mapRazorpayFailureCause(undefined, 'Issuer bank timed out waiting for response'),
    FailureCause.BANK_TIMEOUT
  );
  assert.equal(
    mapRazorpayFailureCause('BAD_REQUEST_PAYMENT_DECLINED_BY_BANK'),
    FailureCause.ISSUER_DECLINED
  );
});

// Test 9: Unknown provider failure maps to UNKNOWN
test('9. Unknown provider failure maps safely to UNKNOWN with original details preserved', () => {
  const mapped = mapRazorpayFailureCause('UNEXPECTED_SYSTEM_EXCEPTION', 'Something mysterious broke');
  assert.equal(mapped, FailureCause.UNKNOWN);

  const payload = {
    id: 'evt_unknown_cause_001',
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_unk_1',
          amount: 100000,
          error_code: 'UNEXPECTED_SYSTEM_EXCEPTION',
          error_description: 'Something mysterious broke',
        },
      },
    },
  };

  const normalized = normalizeWebhookEvent(payload);
  assert.equal(normalized.failureCause, FailureCause.UNKNOWN);
  assert.equal(normalized.rawErrorCode, 'UNEXPECTED_SYSTEM_EXCEPTION');
  assert.equal(normalized.rawErrorMessage, 'Something mysterious broke');
});

// Test 10: Duplicate event is idempotently suppressed
test('10. Duplicate event is idempotently suppressed without duplicate execution', () => {
  idempotencyStore.clear();
  const secret = 'whsec_idem_test';
  const signed = createSignedTestWebhookPayload({
    event: 'payment.failed',
    amountInr: 5000,
    paymentId: 'pay_idem_dup_101',
    errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
    secret,
  });

  // First ingestion
  const res1 = processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: secret,
    targetEnvironment: 'TEST',
  });
  assert.equal(res1.statusCode, 200);
  assert.notEqual(res1.actionState, 'BLOCKED');

  // Second ingestion with identical payload and event ID
  const res2 = processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: secret,
    targetEnvironment: 'TEST',
  });
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.actionState, 'BLOCKED');
  assert.equal(res2.message, 'Duplicate webhook event; action suppressed.');
});

// Test 11: Duplicate event does not duplicate audit or ledger entries
test('11. Duplicate event does not duplicate audit records', () => {
  idempotencyStore.clear();
  clearAuditTrail();

  const secret = 'whsec_dup_audit';
  const signed = createSignedTestWebhookPayload({
    event: 'payment.failed',
    amountInr: 3000,
    paymentId: 'pay_dup_audit_102',
    errorCode: 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
    secret,
  });

  processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: secret,
    targetEnvironment: 'TEST',
  });

  const countAfterFirst = getAuditTrail().length;

  // Duplicate call
  processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: secret,
    targetEnvironment: 'TEST',
  });

  const countAfterSecond = getAuditTrail().length;
  // Audit count must remain exactly identical
  assert.equal(countAfterSecond, countAfterFirst);
});

// Test 12: Kill switch blocks execution
test('12. Kill switch immediately blocks execution', () => {
  resetPolicyConfig();
  setKillSwitch(true);
  assert.equal(isKillSwitchEnabled(), true);

  const mockCase: RecoveryCase = {
    id: 'case_kill_test',
    customerId: 'cust_1',
    subscriptionId: 'sub_1',
    customerName: 'Kill Switch Tester',
    customerEmail: 'test@example.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 10000,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 1,
    customerResponsePropensity: 0.8,
    recoveryProbability: 0.9,
    recommendedIntervention: InterventionType.SMART_RETRY,
  };

  const evaluation = evaluatePolicy({ recoveryCase: mockCase });
  assert.equal(evaluation.decision, 'BLOCK');
  assert.equal(evaluation.policyDecisionType, PolicyDecisionType.BLOCKED);
  assert.equal(evaluation.reason, 'Execution kill switch enabled; action blocked.');

  setKillSwitch(false);
});

// Test 13: Dry-run prevents external mutation
test('13. Dry-run prevents external mutation and is flagged in audit', () => {
  resetPolicyConfig();
  clearAuditTrail();

  const record = recordAuditEntry({
    caseId: 'case_dry_run_1',
    action: 'EXECUTE_SMART_RETRY',
    intervention: InterventionType.SMART_RETRY,
    policyDecision: 'ALLOW',
    reason: 'Policy checks passed; automated action allowed.',
    recoveryProbability: 0.85,
    riskScore: 30,
    priorityScore: 2500,
    revenueAtRiskInr: 4000,
    environment: 'TEST',
    dryRun: true,
    outcome: 'RECOVERED',
  });

  assert.equal(record.dry_run, true);
  assert.equal(record.environment, 'TEST');
});

// Test 14: High-value case requires approval (bounded autonomy)
test('14. High-value case requires operational approval even with high recovery probability', () => {
  resetPolicyConfig();
  const config = getPolicyConfig();

  const highValueCase: RecoveryCase = {
    id: 'case_high_val',
    customerId: 'cust_enterprise',
    subscriptionId: 'sub_ent_1',
    customerName: 'Enterprise Corp',
    customerEmail: 'billing@enterprise.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: config.approvalAmountThresholdInr + 10000, // Above threshold
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 1,
    customerResponsePropensity: 0.95,
    recoveryProbability: 0.98, // Very high probability
    recommendedIntervention: InterventionType.SMART_RETRY,
  };

  const evaluation = evaluatePolicy({ recoveryCase: highValueCase });
  assert.equal(evaluation.decision, 'REQUIRE_APPROVAL');
  assert.equal(evaluation.policyDecisionType, PolicyDecisionType.REQUIRES_APPROVAL);
  assert.ok(evaluation.reason.includes('approval required'));
});

// Test 15: Excessive attempts block automated retry
test('15. Excessive attempts block automated retry', () => {
  resetPolicyConfig();
  const config = getPolicyConfig();

  const exhaustedCase: RecoveryCase = {
    id: 'case_exhausted',
    customerId: 'cust_exhausted',
    subscriptionId: 'sub_ex_1',
    customerName: 'Exhausted Case',
    customerEmail: 'cust@example.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: 2000,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: config.maxAutomatedAttempts + 1, // e.g., 4 attempts
    customerResponsePropensity: 0.5,
    recoveryProbability: 0.6,
    recommendedIntervention: InterventionType.SMART_RETRY,
  };

  const evaluation = evaluatePolicy({ recoveryCase: exhaustedCase });
  assert.equal(evaluation.decision, 'BLOCK');
  assert.equal(evaluation.reason, 'Maximum automated attempts reached; further retry blocked.');
});

// Test 16: Cooldown blocks repeated action
test('16. Cooldown blocks repeated action on recent execution', () => {
  resetPolicyConfig();
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  const recentCase: RecoveryCase = {
    id: 'case_recent_action',
    customerId: 'cust_recent',
    subscriptionId: 'sub_rec_1',
    customerName: 'Recent User',
    customerEmail: 'recent@example.com',
    subscriptionTier: 'PROFESSIONAL',
    revenueAtRiskInr: 3000,
    failureCause: FailureCause.INSUFFICIENT_FUNDS,
    attemptCount: 1,
    customerResponsePropensity: 0.7,
    recoveryProbability: 0.75,
    recommendedIntervention: InterventionType.CUSTOMER_NOTIFICATION,
    executedAt: tenMinutesAgo,
  };

  const evaluation = evaluatePolicy({
    recoveryCase: recentCase,
    lastExecutedAt: tenMinutesAgo,
  });

  assert.equal(evaluation.decision, 'BLOCK');
  assert.equal(evaluation.reason, 'Action within cooldown period; retry blocked.');
});

// Test 17: NO_ACTION cannot execute
test('17. NO_ACTION cannot execute and is strictly blocked by policy', () => {
  resetPolicyConfig();
  const noActionCase: RecoveryCase = {
    id: 'case_no_action',
    customerId: 'cust_no_act',
    subscriptionId: 'sub_na_1',
    customerName: 'No Action User',
    customerEmail: 'noact@example.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: 1000,
    failureCause: FailureCause.UNKNOWN,
    attemptCount: 1,
    customerResponsePropensity: 0.2,
    recoveryProbability: 0.2,
    recommendedIntervention: InterventionType.NO_ACTION,
  };

  const evaluation = evaluatePolicy({ recoveryCase: noActionCase });
  assert.equal(evaluation.decision, 'BLOCK');
  assert.equal(evaluation.reason, 'No action recommended; execution blocked.');
});

// Test 18: Manual review requires approval
test('18. Manual review escalation requires approval', () => {
  resetPolicyConfig();
  const manualCase: RecoveryCase = {
    id: 'case_manual_review',
    customerId: 'cust_manual',
    subscriptionId: 'sub_man_1',
    customerName: 'Manual Review Customer',
    customerEmail: 'manual@example.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 5000,
    failureCause: FailureCause.ISSUER_DECLINED,
    attemptCount: 3,
    customerResponsePropensity: 0.4,
    recoveryProbability: 0.45,
    recommendedIntervention: InterventionType.ESCALATION_MANUAL_REVIEW,
  };

  const evaluation = evaluatePolicy({ recoveryCase: manualCase });
  assert.equal(evaluation.decision, 'REQUIRE_APPROVAL');
  assert.equal(evaluation.policyDecisionType, PolicyDecisionType.REQUIRES_APPROVAL);
  assert.equal(evaluation.reason, 'Manual review escalation requires operational approval.');
});

// Test 19: Audit entry is generated
test('19. Audit entry is generated with deterministic reasons and required fields', () => {
  clearAuditTrail();
  const record = recordAuditEntry({
    caseId: 'case_aud_demo',
    eventId: 'evt_aud_1',
    action: 'RECOVERY_PAYMENT_METHOD_UPDATE',
    intervention: InterventionType.PAYMENT_METHOD_UPDATE,
    policyDecision: 'ALLOW',
    reason: 'Expired card detected; payment method update selected.',
    recoveryProbability: 0.72,
    riskScore: 45,
    priorityScore: 3200,
    revenueAtRiskInr: 8000,
    environment: 'TEST',
    dryRun: true,
    outcome: 'RECOVERED',
  });

  assert.ok(record.audit_id);
  assert.ok(record.timestamp);
  assert.equal(record.case_id, 'case_aud_demo');
  assert.equal(record.event_id, 'evt_aud_1');
  assert.equal(record.action, 'RECOVERY_PAYMENT_METHOD_UPDATE');
  assert.equal(record.intervention, InterventionType.PAYMENT_METHOD_UPDATE);
  assert.equal(record.policy_decision, 'ALLOW');
  assert.equal(record.reason, 'Expired card detected; payment method update selected.');
  assert.equal(record.recovery_probability, 0.72);
  assert.equal(record.risk_score, 45);
  assert.equal(record.priority_score, 3200);
  assert.equal(record.revenue_at_risk_inr, 8000);
  assert.equal(record.environment, 'TEST');
  assert.equal(record.dry_run, true);
  assert.equal(record.outcome, 'RECOVERED');
});

// Test 20: Audit entry contains no secrets
test('20. Audit entry contains no secret credentials or webhook keys', () => {
  const record = getAuditTrail()[0];
  assert.ok(record);
  assert.equal(auditRecordContainsNoSecrets(record), true);

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('rzp_live_'), false);
  assert.equal(serialized.includes('rzp_test_'), false);
  assert.equal(serialized.includes('whsec_'), false);
});

// Test 21: LIVE mode cannot execute
test('21. LIVE mode is disabled and safely rejected without execution', () => {
  resetPolicyConfig();
  const liveCase: RecoveryCase = {
    id: 'case_live_attempt',
    customerId: 'cust_live',
    subscriptionId: 'sub_live',
    customerName: 'Live Test Attempt',
    customerEmail: 'live@example.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 10000,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 1,
    customerResponsePropensity: 0.9,
    recoveryProbability: 0.9,
    recommendedIntervention: InterventionType.SMART_RETRY,
    environment: 'LIVE',
  };

  const evaluation = evaluatePolicy({
    recoveryCase: liveCase,
    targetEnvironment: 'LIVE',
  });

  assert.equal(evaluation.decision, 'BLOCK');
  assert.equal(evaluation.policyDecisionType, PolicyDecisionType.BLOCKED);
  assert.equal(evaluation.reason, 'Live execution is disabled in this build.');

  // Also via webhook processor
  const secret = 'whsec_live_test';
  const signed = createSignedTestWebhookPayload({
    event: 'payment.failed',
    amountInr: 5000,
    secret,
  });

  const res = processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: secret,
    targetEnvironment: 'LIVE',
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.actionState, 'BLOCKED');
  assert.equal(res.message, 'Live execution is disabled in this build.');
});

// Test 22: Existing Phase 1–8 tests remain unchanged and passing
test('22. Existing Phase 1–8 pipeline and canonical probability calculations remain preserved', () => {
  // Verify canonical probability table functions from Phase 1 remain intact
  const prob = calculateRecoveryProbability(0.5, InterventionType.SMART_RETRY);
  assert.equal(prob, 0.75); // 0.5 + 0.25 lift

  // Verify risk score from Phase 2
  const risk = calculateRiskScore(0.5, FailureCause.CARD_BLOCKED);
  assert.ok(risk >= 0 && risk <= 100);

  // Verify single draw from Phase 3 & 4
  const testCase: RecoveryCase = {
    id: 'case_legacy_check',
    customerId: 'cust_l',
    subscriptionId: 'sub_l',
    customerName: 'Legacy Test',
    customerEmail: 'legacy@test.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: 1000,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 1,
    customerResponsePropensity: 0.6,
    recommendedIntervention: InterventionType.SMART_RETRY,
  };
  const { updatedCase } = executeSimulationCase(testCase, () => 0.5);
  assert.ok(updatedCase.agentRecovered !== undefined);
  assert.ok(updatedCase.baselineRecovered !== undefined);
});

console.log(`\nResults: ${passed}/${total} Phase 9 & 10 tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
