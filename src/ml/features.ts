/**
 * Machine Learning Feature Extraction
 * RevenueShield AI (Phase 6 Prototype / Analytical Foundation)
 * 
 * STRICT NO-LEAKAGE GUARANTEE:
 * Only features observable at prediction time (before any recovery intervention occurs)
 * are extracted. Post-intervention values (agent_recovered, baseline_recovered, etc.)
 * are STRICTLY excluded from the feature vector.
 */

import { Customer, FailureCause, RecoveryCase } from '../types.ts';

export interface RecoveryFeatureVector {
  caseId: string;
  timestamp: string;
  // Features available at prediction time
  customerResponsePropensity: number; // 0.0 to 1.0
  logRevenueAtRisk: number;           // log1p(revenueAtRiskInr)
  attemptCount: number;               // 1 to 4+
  tenureMonths: number;               // customer account tenure
  // Root cause one-hot encodings
  isInsufficientFunds: number;
  isBankTimeout: number;
  isIssuerDeclined: number;
  isExpiredCard: number;
  isCardBlocked: number;
  isUnknownCause: number;
  // Segment one-hot encodings
  isEnterprise: number;
  isMidMarket: number;
  isStartup: number;
  isSmb: number;
  // Target label (only populated if ground truth outcome is available for training)
  targetRecovered?: number; // 1 = recovered, 0 = not recovered
}

/**
 * Extracts a feature vector from a RecoveryCase and optional Customer record.
 * 
 * PREDICTION-TIME ONLY: No future leakages.
 */
export function extractFeatures(
  recoveryCase: RecoveryCase,
  customer?: Customer,
  actualRecoveryOutcome?: boolean
): RecoveryFeatureVector {
  const revenue = Math.max(0, recoveryCase.revenueAtRiskInr ?? 0);
  const propensity = Math.max(0, Math.min(1, recoveryCase.customerResponsePropensity ?? 0.5));
  const attempts = Math.max(1, recoveryCase.attemptCount ?? 1);
  const tenure = customer?.tenureMonths ?? 6;
  const segment = customer?.segment ?? 'SMB';
  const cause = recoveryCase.failureCause ?? FailureCause.UNKNOWN;

  return {
    caseId: recoveryCase.id,
    timestamp: recoveryCase.lastAttemptAt ?? new Date().toISOString(),
    customerResponsePropensity: propensity,
    logRevenueAtRisk: Math.log1p(revenue),
    attemptCount: attempts,
    tenureMonths: tenure,
    isInsufficientFunds: cause === FailureCause.INSUFFICIENT_FUNDS ? 1 : 0,
    isBankTimeout: cause === FailureCause.BANK_TIMEOUT ? 1 : 0,
    isIssuerDeclined: cause === FailureCause.ISSUER_DECLINED ? 1 : 0,
    isExpiredCard: cause === FailureCause.EXPIRED_CARD ? 1 : 0,
    isCardBlocked: cause === FailureCause.CARD_BLOCKED ? 1 : 0,
    isUnknownCause: cause === FailureCause.UNKNOWN ? 1 : 0,
    isEnterprise: segment === 'ENTERPRISE' ? 1 : 0,
    isMidMarket: segment === 'MID_MARKET' ? 1 : 0,
    isStartup: segment === 'STARTUP' ? 1 : 0,
    isSmb: segment === 'SMB' ? 1 : 0,
    targetRecovered: actualRecoveryOutcome !== undefined ? (actualRecoveryOutcome ? 1 : 0) : undefined,
  };
}

/**
 * Converts feature vector to numeric array for model evaluation.
 * Feature names list matches index-for-index.
 */
export const FEATURE_NAMES = [
  'customerResponsePropensity',
  'logRevenueAtRisk',
  'attemptCount',
  'tenureMonths',
  'isInsufficientFunds',
  'isBankTimeout',
  'isIssuerDeclined',
  'isExpiredCard',
  'isCardBlocked',
  'isUnknownCause',
  'isEnterprise',
  'isMidMarket',
  'isStartup',
  'isSmb',
] as const;

export function vectorToNumericArray(fv: RecoveryFeatureVector): number[] {
  return [
    fv.customerResponsePropensity,
    fv.logRevenueAtRisk,
    fv.attemptCount,
    fv.tenureMonths,
    fv.isInsufficientFunds,
    fv.isBankTimeout,
    fv.isIssuerDeclined,
    fv.isExpiredCard,
    fv.isCardBlocked,
    fv.isUnknownCause,
    fv.isEnterprise,
    fv.isMidMarket,
    fv.isStartup,
    fv.isSmb,
  ];
}
