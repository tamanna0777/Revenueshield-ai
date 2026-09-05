/**
 * Dashboard Aggregation Service
 * RevenueShield AI (Phase 7 & Phase 8 Service Layer)
 * 
 * Aggregates analytical views for the B2B SaaS dashboard.
 * strictly ensures all numbers reconcile with the canonical LedgerSummary.
 */

import {
  FailureCause,
  InterventionType,
  RecoveryCase,
} from '../types.ts';
import {
  getExecutionState,
  getLedgerSummary,
  getTopPriorityCases,
  getRecoveryCases,
} from './revenueRecovery.ts';
import { LedgerSummary } from '../agents/ledger.ts';

export interface DashboardTopKpis {
  totalAtRiskInr: number;
  totalBaselineRecoveredInr: number;
  totalAgentRecoveredInr: number;
  incrementalRecoveryInr: number;
  agentRecoveryRatePct: number;
  baselineRecoveryRatePct: number;
  incrementalRecoveryPct: number;
  casesProcessed: number;
  agentRecoveredCount: number;
  baselineRecoveredCount: number;
}

export interface FailureCauseBreakdownItem {
  cause: FailureCause;
  label: string;
  count: number;
  percentageOfCases: number;
  revenueAtRiskInr: number;
  baselineRecoveredInr: number;
  agentRecoveredInr: number;
  incrementalRecoveryInr: number;
  recoveryRatePct: number;
  description: string;
}

export interface InterventionBreakdownItem {
  intervention: InterventionType;
  label: string;
  count: number;
  revenueAtRiskInr: number;
  agentRecoveredInr: number;
  recoveryRatePct: number;
  averageLiftPct: number;
  description: string;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  caseId: string;
  customerName: string;
  amountInr: number;
  failureCause: FailureCause;
  intervention: InterventionType;
  eventType: 'DETECTED' | 'DIAGNOSED' | 'PLAN_SELECTED' | 'RECOVERY_EXECUTED';
  status: 'RECOVERED' | 'FAILED' | 'PENDING';
  message: string;
}

const FAILURE_CAUSE_LABELS: Record<FailureCause, { label: string; description: string }> = {
  [FailureCause.INSUFFICIENT_FUNDS]: {
    label: 'Insufficient Funds',
    description: 'Customer account balance low at subscription billing time',
  },
  [FailureCause.BANK_TIMEOUT]: {
    label: 'Bank Timeout',
    description: 'Transient network or gateway timeout during authorization',
  },
  [FailureCause.ISSUER_DECLINED]: {
    label: 'Issuer Declined',
    description: 'Issuing bank policy or risk rule blocked transaction',
  },
  [FailureCause.EXPIRED_CARD]: {
    label: 'Expired Card',
    description: 'Stored card credential has passed expiration date',
  },
  [FailureCause.CARD_BLOCKED]: {
    label: 'Card Blocked',
    description: 'Card flagged as lost, stolen, or frozen by holder',
  },
  [FailureCause.UNKNOWN]: {
    label: 'Unknown Error',
    description: 'Uncategorized gateway or merchant routing response',
  },
};

const INTERVENTION_LABELS: Record<InterventionType, { label: string; description: string; lift: number }> = {
  [InterventionType.SMART_RETRY]: {
    label: 'Smart Retry',
    description: 'Optimal off-peak schedule based on banking clearing windows',
    lift: 0.25,
  },
  [InterventionType.PAYMENT_METHOD_UPDATE]: {
    label: 'Payment Method Update',
    description: 'Hosted update link with auto-tokenization prompt',
    lift: 0.38,
  },
  [InterventionType.PERSONALIZED_PAYMENT_LINK]: {
    label: 'Personalized Payment Link',
    description: 'Direct multi-rail payment link (UPI, Netbanking, Cards)',
    lift: 0.32,
  },
  [InterventionType.CUSTOMER_NOTIFICATION]: {
    label: 'Customer Notification',
    description: 'Urgent dunning notification via Email and WhatsApp',
    lift: 0.18,
  },
  [InterventionType.ESCALATION_MANUAL_REVIEW]: {
    label: 'Manual Escalation',
    description: 'High-value customer success ticket routing',
    lift: 0.15,
  },
  [InterventionType.NO_ACTION]: {
    label: 'No Action',
    description: 'Terminal decline state or cooldown window active',
    lift: 0.08,
  },
};

/**
 * Returns canonical top KPIs matching the ledger.
 */
export function getDashboardSummary(): DashboardTopKpis {
  const ledger: LedgerSummary = getLedgerSummary();
  const cases = getRecoveryCases();

  const agentRecoveredCount = cases.filter((c) => c.agentRecovered).length;
  const baselineRecoveredCount = cases.filter((c) => c.baselineRecovered).length;

  return {
    totalAtRiskInr: ledger.totalAtRiskInr,
    totalBaselineRecoveredInr: ledger.totalBaselineRecoveredInr,
    totalAgentRecoveredInr: ledger.totalAgentRecoveredInr,
    incrementalRecoveryInr: ledger.incrementalRecoveryInr,
    agentRecoveryRatePct: ledger.agentRecoveryRatePct,
    baselineRecoveryRatePct: ledger.baselineRecoveryRatePct,
    incrementalRecoveryPct: ledger.incrementalRecoveryPct,
    casesProcessed: ledger.casesProcessed,
    agentRecoveredCount,
    baselineRecoveredCount,
  };
}

