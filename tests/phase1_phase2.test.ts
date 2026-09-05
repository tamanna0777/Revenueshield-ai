/**
 * Phase 1 & Phase 2 Unit Tests
 * RevenueShield AI
 */

import assert from 'node:assert/strict';
import { FailureCause, InterventionType, RecoveryCase } from '../src/types.ts';
import {
  calculateRecoveryProbability,
  clampProbability,
  GENERIC_RETRY_LIFT,
  INTERVENTION_EFFECTIVENESS_LIFTS,
} from '../src/agents/probability.ts';
import {
  calculatePriorityScore,
  calculateRiskScore,
  calculateUrgencyWeight,
  CAUSE_MULTIPLIERS,
  decideIntervention,
  scorePriority,
} from '../src/agents/intervention.ts';

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

console.log('\n--- Running Phase 1 & Phase 2 Test Suite ---\n');

// 1. Probability Calculation & Clamping
test('Probability Calculation: Base propensity + lift', () => {
  const prob = calculateRecoveryProbability(0.5, InterventionType.SMART_RETRY);
  const expected = 0.5 + INTERVENTION_EFFECTIVENESS_LIFTS[InterventionType.SMART_RETRY]; // 0.5 + 0.25 = 0.75
  assert.equal(prob, expected);
});

test('Probability Clamping: Upper bound clamped to 1.0', () => {
  const prob = calculateRecoveryProbability(0.95, InterventionType.PAYMENT_METHOD_UPDATE); // 0.95 + 0.38 = 1.33
  assert.equal(prob, 1.0);
  assert.equal(clampProbability(1.45), 1.0);
});

test('Probability Clamping: Lower bound clamped to 0.0', () => {
  assert.equal(clampProbability(-0.3), 0.0);
  assert.equal(clampProbability(NaN), 0.0);
  assert.equal(clampProbability(Infinity), 1.0);
  assert.equal(clampProbability(-Infinity), 0.0);
});

// 2. Risk Score Calculation & Lower/Upper Bounds
test('Risk Score: Basic formula calculation', () => {
  // propensity = 0.2, cause = ISSUER_DECLINED (1.0)
  // 100 * (1 - 0.2) * 1.0 = 80
  const score = calculateRiskScore(0.2, FailureCause.ISSUER_DECLINED);
  assert.equal(score, 80);
});

test('Risk Score: Upper bound clamped to 100', () => {
  // propensity = 0.0, cause = UNKNOWN (1.2)
  // 100 * (1 - 0.0) * 1.2 = 120 -> clamped to 100
  const score = calculateRiskScore(0.0, FailureCause.UNKNOWN);
  assert.equal(score, 100);
});

test('Risk Score: Lower bound clamped to 0', () => {
  // propensity = 1.0 -> 100 * 0 * multiplier = 0
  const score = calculateRiskScore(1.0, FailureCause.INSUFFICIENT_FUNDS);
  assert.equal(score, 0);

  // malformed propensity > 1 -> clamped to 1.0 -> score 0
  const scoreOver = calculateRiskScore(1.5, FailureCause.EXPIRED_CARD);
  assert.equal(scoreOver, 0);
});

// 3. Every Root Cause Multiplier
test('Root Cause Multipliers: Verify all 6 multipliers exactly match specification', () => {
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.UNKNOWN], 1.2);
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.CARD_BLOCKED], 1.1);
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.EXPIRED_CARD], 1.1);
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.ISSUER_DECLINED], 1.0);
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.INSUFFICIENT_FUNDS], 0.9);
  assert.equal(CAUSE_MULTIPLIERS[FailureCause.BANK_TIMEOUT], 0.9);

  // Unrecognized cause falls back to UNKNOWN (1.2)
  const fallbackScore = calculateRiskScore(0.5, 'CUSTOM_UNRECOGNIZED_CODE');
  const expectedFallback = Math.round(100 * (1 - 0.5) * 1.2); // 60
  assert.equal(fallbackScore, expectedFallback);
});

// 4. Negative Revenue Protection
test('Negative Revenue Protection: Clamped to zero', () => {
  const priority = calculatePriorityScore(-15000, 0.8, 70, 1.2);
  assert.equal(priority, 0);

  const baseCase: RecoveryCase = {
    id: 'case_neg_test',
    customerId: 'cust_neg',
    subscriptionId: 'sub_neg',
    customerName: 'Negative Rev Test',
    customerEmail: 'neg@example.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: -5000,
    failureCause: FailureCause.INSUFFICIENT_FUNDS,
    attemptCount: 1,
    customerResponsePropensity: 0.6,
  };

  const scored = scorePriority(baseCase);
  assert.equal(scored.revenueAtRiskInr, 0);
  assert.equal(scored.priorityScore, 0);
});

// 5. Urgency Calculation
test('Urgency Calculation: Formula and step bounds', () => {
  // attempt_count <= 1 -> 1.0
  assert.equal(calculateUrgencyWeight(1), 1.0);
  assert.equal(calculateUrgencyWeight(0), 1.0);
  assert.equal(calculateUrgencyWeight(-5), 1.0);

  // attempt_count = 2 -> 1.0 + 0.15 * 1 = 1.15
  assert.equal(Math.round(calculateUrgencyWeight(2) * 100) / 100, 1.15);

  // attempt_count = 3 -> 1.0 + 0.15 * 2 = 1.30
  assert.equal(Math.round(calculateUrgencyWeight(3) * 100) / 100, 1.30);

  // attempt_count = 4 -> 1.0 + 0.15 * 3 = 1.45
  assert.equal(Math.round(calculateUrgencyWeight(4) * 100) / 100, 1.45);

  // attempt_count >= 5 -> capped at 1.45
  assert.equal(Math.round(calculateUrgencyWeight(8) * 100) / 100, 1.45);
});

