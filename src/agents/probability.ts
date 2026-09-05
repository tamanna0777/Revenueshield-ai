/**
 * Canonical Recovery Probability Engine
 * RevenueShield AI
 * 
 * CRITICAL CORRECTNESS INVARIANT:
 * There is EXACTLY ONE source of truth for recovery probability (p_recover).
 * This canonical function is reused across prioritization, execution, and ledger.
 */

import { InterventionType } from '../types.ts';

/**
 * Baseline lift assumed for a blind, generic retry without diagnosis or personalization.
 * SYNTHETIC BASELINE PROXY ONLY (not actual production data).
 */
export const GENERIC_RETRY_LIFT = 0.08;

/**
 * Expected incremental effectiveness lift per intervention type.
 * Every actionable intervention lift MUST be >= GENERIC_RETRY_LIFT (0.08)
 * to maintain the monotonic recovery invariant. Range: 0.15 - 0.45.
 */
export const INTERVENTION_EFFECTIVENESS_LIFTS: Record<InterventionType, number> = {
  [InterventionType.SMART_RETRY]: 0.25,
  [InterventionType.PAYMENT_METHOD_UPDATE]: 0.38,
  [InterventionType.PERSONALIZED_PAYMENT_LINK]: 0.30,
  [InterventionType.CUSTOMER_NOTIFICATION]: 0.20,
  [InterventionType.ESCALATION_MANUAL_REVIEW]: 0.15,
  [InterventionType.NO_ACTION]: 0.08,
};

/**
 * Clamp any probability strictly to [0.0, 1.0]
 */
export function clampProbability(value: number): number {
  if (Number.isNaN(value)) {
    return 0.0;
  }
  if (value === Infinity) {
    return 1.0;
  }
  if (value === -Infinity) {
    return 0.0;
  }
  return Math.min(1.0, Math.max(0.0, value));
}

/**
 * Calculate canonical recovery probability (p_recover).
 * 
 * Formula:
 * clamp(clamped_propensity + intervention_lift, 0, 1)
 * 
 * If intervention is omitted or undefined, defaults to NO_ACTION (or base propensity).
 */
export function calculateRecoveryProbability(
  customerResponsePropensity: number,
  intervention: InterventionType = InterventionType.NO_ACTION
): number {
  const clampedPropensity = clampProbability(customerResponsePropensity);
  const lift = INTERVENTION_EFFECTIVENESS_LIFTS[intervention] ?? GENERIC_RETRY_LIFT;
  return clampProbability(clampedPropensity + lift);
}