/**
 * Returns breakdown by Failure Cause with financial metrics.
 */
export function getFailureCauseMetrics(): FailureCauseBreakdownItem[] {
  const ledger = getLedgerSummary();
  const totalCases = ledger.casesProcessed || 1;

  const result: FailureCauseBreakdownItem[] = [];

  for (const cause of Object.values(FailureCause)) {
    const segment = ledger.byRootCause?.[cause];
    const meta = FAILURE_CAUSE_LABELS[cause] || {
      label: cause,
      description: 'Payment failure cause',
    };

    if (segment) {
      result.push({
        cause,
        label: meta.label,
        count: segment.casesCount,
        percentageOfCases: Math.round((segment.casesCount / totalCases) * 1000) / 10,
        revenueAtRiskInr: segment.totalAtRiskInr,
        baselineRecoveredInr: segment.baselineRecoveredInr,
        agentRecoveredInr: segment.agentRecoveredInr,
        incrementalRecoveryInr: segment.incrementalRecoveryInr,
        recoveryRatePct: segment.recoveryRatePct,
        description: meta.description,
      });
    } else {
      result.push({
        cause,
        label: meta.label,
        count: 0,
        percentageOfCases: 0,
        revenueAtRiskInr: 0,
        baselineRecoveredInr: 0,
        agentRecoveredInr: 0,
        incrementalRecoveryInr: 0,
        recoveryRatePct: 0,
        description: meta.description,
      });
    }
  }

  // Sort descending by revenue at risk
  return result.sort((a, b) => b.revenueAtRiskInr - a.revenueAtRiskInr);
}

/**
 * Returns breakdown by Intervention strategy with effectiveness and financial metrics.
 */
export function getInterventionMetrics(): InterventionBreakdownItem[] {
  const ledger = getLedgerSummary();
  const result: InterventionBreakdownItem[] = [];

  for (const intervention of Object.values(InterventionType)) {
    const segment = ledger.byIntervention?.[intervention];
    const meta = INTERVENTION_LABELS[intervention] || {
      label: intervention,
      description: 'Recovery strategy',
      lift: 0.15,
    };

    if (segment) {
      result.push({
        intervention,
        label: meta.label,
        count: segment.casesCount,
        revenueAtRiskInr: segment.totalAtRiskInr,
        agentRecoveredInr: segment.agentRecoveredInr,
        recoveryRatePct: segment.recoveryRatePct,
        averageLiftPct: Math.round(meta.lift * 100),
        description: meta.description,
      });
    } else {
      result.push({
        intervention,
        label: meta.label,
        count: 0,
        revenueAtRiskInr: 0,
        agentRecoveredInr: 0,
        recoveryRatePct: 0,
        averageLiftPct: Math.round(meta.lift * 100),
        description: meta.description,
      });
    }
  }

  // Sort descending by revenue at risk
  return result.sort((a, b) => b.revenueAtRiskInr - a.revenueAtRiskInr);
}

/**
 * Returns a live-feeling activity feed built directly from the simulated cases.
 */
export function getRecentExecutions(limit: number = 20): ActivityFeedItem[] {
  const cases = getRecoveryCases();
  if (cases.length === 0) return [];

  // Sort by simulated execution timestamp or latest attempt
  const sorted = [...cases].sort((a, b) => {
    const tA = a.executedAt || a.lastAttemptAt || '';
    const tB = b.executedAt || b.lastAttemptAt || '';
    return tB.localeCompare(tA);
  });

  const feed: ActivityFeedItem[] = [];

  for (let i = 0; i < Math.min(limit, sorted.length); i++) {
    const c = sorted[i];
    const interventionLabel = INTERVENTION_LABELS[c.recommendedIntervention!]?.label || c.recommendedIntervention;

    feed.push({
      id: `act_${c.id}_${i}`,
      timestamp: c.executedAt || c.lastAttemptAt || new Date().toISOString(),
      caseId: c.id,
      customerName: c.customerName,
      amountInr: c.revenueAtRiskInr,
      failureCause: c.failureCause,
      intervention: c.recommendedIntervention!,
      eventType: 'RECOVERY_EXECUTED',
      status: c.agentRecovered ? 'RECOVERED' : 'FAILED',
      message: c.agentRecovered
        ? `Recovered ₹${c.revenueAtRiskInr.toLocaleString('en-IN')} via ${interventionLabel}`
        : `Execution completed: ${interventionLabel} - Unrecovered, queueing next cycle`,
    });
  }

  return feed;
}
