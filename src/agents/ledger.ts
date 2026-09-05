/**
 * Financial Recovery & Incremental Ledger Engine
 * RevenueShield AI
 * 
 * Aggregates simulated or executed recovery cases to compute:
 * - total_at_risk_inr
 * - total_baseline_recovered_inr
 * - total_agent_recovered_inr
 * - incremental_recovery_inr
 * - incremental_recovery_pct
 * - recovery_rate_pct
 * - segmented breakdowns (root cause, intervention, tier)
 * 
 * CORE FINANCIAL INVARIANTS:
 * 1. incremental_recovery_inr = total_agent_recovered_inr - total_baseline_recovered_inr >= 0
 * 2. incremental_recovery_pct = incremental_recovery_inr / total_at_risk_inr (0 if total_at_risk_inr == 0)
 * 3. Recovered amounts are strictly finite and non-negative.
 * 4. Zero cases handled safely without NaN or Infinity.
 */

import { FailureCause, InterventionType, RecoveryCase } from '../types.ts';

export interface SegmentedMetric {
  category: string;
  casesCount: number;
  totalAtRiskInr: number;
  baselineRecoveredInr: number;
  agentRecoveredInr: number;
  incrementalRecoveryInr: number;
  recoveryRatePct: number;
}

export interface DetailedLedger {
  casesProcessed: number;
  totalAtRiskInr: number;
  totalBaselineRecoveredInr: number;
  totalAgentRecoveredInr: number;
  incrementalRecoveryInr: number;
  incrementalRecoveryPct: number; // e.g. 14.5 for 14.5%
  baselineRecoveryRatePct: number;
  agentRecoveryRatePct: number;
  averageRecoveryProbability: number;
  successfulAgentRecoveries: number;
  successfulBaselineRecoveries: number;
  failedRecoveries: number;
  byRootCause: Record<FailureCause, SegmentedMetric>;
  byIntervention: Record<InterventionType, SegmentedMetric>;
}

export type LedgerSummary = DetailedLedger;

/**
 * Summarizes an array of executed recovery cases into an auditable financial ledger.
 */
