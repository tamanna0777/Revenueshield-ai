import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runRecoverySimulation, DEFAULT_DEMO_SEED, DEFAULT_SAMPLE_SIZE } from '../src/services/revenueRecovery.ts';
import { getDashboardSummary } from '../src/services/dashboard.ts';
import { AnalyticsPage, AnalyticsSection } from '../src/components/dashboard/AnalyticsSection.tsx';

console.log('--- Running Analytics Tab Verification Test Suite ---');

// 1. Check exports
assert.strictEqual(typeof AnalyticsPage, 'function', 'AnalyticsPage must be exported as a React component');
assert.strictEqual(typeof AnalyticsSection, 'function', 'AnalyticsSection must be exported as a React component');
console.log('  ✓ Exports: AnalyticsPage and AnalyticsSection are properly exported');

// 2. Check data aggregation with active simulation state
const state = runRecoverySimulation(DEFAULT_DEMO_SEED, DEFAULT_SAMPLE_SIZE);
const kpis = getDashboardSummary();

assert(state.executedCases.length > 0, 'Simulation produces non-empty cases');
assert(kpis !== null, 'KPIs are non-null');
assert(typeof kpis.totalAtRiskInr === 'number', 'kpis.totalAtRiskInr is a number');
assert(typeof kpis.totalAgentRecoveredInr === 'number', 'kpis.totalAgentRecoveredInr is a number');
assert(typeof kpis.totalBaselineRecoveredInr === 'number', 'kpis.totalBaselineRecoveredInr is a number');
assert(typeof kpis.incrementalRecoveryInr === 'number', 'kpis.incrementalRecoveryInr is a number');
assert(typeof kpis.incrementalRecoveryPct === 'number', 'kpis.incrementalRecoveryPct is a number');

console.log('  ✓ KPI Schema: All expected analytical metrics match exact property types');

// 3. Check property compatibility with component calculations
const totalAtRisk = kpis.totalAtRiskInr;
const agentRecovered = kpis.totalAgentRecoveredInr;
const baselineRecovered = kpis.totalBaselineRecoveredInr;
const incrementalLift = kpis.incrementalRecoveryPct;

assert(totalAtRisk >= agentRecovered, 'Total at risk must be greater than or equal to agent recovered');
assert(agentRecovered >= baselineRecovered, 'Monotonicity: agent recovered >= baseline recovered');
assert(!isNaN(incrementalLift), 'Incremental lift must be finite');

console.log('  ✓ Metric Monotonicity: Agent >= Baseline in summary state');
console.log('--- All Analytics Verification Tests Passed! ---');
