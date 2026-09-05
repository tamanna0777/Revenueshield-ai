/**
 * Revenue Recovery Application Service
 * RevenueShield AI (Phase 7 Application Layer)
 * 
 * Orchestrates the full lifecycle:
 * Synthetic Dataset -> Recovery Cases -> Diagnosis & Intervention -> Prioritization -> Execution -> Ledger
 * 
 * Maintains canonical state in-memory and ensures strict financial reconciliation.
 */

import { generateSyntheticDataset, SyntheticDataset } from '../data/synthetic.ts';
import { ActionLifecycleState, AppEnvironment, InterventionType, PolicyConfig, RecoveryCase } from '../types.ts';
import { decideIntervention } from '../agents/intervention.ts';
import { scorePriority } from '../agents/intervention.ts';
import { executeSimulationBatch } from '../agents/execution.ts';
import { summarizeLedger, LedgerSummary } from '../agents/ledger.ts';
import {
  evaluatePolicy,
  getPolicyConfig,
  updatePolicyConfig,
  resetPolicyConfig,
  setKillSwitch,
} from '../agents/policy.ts';
import { recordCaseAudit, recordAuditEntry, clearAuditTrail } from '../agents/audit.ts';

export interface SimulationExecutionState {
  seed: number;
  sampleSize: number;
  dataset: SyntheticDataset;
  executedCases: RecoveryCase[];
  ledger: LedgerSummary;
  initializedAt: string;
}

// In-memory singleton state for demo
let currentExecutionState: SimulationExecutionState | null = null;

export const DEFAULT_DEMO_SEED = 2026;
export const DEFAULT_SAMPLE_SIZE = 650; // Target 500–800 recovery cases

/**
 * Initializes or re-executes the full recovery pipeline with a configurable seed.
 */
export function initializeDemoData(
  seed: number = DEFAULT_DEMO_SEED,
  sampleSize: number = DEFAULT_SAMPLE_SIZE
): SimulationExecutionState {
  // 1. Generate deterministic synthetic dataset
  const dataset = generateSyntheticDataset(seed);

  // 2. Select recovery cases sample (up to sampleSize)
  const rawCases = dataset.recoveryCases.slice(0, Math.min(sampleSize, dataset.recoveryCases.length));

  // 3. Diagnose & Decide Interventions
  const diagnosedCases: RecoveryCase[] = rawCases.map((c) => {
    const decision = decideIntervention(c);
    return {
      ...c,
      recommendedIntervention: decision.recommendedIntervention,
      interventionReasoning: decision.reasoning,
    };
  });

  // 4. Score Priority (incorporating canonical recovery probability and risk score)
  const prioritizedCases: RecoveryCase[] = diagnosedCases.map((c) => scorePriority(c));

  // 5. Execute Simulation using deterministic Single-Draw PRNG
  const { updatedCases } = executeSimulationBatch(prioritizedCases, seed);

  // 6. Evaluate Policy & Guardrails for each case (Phase 10 & 11)
  const activeConfig = getPolicyConfig();
  const policyEvaluatedCases: RecoveryCase[] = updatedCases.map((c) => {
    const policyResult = evaluatePolicy({ recoveryCase: c, config: activeConfig });
    const finalState: ActionLifecycleState =
      policyResult.decision === 'ALLOW'
        ? (c.agentRecovered ? 'RECOVERED' : 'NOT_RECOVERED')
        : policyResult.decision === 'REQUIRE_APPROVAL'
          ? 'PENDING_APPROVAL'
          : 'BLOCKED';

    return {
      ...c,
      policyRuleDecision: policyResult.decision,
      policyDecision: {
        decision: policyResult.policyDecisionType,
        policyViolated: policyResult.ruleMatched,
        reason: policyResult.reason,
        evaluatedAt: policyResult.evaluatedAt,
      },
      actionState: finalState,
      environment: 'DEMO' as AppEnvironment,
      dryRun: true,
      source: 'SYNTHETIC' as const,
    };
  });

  // 7. Seed initial audit entries for top priority cases
  clearAuditTrail();
  const sortedCases = [...policyEvaluatedCases].sort(
    (a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)
  );
  for (const c of sortedCases.slice(0, 20)) {
    recordCaseAudit(c, {
      policyDecision: c.policyRuleDecision ?? 'ALLOW',
      policyReason: c.policyDecision?.reason ?? 'Normal policy evaluation',
      actionState: c.actionState ?? 'EXECUTED',
      outcome: c.actionState ?? (c.agentRecovered ? 'RECOVERED' : 'NOT_RECOVERED'),
      dryRun: true,
      environment: 'DEMO',
    });
  }

  // 8. Generate Ledger Summary
  const ledger = summarizeLedger(policyEvaluatedCases);

  // Save in-memory
  currentExecutionState = {
    seed,
    sampleSize: policyEvaluatedCases.length,
    dataset,
    executedCases: policyEvaluatedCases,
    ledger,
    initializedAt: new Date().toISOString(),
  };

  return currentExecutionState;
}

/**
 * Re-evaluates policy decisions for all cases without modifying recovery probability,
 * priority score, or recommended intervention.
 * 
 * Demonstrates: PREDICTION != AUTHORIZATION
 */
