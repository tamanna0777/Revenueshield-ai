/**
 * Phase 3 & Phase 4 Test Suite
 * RevenueShield AI
 * 
 * Tests Single-Draw Invariant, Monotonicity Guarantee, Seed Reproducibility,
 * Ledger aggregation, and Edge Case handling.
 */

import assert from 'node:assert/strict';
import { FailureCause, InterventionType, RecoveryCase } from '../src/types.ts';
import {
  calculateRecoveryProbability,
  clampProbability,
  GENERIC_RETRY_LIFT,
  INTERVENTION_EFFECTIVENESS_LIFTS,
} from '../src/agents/probability.ts';
import { decideIntervention, scorePriority } from '../src/agents/intervention.ts';
import {
  calculateAgentProbability,
  calculateBaselineProbability,
  createSeededRng,
  executeSimulationBatch,
  executeSimulationCase,
} from '../src/agents/execution.ts';
import { summarizeLedger } from '../src/agents/ledger.ts';

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

console.log('\n--- Running Phase 3 & Phase 4 Test Suite ---\n');

// 1. Single Random Draw & Shared Draw Verification
test('Single-Draw Guarantee: Exactly ONE random draw invoked per case and shared', () => {
  let drawCallCount = 0;
  const mockRng = () => {
    drawCallCount++;
    return 0.42;
  };

  const sampleCase: RecoveryCase = {
    id: 'case_single_draw_1',
    customerId: 'cust_1',
    subscriptionId: 'sub_1',
    customerName: 'Draw Test',
    customerEmail: 'draw@test.com',
    subscriptionTier: 'STARTER',
    revenueAtRiskInr: 1000,
    failureCause: FailureCause.BANK_TIMEOUT,
    attemptCount: 1,
    customerResponsePropensity: 0.3,
    recommendedIntervention: InterventionType.SMART_RETRY,
  };

  const { updatedCase, executionResult } = executeSimulationCase(sampleCase, mockRng);

  // Invariant 1: Exactly one call to rng()
  assert.equal(drawCallCount, 1, 'RNG must be called exactly once');

  // Invariant 2: Shared randomDrawU recorded
  assert.equal(executionResult.randomDrawU, 0.42);
  assert.equal(updatedCase.randomDrawU, 0.42);

  // Baseline prob = 0.3 + 0.08 = 0.38. Since u (0.42) >= 0.38 -> baselineRecovered = false
  assert.equal(executionResult.baselineRecovered, false);
  // Agent prob = 0.3 + 0.25 = 0.55. Since u (0.42) < 0.55 -> agentRecovered = true
  assert.equal(executionResult.agentRecovered, true);
});

// 2. Baseline Probability = propensity + 0.08
test('Baseline Probability: Exactly propensity + 0.08 (synthetic proxy)', () => {
  const p1 = calculateBaselineProbability(0.4);
  assert.equal(Math.round(p1 * 100) / 100, 0.48);

  const p2 = calculateBaselineProbability(0.95);
  assert.equal(p2, 1.0); // clamped to 1.0
});

// 3. Agent Probability = propensity + intervention lift
test('Agent Probability: Uses canonical table from src/agents/probability.ts', () => {
  for (const [intervention, lift] of Object.entries(INTERVENTION_EFFECTIVENESS_LIFTS)) {
    const p = calculateAgentProbability(0.2, intervention as InterventionType);
    const expected = Math.min(1.0, 0.2 + lift);
    assert.equal(Math.round(p * 1000) / 1000, Math.round(expected * 1000) / 1000);
  }
});

// 4. Probability Clamping to [0, 1]
test('Clamping: All probabilities bounded in [0, 1]', () => {
  assert.equal(calculateBaselineProbability(-0.5), 0.08);
  assert.equal(calculateBaselineProbability(1.5), 1.0);
  assert.equal(calculateAgentProbability(-0.2, InterventionType.PAYMENT_METHOD_UPDATE), 0.38);
  assert.equal(calculateAgentProbability(1.2, InterventionType.PAYMENT_METHOD_UPDATE), 1.0);
});