// 6. Priority Score Calculation
test('Priority Score Calculation: Matches analytical formula', () => {
  // Case example: revenue = 15,000, prob = 0.82, risk = 75, urgency = 1.30
  // expected: 15,000 * 0.82 * 0.75 * 1.30 = 11,992.50
  const score = calculatePriorityScore(15000, 0.82, 75, 1.30);
  assert.equal(score, 11992.50);
});

// 7. Canonical Probability Reuse
test('Canonical Probability Reuse: scorePriority uses canonical recovery probability', () => {
  const testCase: RecoveryCase = {
    id: 'case_canon',
    customerId: 'cust_canon',
    subscriptionId: 'sub_canon',
    customerName: 'Canonical Test',
    customerEmail: 'canon@test.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 25000,
    failureCause: FailureCause.EXPIRED_CARD,
    attemptCount: 2,
    customerResponsePropensity: 0.45,
    recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
  };

  const scored = scorePriority(testCase);
  const directCanonProb = calculateRecoveryProbability(
    0.45,
    InterventionType.PAYMENT_METHOD_UPDATE
  );

  assert.equal(scored.recoveryProbability, directCanonProb);
});

// 8. Priority Score Does NOT Alter Intervention Selection
test('Priority Decoupling: Priority score does NOT alter intervention decision', () => {
  const smallCase: RecoveryCase = {
    id: 'case_small',
    customerId: 'cust_1',
    subscriptionId: 'sub_1',
    customerName: 'Small Customer',
    customerEmail: 'small@example.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: 199,
    failureCause: FailureCause.EXPIRED_CARD,
    attemptCount: 1,
    customerResponsePropensity: 0.5,
  };

  const enterpriseCase: RecoveryCase = {
    id: 'case_huge',
    customerId: 'cust_2',
    subscriptionId: 'sub_2',
    customerName: 'Enterprise Customer',
    customerEmail: 'enterprise@example.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 250000,
    failureCause: FailureCause.EXPIRED_CARD,
    attemptCount: 1,
    customerResponsePropensity: 0.5,
  };

  const decisionSmall = decideIntervention(smallCase);
  const decisionHuge = decideIntervention(enterpriseCase);

  // Both should receive the exact same clinical intervention regardless of revenue/priority
  assert.equal(decisionSmall.recommendedIntervention, InterventionType.PAYMENT_METHOD_UPDATE);
  assert.equal(decisionHuge.recommendedIntervention, InterventionType.PAYMENT_METHOD_UPDATE);
  assert.equal(decisionSmall.reasoning, decisionHuge.reasoning);

  // Now score priorities
  const scoredSmall = scorePriority({ ...smallCase, recommendedIntervention: decisionSmall.recommendedIntervention });
  const scoredHuge = scorePriority({ ...enterpriseCase, recommendedIntervention: decisionHuge.recommendedIntervention });

  // Priority scores differ drastically:
  assert.ok((scoredHuge.priorityScore ?? 0) > (scoredSmall.priorityScore ?? 0) * 1000);

  // Re-evaluating decision after scoring still produces identical intervention
  const reDecisionSmall = decideIntervention(scoredSmall);
  const reDecisionHuge = decideIntervention(scoredHuge);
  assert.equal(reDecisionSmall.recommendedIntervention, decisionSmall.recommendedIntervention);
  assert.equal(reDecisionHuge.recommendedIntervention, decisionHuge.recommendedIntervention);
});

// 9. Deterministic / Reproducible Calculations
test('Determinism: 100 runs produce identical results with zero drift', () => {
  const caseSample: RecoveryCase = {
    id: 'case_det',
    customerId: 'cust_det',
    subscriptionId: 'sub_det',
    customerName: 'Deterministic Test',
    customerEmail: 'det@example.com',
    subscriptionTier: 'PROFESSIONAL',
    revenueAtRiskInr: 9999,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 3,
    customerResponsePropensity: 0.55,
    recommendedIntervention: InterventionType.SMART_RETRY,
  };

  const firstRun = scorePriority(caseSample);

  for (let i = 0; i < 100; i++) {
    const nextRun = scorePriority(caseSample);
    assert.equal(nextRun.priorityScore, firstRun.priorityScore);
    assert.equal(nextRun.riskScore, firstRun.riskScore);
    assert.equal(nextRun.urgencyWeight, firstRun.urgencyWeight);
    assert.equal(nextRun.recoveryProbability, firstRun.recoveryProbability);
  }
});

// 10. Monotonic Prerequisite Check
test('Monotonic Prerequisite: All actionable intervention lifts are >= GENERIC_RETRY_LIFT', () => {
  assert.equal(GENERIC_RETRY_LIFT, 0.08);
  for (const [intervention, lift] of Object.entries(INTERVENTION_EFFECTIVENESS_LIFTS)) {
    assert.ok(
      lift >= GENERIC_RETRY_LIFT,
      `Intervention ${intervention} lift (${lift}) must be >= GENERIC_RETRY_LIFT (${GENERIC_RETRY_LIFT})`
    );
  }
});

console.log(`\nResults: ${passed} / ${total} tests passed.\n`);

if (passed !== total) {
  process.exit(1);
}