export function reEvaluatePolicies(config?: Partial<PolicyConfig>): RecoveryCase[] {
  const state = ensureInitialized();
  const cfg = config ? updatePolicyConfig(config) : getPolicyConfig();

  state.executedCases = state.executedCases.map((c) => {
    const policyResult = evaluatePolicy({ recoveryCase: c, config: cfg });
    const finalState: ActionLifecycleState =
      policyResult.decision === 'ALLOW'
        ? (c.agentRecovered ? 'RECOVERED' : 'NOT_RECOVERED')
        : policyResult.decision === 'REQUIRE_APPROVAL'
          ? 'PENDING_APPROVAL'
          : 'BLOCKED';

    return {
      ...c,
      policyRuleDecision: policyResult.decision,
      policyReason: policyResult.reason,
      policyDecision: {
        decision: policyResult.policyDecisionType,
        policyViolated: policyResult.ruleMatched,
        reason: policyResult.reason,
        evaluatedAt: policyResult.evaluatedAt,
      },
      actionState: finalState,
    };
  });

  return state.executedCases;
}

/**
 * Adds or updates a simulated test webhook case in the active case repository.
 */
export function addSimulatedCase(newCase: RecoveryCase): void {
  const state = ensureInitialized();
  state.executedCases = [newCase, ...state.executedCases.filter((c) => c.id !== newCase.id)];
  state.ledger.casesProcessed = state.executedCases.length;
  state.ledger.totalAtRiskInr += newCase.revenueAtRiskInr;
  if (newCase.agentRecovered) {
    state.ledger.totalAgentRecoveredInr += newCase.revenueAtRiskInr;
    state.ledger.incrementalRecoveryInr += newCase.incrementalRecoveryInr;
  }
  if (newCase.baselineRecovered) {
    state.ledger.totalBaselineRecoveredInr += newCase.revenueAtRiskInr;
  }
}

/**
 * Returns any simulated test webhook cases from the active case repository.
 */
export function getSimulatedCases(): RecoveryCase[] {
  const state = ensureInitialized();
  return state.executedCases.filter(
    (c) => c.id.startsWith('case_sim_') || c.id.startsWith('case_rzp_')
  );
}

/**
 * Resets the demo state back to default configuration and benchmark seed 2026.
 */
export function resetDemoState(): SimulationExecutionState {
  resetPolicyConfig();
  setKillSwitch(false);
  return initializeDemoData(DEFAULT_DEMO_SEED, DEFAULT_SAMPLE_SIZE);
}

/**
 * Ensures state is initialized, defaulting to DEFAULT_DEMO_SEED if not yet run.
 */
function ensureInitialized(): SimulationExecutionState {
  if (!currentExecutionState) {
    return initializeDemoData(DEFAULT_DEMO_SEED, DEFAULT_SAMPLE_SIZE);
  }
  return currentExecutionState;
}

/**
 * Returns the current active execution state or initializes it.
 */
export function getExecutionState(): SimulationExecutionState {
  return ensureInitialized();
}

/**
 * Re-runs simulation with the given seed and optional sample size.
 */
export function runRecoverySimulation(
  seed: number = DEFAULT_DEMO_SEED,
  sampleSize: number = DEFAULT_SAMPLE_SIZE
): SimulationExecutionState {
  return initializeDemoData(seed, sampleSize);
}

/**
 * Returns canonical Ledger Summary directly from the ledger engine.
 */
export function getLedgerSummary(): LedgerSummary {
  return ensureInitialized().ledger;
}

/**
 * Returns all executed recovery cases.
 */
export function getRecoveryCases(): RecoveryCase[] {
  return ensureInitialized().executedCases;
}

/**
 * Returns recovery cases sorted by priorityScore in descending order.
 */
export function getTopPriorityCases(limit: number = 50): RecoveryCase[] {
  const cases = ensureInitialized().executedCases;
  return [...cases]
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
    .slice(0, limit);
}

/**
 * Returns raw synthetic dataset.
 */
export function getRawDataset(): SyntheticDataset {
  return ensureInitialized().dataset;
}

/**
 * Approves a case pending manual review, updates audit trail with operator attribution,
 * executes the recommended recovery action, updates ledger, and transitions state to APPROVED/EXECUTED.
 */