// 5. CRITICAL MONOTONICITY TEST: Agent recovery can NEVER be false when baseline recovery is true
test('Critical Monotonic Invariant: baseline_recovered === true implies agent_recovered === true', () => {
  // Test across 1,000 synthetic simulations with various propensities and interventions
  const seededRng = createSeededRng(1337);
  const interventions = Object.values(InterventionType);
  const causes = Object.values(FailureCause);

  for (let i = 0; i < 1000; i++) {
    const propensity = seededRng();
    const intervention = interventions[i % interventions.length];
    const cause = causes[i % causes.length];

    const testCase: RecoveryCase = {
      id: `case_mono_${i}`,
      customerId: `cust_${i}`,
      subscriptionId: `sub_${i}`,
      customerName: `Customer ${i}`,
      customerEmail: `c${i}@example.com`,
      subscriptionTier: 'PROFESSIONAL',
      revenueAtRiskInr: 500 + Math.floor(seededRng() * 10000),
      failureCause: cause,
      attemptCount: 1 + (i % 4),
      customerResponsePropensity: propensity,
      recommendedIntervention: intervention,
    };

    const { executionResult } = executeSimulationCase(testCase, seededRng);

    // Strict invariant: NOT (baseline_recovered && !agent_recovered)
    if (executionResult.baselineRecovered && !executionResult.agentRecovered) {
      assert.fail(`Monotonic violation at iteration ${i}: baseline true but agent false!`);
    }

    // Financial invariant: agentRecoveredAmountInr >= baselineRecoveredAmountInr
    assert.ok(
      executionResult.agentRecoveredAmountInr >= executionResult.baselineRecoveredAmountInr,
      'Agent recovered INR must be >= baseline recovered INR'
    );
    assert.ok(
      executionResult.incrementalRecoveryInr >= 0,
      'Incremental recovery must be non-negative'
    );
  }
});

// 6. Agent recovery CAN be true while baseline recovery is false
test('Incremental Lift Demonstration: Agent can recover where blind retry fails', () => {
  // Choose propensity where propensity + 0.08 < u < propensity + lift
  // e.g. propensity = 0.3, lift = 0.38 (PAYMENT_METHOD_UPDATE), baseline = 0.38, agent = 0.68
  // if u = 0.50, baseline fails (0.50 >= 0.38), agent succeeds (0.50 < 0.68)
  const testCase: RecoveryCase = {
    id: 'case_lift_demo',
    customerId: 'cust_lift',
    subscriptionId: 'sub_lift',
    customerName: 'Lift Test',
    customerEmail: 'lift@example.com',
    subscriptionTier: 'ENTERPRISE',
    revenueAtRiskInr: 15000,
    failureCause: FailureCause.EXPIRED_CARD,
    attemptCount: 1,
    customerResponsePropensity: 0.3,
    recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
  };

  const { executionResult } = executeSimulationCase(testCase, () => 0.50);

  assert.equal(executionResult.baselineRecovered, false);
  assert.equal(executionResult.agentRecovered, true);
  assert.equal(executionResult.baselineRecoveredAmountInr, 0);
  assert.equal(executionResult.agentRecoveredAmountInr, 15000);
  assert.equal(executionResult.incrementalRecoveryInr, 15000);
});

