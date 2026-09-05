/**
 * Phase 7 & Phase 8 Unit Tests
 * RevenueShield AI Application Layer & Dashboard Foundation
 */

import assert from 'node:assert/strict';
import {
  initializeDemoData,
  runRecoverySimulation,
  getLedgerSummary,
  getRecoveryCases,
  getTopPriorityCases,
  DEFAULT_DEMO_SEED,
} from '../src/services/revenueRecovery.ts';
import {
  getDashboardSummary,
  getFailureCauseMetrics,
  getInterventionMetrics,
  getRecentExecutions,
} from '../src/services/dashboard.ts';
import { FailureCause, InterventionType } from '../src/types.ts';
import { formatInr, formatPercentage } from '../src/utils/format.ts';

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

console.log('\n--- Running Phase 7 & Phase 8 Test Suite ---\n');

test('initializes demo data with default seed and appropriate sample size (>= 500 cases)', () => {
  const state = initializeDemoData(DEFAULT_DEMO_SEED, 600);
  assert.ok(state);
  assert.equal(state.seed, DEFAULT_DEMO_SEED);
  assert.ok(state.executedCases.length >= 500);
  assert.equal(state.ledger.casesProcessed, state.executedCases.length);
});

test('reconciles top dashboard KPIs strictly with ledger and maintains monotonicity', () => {
  initializeDemoData(2026, 600);
  const kpis = getDashboardSummary();
  const ledger = getLedgerSummary();

  assert.equal(kpis.totalAtRiskInr, ledger.totalAtRiskInr);
  assert.equal(kpis.totalBaselineRecoveredInr, ledger.totalBaselineRecoveredInr);
  assert.equal(kpis.totalAgentRecoveredInr, ledger.totalAgentRecoveredInr);
  assert.equal(kpis.incrementalRecoveryInr, ledger.incrementalRecoveryInr);

  // Exact financial reconciliation check: Incremental = Agent - Baseline
  assert.equal(
    kpis.incrementalRecoveryInr,
    kpis.totalAgentRecoveredInr - kpis.totalBaselineRecoveredInr
  );

  // Single-draw monotonicity guarantee: agent recovered >= baseline recovered
  assert.ok(kpis.totalAgentRecoveredInr >= kpis.totalBaselineRecoveredInr);
  assert.ok(kpis.incrementalRecoveryInr >= 0);
  assert.ok(kpis.agentRecoveryRatePct >= kpis.baselineRecoveryRatePct);
});

test('provides metrics for all 6 failure causes', () => {
  initializeDemoData(2026, 600);
  const failureCauseMetrics = getFailureCauseMetrics();
  assert.equal(failureCauseMetrics.length, 6);

  const causesFound = new Set(failureCauseMetrics.map((f) => f.cause));
  for (const cause of Object.values(FailureCause)) {
    assert.ok(causesFound.has(cause), `Missing failure cause ${cause}`);
  }

  // Each segment must have non-negative financial values
  for (const item of failureCauseMetrics) {
    assert.ok(item.revenueAtRiskInr >= 0);
    assert.ok(item.agentRecoveredInr >= 0);
    assert.ok(item.incrementalRecoveryInr >= 0);
    assert.ok(item.recoveryRatePct >= 0);
    assert.ok(item.recoveryRatePct <= 100);
  }
});

test('provides metrics for all 6 intervention strategies', () => {
  initializeDemoData(2026, 600);
  const interventionMetrics = getInterventionMetrics();
  assert.equal(interventionMetrics.length, 6);

  const interventionsFound = new Set(interventionMetrics.map((i) => i.intervention));
  for (const intervention of Object.values(InterventionType)) {
    assert.ok(interventionsFound.has(intervention), `Missing intervention ${intervention}`);
  }

  for (const item of interventionMetrics) {
    assert.ok(item.revenueAtRiskInr >= 0);
    assert.ok(item.agentRecoveredInr >= 0);
    assert.ok(item.recoveryRatePct >= 0);
    assert.ok(item.recoveryRatePct <= 100);
  }
});

test('returns top priority cases sorted strictly descending by priorityScore', () => {
  initializeDemoData(2026, 600);
  const topCases = getTopPriorityCases(50);
  assert.equal(topCases.length, 50);

  for (let i = 0; i < topCases.length - 1; i++) {
    const currentScore = topCases[i].priorityScore ?? 0;
    const nextScore = topCases[i + 1].priorityScore ?? 0;
    assert.ok(
      currentScore >= nextScore,
      `Priority sort order violated: ${currentScore} < ${nextScore}`
    );
  }
});

test('generates activity feed events derived from actual simulation cases', () => {
  initializeDemoData(2026, 600);
  const feed = getRecentExecutions(15);
  assert.equal(feed.length, 15);

  const allCases = getRecoveryCases();
  const caseIds = new Set(allCases.map((c) => c.id));

  for (const item of feed) {
    assert.ok(caseIds.has(item.caseId), `Activity caseId not in simulated cases: ${item.caseId}`);
    assert.ok(item.customerName);
    assert.ok(item.amountInr > 0);
    assert.ok(['RECOVERED', 'FAILED'].includes(item.status));
  }
});

test('produces deterministic identical outcomes when run with the same seed', () => {
  runRecoverySimulation(42, 500);
  const kpis1 = getDashboardSummary();

  runRecoverySimulation(42, 500);
  const kpis2 = getDashboardSummary();

  assert.equal(kpis1.totalAtRiskInr, kpis2.totalAtRiskInr);
  assert.equal(kpis1.totalAgentRecoveredInr, kpis2.totalAgentRecoveredInr);
  assert.equal(kpis1.totalBaselineRecoveredInr, kpis2.totalBaselineRecoveredInr);
  assert.equal(kpis1.incrementalRecoveryInr, kpis2.incrementalRecoveryInr);
  assert.equal(kpis1.casesProcessed, kpis2.casesProcessed);
});

test('formats INR currency properly according to Indian numbering system', () => {
  assert.equal(formatInr(5000), '₹5,000');
  assert.equal(formatInr(500000), '₹5,00,000');
  assert.equal(formatInr(1240000, true), '₹12.4L');
  assert.equal(formatInr(15000000, true), '₹1.50Cr');
  assert.equal(formatPercentage(0.428), '42.8%');
  assert.equal(formatPercentage(42.8), '42.8%');
});

console.log(`\nResults: ${passed}/${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