export function approveRecoveryCase(caseId: string, approver: string = 'Admin'): RecoveryCase | null {
  const state = ensureInitialized();
  const caseIndex = state.executedCases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) return null;

  const currentCase = state.executedCases[caseIndex];
  const now = new Date().toISOString();

  // Single-draw guarantee: compute agent recovery outcome
  const u = currentCase.randomDrawU ?? Math.random();
  const pAgent = currentCase.recoveryProbability ?? currentCase.agentProbability ?? 0.70;
  const pBaseline = currentCase.baselineProbability ?? 0.15;
  const agentRecovered = u <= pAgent;
  const baselineRecovered = currentCase.baselineRecovered ?? (u <= pBaseline);
  const incrementalRecoveryInr = agentRecovered && !baselineRecovered ? currentCase.revenueAtRiskInr : 0;

  const updatedCase: RecoveryCase = {
    ...currentCase,
    approvalStatus: 'APPROVED',
    approver,
    approvedAt: now,
    actionState: agentRecovered ? 'RECOVERED' : 'EXECUTED',
    policyRuleDecision: 'ALLOW',
    policyReason: `Approved by ${approver}. Manual authorization granted.`,
    policyDecision: {
      decision: 'APPROVED' as any,
      reason: `Approved by ${approver}`,
      evaluatedAt: now,
    },
    agentRecovered,
    baselineRecovered,
    randomDrawU: u,
    incrementalRecoveryInr,
    recoveredAmountInr: agentRecovered ? currentCase.revenueAtRiskInr : 0,
    executedAt: now,
  };

  state.executedCases[caseIndex] = updatedCase;

  // Update in-memory ledger if newly recovered
  if (agentRecovered && !currentCase.agentRecovered) {
    state.ledger.totalAgentRecoveredInr += updatedCase.revenueAtRiskInr;
    state.ledger.incrementalRecoveryInr += incrementalRecoveryInr;
    state.ledger.successfulAgentRecoveries += 1;
    if (state.ledger.totalAtRiskInr > 0) {
      state.ledger.agentRecoveryRatePct = Math.round(
        (state.ledger.totalAgentRecoveredInr / state.ledger.totalAtRiskInr) * 1000
      ) / 10;
    }
  }

  // Update audit trail with operator attribution
  recordAuditEntry({
    caseId: updatedCase.id,
    eventId: updatedCase.lastPaymentEventId ?? `evt_${updatedCase.id}`,
    action: `MANUAL_APPROVAL_EXECUTE_${updatedCase.recommendedIntervention ?? InterventionType.SMART_RETRY}`,
    intervention: updatedCase.recommendedIntervention ?? InterventionType.SMART_RETRY,
    policyDecision: 'ALLOW',
    reason: `Approved by ${approver}: Human approval verified for high-value case. Executed ${updatedCase.recommendedIntervention}.`,
    recoveryProbability: updatedCase.recoveryProbability ?? 0,
    riskScore: updatedCase.riskScore ?? 0,
    priorityScore: updatedCase.priorityScore ?? 0,
    revenueAtRiskInr: updatedCase.revenueAtRiskInr,
    environment: updatedCase.environment ?? 'DEMO',
    dryRun: updatedCase.dryRun ?? true,
    outcome: `Approved by ${approver} • ${agentRecovered ? 'Recovery Succeeded (₹' + updatedCase.revenueAtRiskInr.toLocaleString('en-IN') + ')' : 'Recovery Action Dispatched'}`,
    actionState: agentRecovered ? 'RECOVERED' : 'EXECUTED',
    approver,
    attribution: `Approved by ${approver}`,
    timestamp: now,
  });

  return updatedCase;
}

/**
 * Rejects a case pending manual review, updates audit trail with operator attribution,
 * cancels execution, and transitions state to REJECTED.
 */
export function rejectRecoveryCase(caseId: string, approver: string = 'Admin'): RecoveryCase | null {
  const state = ensureInitialized();
  const caseIndex = state.executedCases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) return null;

  const currentCase = state.executedCases[caseIndex];
  const now = new Date().toISOString();

  const updatedCase: RecoveryCase = {
    ...currentCase,
    approvalStatus: 'REJECTED',
    approver,
    rejectedAt: now,
    actionState: 'REJECTED',
    policyRuleDecision: 'BLOCK',
    policyReason: `Rejected by ${approver}. Action cancelled by operator.`,
    policyDecision: {
      decision: 'BLOCKED' as any,
      reason: `Rejected by ${approver}`,
      evaluatedAt: now,
    },
    agentRecovered: false,
    incrementalRecoveryInr: 0,
    recoveredAmountInr: 0,
  };

  state.executedCases[caseIndex] = updatedCase;
  state.ledger.failedRecoveries += 1;

  // Update audit trail with operator attribution
  recordAuditEntry({
    caseId: updatedCase.id,
    eventId: updatedCase.lastPaymentEventId ?? `evt_${updatedCase.id}`,
    action: `MANUAL_REJECTION_${updatedCase.recommendedIntervention ?? InterventionType.NO_ACTION}`,
    intervention: updatedCase.recommendedIntervention ?? InterventionType.NO_ACTION,
    policyDecision: 'BLOCK',
    reason: `Rejected by ${approver}: Operator aborted recovery action. Execution cancelled.`,
    recoveryProbability: updatedCase.recoveryProbability ?? 0,
    riskScore: updatedCase.riskScore ?? 0,
    priorityScore: updatedCase.priorityScore ?? 0,
    revenueAtRiskInr: updatedCase.revenueAtRiskInr,
    environment: updatedCase.environment ?? 'DEMO',
    dryRun: updatedCase.dryRun ?? true,
    outcome: `Rejected by ${approver} • Execution Aborted`,
    actionState: 'REJECTED',
    approver,
    attribution: `Rejected by ${approver}`,
    timestamp: now,
  });

  return updatedCase;
}