// 7. Deterministic RNG Reproducibility
test('Determinism: Same seed + same cases produce byte-identical execution and ledger', () => {
  const generateBatch = () => [
    {
      id: 'case_d1',
      customerId: 'c1',
      subscriptionId: 's1',
      customerName: 'D1',
      customerEmail: 'd1@test.com',
      subscriptionTier: 'STARTER',
      revenueAtRiskInr: 2500,
      failureCause: FailureCause.INSUFFICIENT_FUNDS,
      attemptCount: 1,
      customerResponsePropensity: 0.45,
      recommendedIntervention: InterventionType.CUSTOMER_NOTIFICATION,
    },
    {
      id: 'case_d2',
      customerId: 'c2',
      subscriptionId: 's2',
      customerName: 'D2',
      customerEmail: 'd2@test.com',
      subscriptionTier: 'ENTERPRISE',
      revenueAtRiskInr: 12000,
      failureCause: FailureCause.EXPIRED_CARD,
      attemptCount: 2,
      customerResponsePropensity: 0.35,
      recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
    },
  ];

  const batchA = executeSimulationBatch(generateBatch(), 98765);
  const batchB = executeSimulationBatch(generateBatch(), 98765);

  assert.deepEqual(batchA.executionResults, batchB.executionResults);
  assert.deepEqual(summarizeLedger(batchA.updatedCases), summarizeLedger(batchB.updatedCases));
});

// 8. Ledger: Exact Incremental Recovery Formula Verification
test('Ledger: Incremental recovery INR and percentage formula matching specification', () => {
  // Scenario matching instruction:
  // total_at_risk = 100,000, baseline = 30,000, agent = 42,000
  // expected: incremental = 12,000, incremental_pct = 12%
  const mockCases: RecoveryCase[] = [
    {
      id: 'c1',
      customerId: 'cust1',
      subscriptionId: 'sub1',
      customerName: 'Cust 1',
      customerEmail: 'c1@test.com',
      subscriptionTier: 'STARTER',
      revenueAtRiskInr: 30000,
      failureCause: FailureCause.BANK_TIMEOUT,
      attemptCount: 1,
      customerResponsePropensity: 0.5,
      baselineRecovered: true,
      agentRecovered: true,
      baselineRecoveredAmountInr: 30000,
      agentRecoveredAmountInr: 30000,
    },
    {
      id: 'c2',
      customerId: 'cust2',
      subscriptionId: 'sub2',
      customerName: 'Cust 2',
      customerEmail: 'c2@test.com',
      subscriptionTier: 'PROFESSIONAL',
      revenueAtRiskInr: 12000,
      failureCause: FailureCause.EXPIRED_CARD,
      attemptCount: 1,
      customerResponsePropensity: 0.5,
      baselineRecovered: false,
      agentRecovered: true,
      baselineRecoveredAmountInr: 0,
      agentRecoveredAmountInr: 12000,
    },
    {
      id: 'c3',
      customerId: 'cust3',
      subscriptionId: 'sub3',
      customerName: 'Cust 3',
      customerEmail: 'c3@test.com',
      subscriptionTier: 'ENTERPRISE',
      revenueAtRiskInr: 58000,
      failureCause: FailureCause.CARD_BLOCKED,
      attemptCount: 2,
      customerResponsePropensity: 0.2,
      baselineRecovered: false,
      agentRecovered: false,
      baselineRecoveredAmountInr: 0,
      agentRecoveredAmountInr: 0,
    },
  ];

  const ledger = summarizeLedger(mockCases);

  assert.equal(ledger.totalAtRiskInr, 100000);
  assert.equal(ledger.totalBaselineRecoveredInr, 30000);
  assert.equal(ledger.totalAgentRecoveredInr, 42000);
  assert.equal(ledger.incrementalRecoveryInr, 12000);
  assert.equal(ledger.incrementalRecoveryPct, 12.0); // 12,000 / 100,000 = 12%
  assert.equal(ledger.baselineRecoveryRatePct, 30.0);
  assert.equal(ledger.agentRecoveryRatePct, 42.0);
});

