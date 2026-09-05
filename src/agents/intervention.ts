/**
 * Intervention & Prioritization Engine
 * RevenueShield AI
 * 
 * CORE PRINCIPLE:
 * Prioritization (ranking who to address first) is strictly decoupled from
 * Intervention Selection (determining what clinical action to take).
 * 
 * Priority Score NEVER influences or alters the selected intervention.
 */

import { FailureCause, InterventionType, RecoveryCase } from '../types.ts';
import { calculateRecoveryProbability, clampProbability } from './probability.ts';

/**
 * Multiplier reflecting how inherently structural vs transient a failure cause is.
 */
export const CAUSE_MULTIPLIERS: Record<FailureCause, number> = {
  [FailureCause.UNKNOWN]: 1.2,
  [FailureCause.CARD_BLOCKED]: 1.1,
  [FailureCause.EXPIRED_CARD]: 1.1,
  [FailureCause.ISSUER_DECLINED]: 1.0,
  [FailureCause.INSUFFICIENT_FUNDS]: 0.9,
  [FailureCause.BANK_TIMEOUT]: 0.9,
};

/**
 * Calculates the Risk Score [0, 100].
 * 
 * Formula:
 * min(100, round(100 * (1 - customer_response_propensity) * cause_multiplier))
 * Explicitly clamped to [0, 100].
 */
export function calculateRiskScore(
  customerResponsePropensity: number,
  cause: FailureCause | string
): number {
  const clampedPropensity = clampProbability(customerResponsePropensity);
  const multiplier = (cause in CAUSE_MULTIPLIERS)
    ? CAUSE_MULTIPLIERS[cause as FailureCause]
    : CAUSE_MULTIPLIERS[FailureCause.UNKNOWN];

  const rawScore = Math.round(100 * (1 - clampedPropensity) * multiplier);
  return Math.min(100, Math.max(0, rawScore));
}

/**
 * Calculates the Urgency Weight.
 * 
 * Formula:
 * urgency_weight = 1.0 + 0.15 * min(attempt_count - 1, 3)
 * 
 * Guards:
 * - Negative or malformed attempt_count is clamped to at least 1.
 */
export function calculateUrgencyWeight(attemptCount: number): number {
  const safeAttempts = Number.isFinite(attemptCount) ? Math.max(1, Math.floor(attemptCount)) : 1;
  const attemptsOverOne = Math.max(0, safeAttempts - 1);
  return 1.0 + 0.15 * Math.min(attemptsOverOne, 3);
}

/**
 * Calculates the Priority Score.
 * 
 * Formula:
 * priority_score = revenue_at_risk_inr * recovery_probability * (risk_score / 100) * urgency_weight
 * 
 * Guards:
 * - revenue_at_risk_inr clamped to >= 0 (negative revenue normalized to 0).
 */