export function summarizeLedger(cases: RecoveryCase[]): DetailedLedger {
  let totalAtRiskInr = 0;
  let totalBaselineRecoveredInr = 0;
  let totalAgentRecoveredInr = 0;
  let sumProbabilities = 0;
  let successfulAgentRecoveries = 0;
  let successfulBaselineRecoveries = 0;

  // Initialize Segmented maps
  const byRootCause: Record<FailureCause, SegmentedMetric> = {
    [FailureCause.UNKNOWN]: { category: 'UNKNOWN', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [FailureCause.CARD_BLOCKED]: { category: 'CARD_BLOCKED', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [FailureCause.EXPIRED_CARD]: { category: 'EXPIRED_CARD', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [FailureCause.ISSUER_DECLINED]: { category: 'ISSUER_DECLINED', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [FailureCause.INSUFFICIENT_FUNDS]: { category: 'INSUFFICIENT_FUNDS', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [FailureCause.BANK_TIMEOUT]: { category: 'BANK_TIMEOUT', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
  };

  const byIntervention: Record<InterventionType, SegmentedMetric> = {
    [InterventionType.SMART_RETRY]: { category: 'SMART_RETRY', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [InterventionType.PAYMENT_METHOD_UPDATE]: { category: 'PAYMENT_METHOD_UPDATE', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [InterventionType.PERSONALIZED_PAYMENT_LINK]: { category: 'PERSONALIZED_PAYMENT_LINK', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [InterventionType.CUSTOMER_NOTIFICATION]: { category: 'CUSTOMER_NOTIFICATION', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [InterventionType.ESCALATION_MANUAL_REVIEW]: { category: 'ESCALATION_MANUAL_REVIEW', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
    [InterventionType.NO_ACTION]: { category: 'NO_ACTION', casesCount: 0, totalAtRiskInr: 0, baselineRecoveredInr: 0, agentRecoveredInr: 0, incrementalRecoveryInr: 0, recoveryRatePct: 0 },
  };

  for (const c of cases) {
    const revenue = Math.max(0, c.revenueAtRiskInr ?? 0);
    const baselineRecoveredAmount = Math.min(revenue, Math.max(0, c.baselineRecoveredAmountInr ?? (c.baselineRecovered ? revenue : 0)));
    const agentRecoveredAmount = Math.min(revenue, Math.max(0, c.agentRecoveredAmountInr ?? (c.agentRecovered ? revenue : (c.recoveredAmountInr ?? 0))));
    const prob = c.recoveryProbability ?? c.agentProbability ?? 0;

    totalAtRiskInr += revenue;
    totalBaselineRecoveredInr += baselineRecoveredAmount;
    totalAgentRecoveredInr += agentRecoveredAmount;
    sumProbabilities += prob;

    if (c.agentRecovered) {
      successfulAgentRecoveries++;
    }
    if (c.baselineRecovered) {
      successfulBaselineRecoveries++;
    }

    // Root Cause segmentation
    const cause = c.failureCause in byRootCause ? c.failureCause : FailureCause.UNKNOWN;
    const causeSeg = byRootCause[cause];
    causeSeg.casesCount++;
    causeSeg.totalAtRiskInr += revenue;
    causeSeg.baselineRecoveredInr += baselineRecoveredAmount;
    causeSeg.agentRecoveredInr += agentRecoveredAmount;
    causeSeg.incrementalRecoveryInr += Math.max(0, agentRecoveredAmount - baselineRecoveredAmount);

    // Intervention segmentation
    const intervention = (c.recommendedIntervention && c.recommendedIntervention in byIntervention)
      ? c.recommendedIntervention
      : InterventionType.NO_ACTION;
    const intSeg = byIntervention[intervention];
    intSeg.casesCount++;
    intSeg.totalAtRiskInr += revenue;
    intSeg.baselineRecoveredInr += baselineRecoveredAmount;
    intSeg.agentRecoveredInr += agentRecoveredAmount;
    intSeg.incrementalRecoveryInr += Math.max(0, agentRecoveredAmount - baselineRecoveredAmount);
  }

  // Calculate percentages with strict zero-division protection
  const casesCount = cases.length;
  const incrementalRecoveryInr = Math.max(0, totalAgentRecoveredInr - totalBaselineRecoveredInr);

  const incrementalRecoveryPct = totalAtRiskInr > 0
    ? Math.round(((incrementalRecoveryInr / totalAtRiskInr) * 100) * 100) / 100
    : 0;

  const baselineRecoveryRatePct = totalAtRiskInr > 0
    ? Math.round(((totalBaselineRecoveredInr / totalAtRiskInr) * 100) * 100) / 100
    : 0;

  const agentRecoveryRatePct = totalAtRiskInr > 0
    ? Math.round(((totalAgentRecoveredInr / totalAtRiskInr) * 100) * 100) / 100
    : 0;

  const averageRecoveryProbability = casesCount > 0
    ? Math.round((sumProbabilities / casesCount) * 1000) / 1000
    : 0;

  // Segment recovery rate percentages
  for (const seg of Object.values(byRootCause)) {
    seg.recoveryRatePct = seg.totalAtRiskInr > 0
      ? Math.round(((seg.agentRecoveredInr / seg.totalAtRiskInr) * 100) * 10) / 10
      : 0;
  }

  for (const seg of Object.values(byIntervention)) {
    seg.recoveryRatePct = seg.totalAtRiskInr > 0
      ? Math.round(((seg.agentRecoveredInr / seg.totalAtRiskInr) * 100) * 10) / 10
      : 0;
  }

  return {
    casesProcessed: casesCount,
    totalAtRiskInr: Math.round(totalAtRiskInr * 100) / 100,
    totalBaselineRecoveredInr: Math.round(totalBaselineRecoveredInr * 100) / 100,
    totalAgentRecoveredInr: Math.round(totalAgentRecoveredInr * 100) / 100,
    incrementalRecoveryInr: Math.round(incrementalRecoveryInr * 100) / 100,
    incrementalRecoveryPct,
    baselineRecoveryRatePct,
    agentRecoveryRatePct,
    averageRecoveryProbability,
    successfulAgentRecoveries,
    successfulBaselineRecoveries,
    failedRecoveries: casesCount - successfulAgentRecoveries,
    byRootCause,
    byIntervention,
  };
}
