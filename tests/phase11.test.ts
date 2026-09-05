/**
 * Phase 11 Unit Test Suite
 * Final Product Polish, Hackathon Demo Controls, Dynamic Financial Guardrails,
 * Razorpay Test-Mode Verification, and Audit Integrity
 */

import assert from 'node:assert/strict';
import {
  initializeDemoData,
  runRecoverySimulation,
  reEvaluatePolicies,
  resetDemoState,
  addSimulatedCase,
  getSimulatedCases,
  DEFAULT_DEMO_SEED,
  DEFAULT_SAMPLE_SIZE,
} from '../src/services/revenueRecovery.ts';
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
  auditRecordContainsNoSecrets,
} from '../src/agents/audit.ts';
import {
  processRazorpayWebhook,
  createSignedTestWebhookPayload,
  isRazorpayConfigured,
  getRazorpayEnvironment,
} from '../src/services/razorpay.ts';
import {
  getDashboardSummary,
  getRecentExecutions,
} from '../src/services/dashboard.ts';
import { FailureCause, InterventionType, PolicyDecisionType, RecoveryCase } from '../src/types.ts';

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

console.log('\n--- Running Phase 11 Hackathon Demo & Polish Test Suite ---\n');

// Group 1: Demo State Initialization and Reset
console.log('Group 1: Demo State Management & Reset');

test('resetDemoState restores benchmark seed 2026, default policy, and resets kill switch', () => {
  // Dirty the state
  setKillSwitch(true);
  updatePolicyConfig({ manualApprovalThresholdInr: 5000, maxInterventionAttempts: 1 });

  const state = resetDemoState();
  assert.equal(state.seed, DEFAULT_DEMO_SEED);
  assert.equal(isKillSwitchEnabled(), false);

  const cfg = getPolicyConfig();
  assert.equal(cfg.manualApprovalThresholdInr, DEFAULT_POLICY_CONFIG.manualApprovalThresholdInr);
  assert.equal(cfg.maxInterventionAttempts, DEFAULT_POLICY_CONFIG.maxInterventionAttempts);
  assert.equal(cfg.killSwitchEnabled, false);

  // Check that executed cases are populated with policy decisions
  assert.ok(state.executedCases.length > 0);
  for (const c of state.executedCases) {
    assert.ok(c.policyRuleDecision !== undefined, 'Case should have policyRuleDecision');
    assert.ok(
      ['ALLOW', 'REQUIRE_APPROVAL', 'BLOCK'].includes(c.policyRuleDecision!),
      'Decision must be valid enum'
    );
  }
});

// Group 2: Financial Guardrails Dynamic Re-evaluation
console.log('\nGroup 2: Financial Guardrails & Dynamic Re-Evaluation');

test('reEvaluatePolicies updates all cases in-place when thresholds change', () => {
  resetDemoState();
  
  // Set very low manual approval threshold (e.g. ₹500)
  const updatedCases = reEvaluatePolicies({
    manualApprovalThresholdInr: 500,
    killSwitchEnabled: false,
    maxInterventionAttempts: 3,
  });
  
  const approvalCases = updatedCases.filter(
    (c) =>
      c.revenueAtRiskInr >= 500 &&
      c.optimalIntervention !== InterventionType.NO_ACTION &&
      c.optimalIntervention !== InterventionType.ESCALATION_MANUAL_REVIEW &&
      (c.attemptCount ?? 1) < 3
  );
  
  assert.ok(approvalCases.length > 0, 'Should have eligible cases >= ₹500');
  for (const c of approvalCases) {
    assert.equal(
      c.policyRuleDecision,
      'REQUIRE_APPROVAL',
      `Case with revenue ₹${c.revenueAtRiskInr} should require approval when threshold is ₹500`
    );
  }
});

test('Enabling kill switch immediately sets all cases to BLOCK policy decision', () => {
  resetDemoState();
  setKillSwitch(true);

  const updatedCases = reEvaluatePolicies();
  for (const c of updatedCases) {
    assert.equal(
      c.policyRuleDecision,
      'BLOCK',
      'When kill switch is enabled, every case must be BLOCK'
    );
    assert.ok(
      c.policyReason?.toLowerCase().includes('kill switch') ||
      c.policyDecision?.reason?.toLowerCase().includes('kill switch'),
      'Policy reason must cite kill switch'
    );
  }

  // Deactivate kill switch and confirm cases return to normal
  setKillSwitch(false);
  resetPolicyConfig();
  const restoredCases = reEvaluatePolicies();
  const allowCount = restoredCases.filter((c) => c.policyRuleDecision === 'ALLOW').length;
  assert.ok(allowCount > 0, 'Restoring kill switch should allow eligible cases');
});