export function calculatePriorityScore(
  revenueAtRiskInr: number,
  recoveryProbability: number,
  riskScore: number,
  urgencyWeight: number
): number {
  const safeRevenue = Number.isFinite(revenueAtRiskInr) ? Math.max(0, revenueAtRiskInr) : 0;
  const safeProbability = clampProbability(recoveryProbability);
  const safeRiskScore = Math.min(100, Math.max(0, riskScore));
  const safeUrgency = Number.isFinite(urgencyWeight) ? Math.max(1.0, urgencyWeight) : 1.0;

  const score = safeRevenue * safeProbability * (safeRiskScore / 100) * safeUrgency;
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Recommends an intervention based purely on root cause, retry attempts,
 * and customer behavior.
 * 
 * NOTE: This function is COMPLETELY INDEPENDENT from priority score.
 */
export function decideIntervention(recoveryCase: Pick<RecoveryCase, 'failureCause' | 'attemptCount' | 'customerResponsePropensity'>): {
  recommendedIntervention: InterventionType;
  reasoning: string;
} {
  const { failureCause, attemptCount } = recoveryCase;
  const safeAttempts = Number.isFinite(attemptCount) ? Math.max(1, Math.floor(attemptCount)) : 1;

  if (safeAttempts >= 4) {
    return {
      recommendedIntervention: InterventionType.ESCALATION_MANUAL_REVIEW,
      reasoning: `Subscription has experienced ${safeAttempts} consecutive failures; escalating for manual merchant review.`,
    };
  }

  switch (failureCause) {
    case FailureCause.EXPIRED_CARD:
      return {
        recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
        reasoning: 'Card expiration detected. Sending secure self-service payment update link via SMS & email.',
      };

    case FailureCause.CARD_BLOCKED:
      return {
        recommendedIntervention: InterventionType.PAYMENT_METHOD_UPDATE,
        reasoning: 'Card reported blocked/inactive. Prompting customer to register an alternate credit/debit card or UPI ID.',
      };

    case FailureCause.BANK_TIMEOUT:
      return {
        recommendedIntervention: InterventionType.SMART_RETRY,
        reasoning: 'Transient network/issuer gateway timeout. Scheduling automated smart retry during low-traffic bank window.',
      };

    case FailureCause.INSUFFICIENT_FUNDS:
      if (safeAttempts <= 1) {
        return {
          recommendedIntervention: InterventionType.CUSTOMER_NOTIFICATION,
          reasoning: 'Temporary balance shortfall. Dispatching discreet account balance replenishment reminder.',
        };
      }
      return {
        recommendedIntervention: InterventionType.PERSONALIZED_PAYMENT_LINK,
        reasoning: 'Repeated balance shortfall. Providing personalized instant payment link offering alternate rails (UPI, Netbanking).',
      };

    case FailureCause.ISSUER_DECLINED:
      if (safeAttempts >= 3) {
        return {
          recommendedIntervention: InterventionType.ESCALATION_MANUAL_REVIEW,
          reasoning: 'Repeated bank issuer rejection without specific code. Flagged for merchant customer success follow-up.',
        };
      }
      return {
        recommendedIntervention: InterventionType.PERSONALIZED_PAYMENT_LINK,
        reasoning: 'Bank issuer declined transaction. Sending one-click personalized checkout link for secondary card/UPI.',
      };

    case FailureCause.UNKNOWN:
    default:
      if (safeAttempts >= 2) {
        return {
          recommendedIntervention: InterventionType.ESCALATION_MANUAL_REVIEW,
          reasoning: 'Unclassified recurring payment failure. Escalating to prevent subscription termination.',
        };
      }
      return {
        recommendedIntervention: InterventionType.CUSTOMER_NOTIFICATION,
        reasoning: 'Unclassified initial failure. Notifying customer to verify payment source details.',
      };
  }
}

/**
 * Computes derived risk, urgency, and priority scores for a RecoveryCase.
 * 
 * Reuses the canonical recovery probability function.
 * Does NOT alter or re-decide the intervention.
 */
export function scorePriority(recoveryCase: RecoveryCase): RecoveryCase {
  const safeRevenue = Math.max(0, recoveryCase.revenueAtRiskInr ?? 0);
  const safePropensity = clampProbability(recoveryCase.customerResponsePropensity ?? 0.5);
  
  // Obtain canonical recovery probability using the case's intervention
  const canonicalProbability = calculateRecoveryProbability(
    safePropensity,
    recoveryCase.recommendedIntervention ?? InterventionType.NO_ACTION
  );

  const riskScore = calculateRiskScore(safePropensity, recoveryCase.failureCause);
  const urgencyWeight = calculateUrgencyWeight(recoveryCase.attemptCount ?? 1);
  const priorityScore = calculatePriorityScore(
    safeRevenue,
    canonicalProbability,
    riskScore,
    urgencyWeight
  );

  return {
    ...recoveryCase,
    revenueAtRiskInr: safeRevenue,
    customerResponsePropensity: safePropensity,
    recoveryProbability: canonicalProbability,
    riskScore,
    urgencyWeight,
    priorityScore,
  };
}