// 9. Ledger: Zero-at-risk Division Protection
test('Ledger: Safely handles zero total-at-risk without NaN or Infinity', () => {
  const zeroCases: RecoveryCase[] = [
    {
      id: 'zero_1',
      customerId: 'cust_zero',
      subscriptionId: 'sub_zero',
      customerName: 'Zero Rev',
      customerEmail: 'zero@test.com',
      subscriptionTier: 'STARTER',
      revenueAtRiskInr: 0,
      failureCause: FailureCause.BANK_TIMEOUT,
      attemptCount: 1,
      customerResponsePropensity: 0.5,
      baselineRecovered: false,
      agentRecovered: false,
      baselineRecoveredAmountInr: 0,
      agentRecoveredAmountInr: 0,
    },
  ];

  const ledger = summarizeLedger(zeroCases);

  assert.equal(ledger.totalAtRiskInr, 0);
  assert.equal(ledger.incrementalRecoveryPct, 0);
  assert.equal(ledger.baselineRecoveryRatePct, 0);
  assert.equal(ledger.agentRecoveryRatePct, 0);
  assert.ok(!Number.isNaN(ledger.incrementalRecoveryPct));
  assert.ok(Number.isFinite(ledger.incrementalRecoveryPct));
});

// 10. Ledger: Empty Dataset Handling
test('Ledger: Handles empty cases array safely', () => {
  const ledger = summarizeLedger([]);
  assert.equal(ledger.casesProcessed, 0);
  assert.equal(ledger.totalAtRiskInr, 0);
  assert.equal(ledger.incrementalRecoveryInr, 0);
  assert.equal(ledger.incrementalRecoveryPct, 0);
  assert.equal(ledger.averageRecoveryProbability, 0);
});

// 11. Full End-to-End Flow: Decision -> Canonical Prob -> Prioritization -> Execution -> Ledger
test('End-to-End Pipeline: Decision -> Priority -> Execution -> Ledger', () => {
  const rawCases: RecoveryCase[] = [
    {
      id: 'pipeline_case_1',
      customerId: 'cust_p1',
      subscriptionId: 'sub_p1',
      customerName: 'Rahul Verma',
      customerEmail: 'rahul@example.com',
      subscriptionTier: 'PROFESSIONAL',
      revenueAtRiskInr: 15000,
      failureCause: FailureCause.EXPIRED_CARD,
      attemptCount: 2,
      customerResponsePropensity: 0.44,
    },
    {
      id: 'pipeline_case_2',
      customerId: 'cust_p2',
      subscriptionId: 'sub_p2',
      customerName: 'Ananya Iyer',
      customerEmail: 'ananya@example.com',
      subscriptionTier: 'STARTER',
      revenueAtRiskInr: 4999,
      failureCause: FailureCause.BANK_TIMEOUT,
      attemptCount: 1,
      customerResponsePropensity: 0.60,
    },
  ];

  // Step 1: Decide intervention
  const casesWithDecisions = rawCases.map((c) => {
    const decision = decideIntervention(c);
    return {
      ...c,
      recommendedIntervention: decision.recommendedIntervention,
      interventionReasoning: decision.reasoning,
    };
  });

  // Step 2: Score Priority (canonical probability calculated and assigned)
  const scoredCases = casesWithDecisions.map((c) => scorePriority(c));

  assert.ok(scoredCases[0].priorityScore! > 0);
  assert.ok(scoredCases[1].priorityScore! > 0);

  // Step 3: Execute simulation with deterministic seed
  const { updatedCases } = executeSimulationBatch(scoredCases, 2026);

  // Step 4: Summarize ledger
  const ledger = summarizeLedger(updatedCases);

  assert.equal(ledger.casesProcessed, 2);
  assert.ok(ledger.totalAtRiskInr === 19999);
  assert.ok(ledger.totalAgentRecoveredInr >= ledger.totalBaselineRecoveredInr);
  assert.ok(ledger.incrementalRecoveryInr >= 0);
});

console.log(`\nResults: ${passed} / ${total} Phase 3 & 4 tests passed.\n`);

if (passed !== total) {
  process.exit(1);
}