test('Max attempts policy blocks smart retries exceeding limit', () => {
  resetDemoState();
  
  // Evaluate direct policy evaluation for a smart retry case exceeding attempts
  const testCase: RecoveryCase = {
    id: 'case_test_max_attempts',
    customerId: 'cust_test',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    subscriptionId: 'sub_test',
    subscriptionTier: 'STARTER',
    customerResponsePropensity: 0.5,
    revenueAtRiskInr: 1500,
    failureCause: FailureCause.BANK_TIMEOUT,
    recommendedIntervention: InterventionType.SMART_RETRY,
    optimalIntervention: InterventionType.SMART_RETRY,
    attemptCount: 3,
    recoveryProbability: 0.65,
    calculatedProbability: 0.65,
    priorityScore: 70,
    executedAt: new Date().toISOString(),
  };

  const blockedResult = evaluatePolicy({
    recoveryCase: testCase,
    config: { ...DEFAULT_POLICY_CONFIG, maxInterventionAttempts: 2, maxAutomatedAttempts: 2 },
  });

  assert.equal(blockedResult.decision, 'BLOCK');
  assert.equal(blockedResult.ruleMatched, 'MAX_ATTEMPTS_EXCEEDED');

  // Verify within simulation cohort with max attempts threshold
  const updated = reEvaluatePolicies({ maxInterventionAttempts: 1, maxAutomatedAttempts: 1 });
  const smartRetries = updated.filter(
    (c) =>
      (c.attemptCount ?? 1) >= 1 &&
      (c.recommendedIntervention === InterventionType.SMART_RETRY ||
        c.optimalIntervention === InterventionType.SMART_RETRY)
  );
  assert.ok(smartRetries.length > 0, 'Should have smart retry cases in cohort');
  for (const c of smartRetries) {
    assert.equal(c.policyRuleDecision, 'BLOCK');
  }
});

// Group 3: Razorpay Test Simulation & Normalization
console.log('\nGroup 3: Razorpay Test Simulation Pipeline');

test('processRazorpayWebhook processes test webhook and produces structured recovery result', () => {
  resetPolicyConfig();
  const signed = createSignedTestWebhookPayload({
    event: 'payment.failed',
    amountInr: 2499,
    errorCode: 'BAD_REQUEST_PAYMENT_DECLINED',
    errorDescription: 'Payment was declined by issuing bank',
  });

  const result = processRazorpayWebhook({
    rawBody: signed.rawBody,
    signature: signed.signature,
    webhookSecret: signed.secret,
    targetEnvironment: 'TEST',
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.success, true);
  assert.ok(result.recoveryCase);
  assert.equal(result.recoveryCase.revenueAtRiskInr, 2499);
  assert.ok(result.recoveryCase.agentRecovered !== undefined);
  assert.ok(result.auditRecordId);
});

test('addSimulatedCase tracks new simulated events in active state and updates dashboard', () => {
  resetDemoState();
  const initialCases = getDashboardSummary().casesProcessed;

  const mockCase: RecoveryCase = {
    id: 'case_sim_phase11_999',
    customerId: 'cust_sim_999',
    customerName: 'Simulated User',
    customerEmail: 'simulated@example.com',
    subscriptionId: 'sub_sim_999',
    subscriptionTier: 'PROFESSIONAL',
    customerResponsePropensity: 0.65,
    revenueAtRiskInr: 9999,
    failureCause: FailureCause.EXPIRED_CARD,
    recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
    optimalIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
    recoveryProbability: 0.72,
    calculatedProbability: 0.72,
    priorityScore: 85,
    attemptCount: 1,
    baselineRecovered: false,
    agentRecovered: true,
    incrementalRecoveryInr: 9999,
    policyRuleDecision: 'ALLOW',
    policyReason: 'Within financial safety bounds',
    executedAt: new Date().toISOString(),
  };

  addSimulatedCase(mockCase);

  const updatedSummary = getDashboardSummary();
  assert.equal(updatedSummary.casesProcessed, initialCases + 1);

  const simCases = getSimulatedCases();
  assert.ok(simCases.some((c) => c.id === 'case_sim_phase11_999'));
});

// Group 4: Audit Trail and Zero-Secrets Invariant
console.log('\nGroup 4: Audit Trail & Security Invariant');

test('Audit trail logs contain zero secrets (API keys, webhook secrets, card numbers)', () => {
  const trail = getAuditTrail();
  assert.ok(trail.length > 0, 'Audit trail must not be empty');

  for (const entry of trail) {
    assert.ok(
      auditRecordContainsNoSecrets(entry),
      `Audit entry ${entry.id} failed zero-secrets invariant`
    );

    // Double check specific sensitive strings
    const serialized = JSON.stringify(entry).toLowerCase();
    assert.ok(!serialized.includes('rzp_test_secret'), 'Secret leaked in audit entry');
    assert.ok(!serialized.includes('webhook_secret_key'), 'Secret leaked in audit entry');
  }
});

// Group 5: Mathematical Invariants & Monotonic Counterfactuals
console.log('\nGroup 5: Mathematical Invariants & Counterfactual Proof');

test('Every executed case adheres to single-draw monotonicity (baseline recovered => agent recovered)', () => {
  const state = resetDemoState();

  let violationCount = 0;
  for (const c of state.executedCases) {
    if (c.baselineRecovered && !c.agentRecovered) {
      violationCount++;
    }
  }

  assert.equal(violationCount, 0, 'Zero monotonicity violations allowed');
});

test('Incremental recovery is strictly non-negative for each case', () => {
  const state = resetDemoState();

  for (const c of state.executedCases) {
    assert.ok(
      c.incrementalRecoveryInr >= 0,
      `Case ${c.id} has negative incremental recovery: ${c.incrementalRecoveryInr}`
    );
  }
});

test('Dashboard total incremental recovery matches Agent minus Baseline exactly', () => {
  resetDemoState();
  const summary = getDashboardSummary();

  const diff = summary.totalAgentRecoveredInr - summary.totalBaselineRecoveredInr;
  assert.equal(
    summary.incrementalRecoveryInr,
    diff,
    'Incremental recovery must equal Total Agent Recovered - Total Baseline Recovered'
  );
});

console.log(`\n========================================`);
console.log(`Phase 11 Tests Passed: ${passed}/${total}`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
