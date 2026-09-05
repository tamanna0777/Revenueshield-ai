/**
 * Single-Draw Execution & Simulation Engine
 * RevenueShield AI
 * 
 * CORE INVARIANT & CAUSAL GUARANTEE:
 * Baseline and Agent outcomes for a RecoveryCase MUST share EXACTLY ONE random draw:
 * 
 *   u = rng.random()
 *   baseline_recovered = u < baseline_probability
 *   agent_recovered    = u < agent_probability
 * 
 * Because agent_probability >= baseline_probability (every actionable lift >= GENERIC_RETRY_LIFT = 0.08),
 * this guarantees monotonic recovery:
 *   baseline_recovered === true  ===>  agent_recovered === true
 * 
 * SYNTHETIC BASELINE DEFINITION:
 * The baseline represents a synthetic blind-retry proxy (what a single generic retry without diagnosis
 * would achieve). It is explicitly a synthetic benchmark, NOT Razorpay's actual production performance.
 */

import { InterventionType, RecoveryCase } from '../types.ts';
import {
  calculateRecoveryProbability,
  clampProbability,
  GENERIC_RETRY_LIFT,
  INTERVENTION_EFFECTIVENESS_LIFTS,
} from './probability.ts';

/**
 * Interface for injectable random number generator.
 * Returns a uniform float in [0, 1).
 */
export type RandomNumberGenerator = () => number;

/**
 * Simple, fast, deterministic Mulberry32 Pseudo-Random Number Generator.
 * Used to ensure completely reproducible simulation runs with a given numeric seed.
 */
export function createSeededRng(seed: number): RandomNumberGenerator {
  let a = (seed ^ 0x6d2b79f5) >>> 0;
  return function mulberry32(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calculates the baseline recovery probability for a case.
 * 
 * Baseline = synthetic blind-retry proxy:
 * clamp(customer_response_propensity + GENERIC_RETRY_LIFT, 0, 1)
 */
export function calculateBaselineProbability(customerResponsePropensity: number): number {
  const safePropensity = clampProbability(customerResponsePropensity);
  return clampProbability(safePropensity + GENERIC_RETRY_LIFT);
}

/**
 * Calculates the agent recovery probability for a case.
 * Uses the canonical probability engine from src/agents/probability.ts.
 */
export function calculateAgentProbability(
  customerResponsePropensity: number,
  intervention: InterventionType = InterventionType.NO_ACTION
): number {
  return calculateRecoveryProbability(customerResponsePropensity, intervention);
}

/**
 * Result of executing a single simulated recovery case.
 */
export interface ExecutionResult {
  caseId: string;
  baselineProbability: number;
  agentProbability: number;
  randomDrawU: number;
  baselineRecovered: boolean;
  agentRecovered: boolean;
  baselineRecoveredAmountInr: number;
  agentRecoveredAmountInr: number;
  incrementalRecoveryInr: number;
  revenueAtRiskInr: number;
  intervention: InterventionType;
  executedAt: string;
}

/**
 * Executes a single RecoveryCase under simulation using EXACTLY ONE random draw.
 * 
 * Invariants enforced:
 * 1. Exactly one call to rng() per case.
 * 2. baseline_probability <= agent_probability (as lifts >= 0.08).
 * 3. baseline_recovered implies agent_recovered (monotonic recovery).
 * 4. Recovered amounts clamped to [0, revenueAtRiskInr].
 * 5. Incremental recovery = agentRecoveredAmountInr - baselineRecoveredAmountInr >= 0.
 */
export function executeSimulationCase(
  recoveryCase: RecoveryCase,
  rng: RandomNumberGenerator = Math.random
): { updatedCase: RecoveryCase; executionResult: ExecutionResult } {
  const safeRevenue = Math.max(0, recoveryCase.revenueAtRiskInr ?? 0);
  const safePropensity = clampProbability(recoveryCase.customerResponsePropensity ?? 0.5);
  const intervention = recoveryCase.recommendedIntervention ?? InterventionType.NO_ACTION;

  // 1. Calculate canonical probabilities
  const baselineProbability = calculateBaselineProbability(safePropensity);
  const agentProbability = calculateAgentProbability(safePropensity, intervention);

  // Verification of monotonic prerequisite
  if (agentProbability < baselineProbability) {
    throw new Error(
      `Monotonic invariant violation: agentProbability (${agentProbability}) < baselineProbability (${baselineProbability}) for intervention ${intervention}`
    );
  }

  // 2. CRITICAL: EXACTLY ONE RANDOM DRAW FOR BOTH OUTCOMES
  const u = rng();
  const safeU = Math.max(0, Math.min(1, u));

  // 3. Outcomes evaluated against the single shared draw
  const baselineRecovered = safeU < baselineProbability;
  const agentRecovered = safeU < agentProbability;

  // Strict invariant assert: baseline_recovered => agent_recovered
  if (baselineRecovered && !agentRecovered) {
    throw new Error(
      `Monotonic violation detected: baseline recovered (${safeU} < ${baselineProbability}) but agent did not (${safeU} >= ${agentProbability})`
    );
  }

  // 4. Financial recovery computation
  const baselineRecoveredAmountInr = baselineRecovered ? safeRevenue : 0;
  const agentRecoveredAmountInr = agentRecovered ? safeRevenue : 0;
  const incrementalRecoveryInr = Math.max(0, agentRecoveredAmountInr - baselineRecoveredAmountInr);

  const timestamp = new Date().toISOString();

  const executionResult: ExecutionResult = {
    caseId: recoveryCase.id,
    baselineProbability,
    agentProbability,
    randomDrawU: safeU,
    baselineRecovered,
    agentRecovered,
    baselineRecoveredAmountInr,
    agentRecoveredAmountInr,
    incrementalRecoveryInr,
    revenueAtRiskInr: safeRevenue,
    intervention,
    executedAt: timestamp,
  };

  const updatedCase: RecoveryCase = {
    ...recoveryCase,
    revenueAtRiskInr: safeRevenue,
    customerResponsePropensity: safePropensity,
    recoveryProbability: agentProbability, // canonically matches agent probability
    baselineProbability,
    agentProbability,
    randomDrawU: safeU,
    baselineRecovered,
    agentRecovered,
    baselineRecoveredAmountInr,
    agentRecoveredAmountInr,
    incrementalRecoveryInr,
    recoveredAmountInr: agentRecoveredAmountInr,
    executedAt: timestamp,
  };

  return { updatedCase, executionResult };
}

/**
 * Executes a batch of recovery cases with a deterministic or injected RNG.
 */
export function executeSimulationBatch(
  cases: RecoveryCase[],
  rngOrSeed: RandomNumberGenerator | number = 42
): { updatedCases: RecoveryCase[]; executionResults: ExecutionResult[] } {
  const rng = typeof rngOrSeed === 'number' ? createSeededRng(rngOrSeed) : rngOrSeed;

  const updatedCases: RecoveryCase[] = [];
  const executionResults: ExecutionResult[] = [];

  for (const c of cases) {
    const { updatedCase, executionResult } = executeSimulationCase(c, rng);
    updatedCases.push(updatedCase);
    executionResults.push(executionResult);
  }

  return { updatedCases, executionResults };
}
