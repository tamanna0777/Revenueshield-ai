/**
 * Policy & Guardrails Engine
 * RevenueShield AI (Phase 10)
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * AI recommendations are NOT permissions to act.
 * ML probability or priority score alone NEVER authorizes a financial action.
 * 
 * Pipeline:
 * DIAGNOSE -> INTERVENTION -> PRIORITY -> POLICY -> APPROVAL (if required) -> EXECUTE -> AUDIT
 */

import {
  AppEnvironment,
  FailureCause,
  InterventionType,
  PolicyConfig,
  PolicyDecisionType,
  PolicyEvaluationResult,
  PolicyRuleDecision,
  RecoveryCase,
} from '../types.ts';

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  maxAutomatedAttempts: 3,
  maxInterventionAttempts: 3,
  maxRetryAttemptsPerCase: 3,
  cooldownMinutes: 60,
  approvalAmountThresholdInr: 50000,
  manualApprovalThresholdInr: 50000,
  highValueThresholdInr: 50000,
  minimumRecoveryProbability: 0.15,
  minRecoveryProbability: 0.15,
  maxRiskScoreForAutonomousRecovery: 85,
  allowPaymentMethodUpdate: true,
  allowPaymentLink: true,
  allowSmartRetry: true,
  killSwitchEnabled: false,
};

let activePolicyConfig: PolicyConfig = { ...DEFAULT_POLICY_CONFIG };

/**
 * Returns a clone of the current in-memory policy configuration.
 */
export function getPolicyConfig(): PolicyConfig {
  return { ...activePolicyConfig };
}

/**
 * Updates the in-memory policy configuration.
 */
export function updatePolicyConfig(partialConfig: Partial<PolicyConfig>): PolicyConfig {
  const maxAttempts =
    partialConfig.maxRetryAttemptsPerCase ??
    partialConfig.maxInterventionAttempts ??
    partialConfig.maxAutomatedAttempts;
  const threshold =
    partialConfig.highValueThresholdInr ??
    partialConfig.manualApprovalThresholdInr ??
    partialConfig.approvalAmountThresholdInr;
  const minProb = partialConfig.minRecoveryProbability ?? partialConfig.minimumRecoveryProbability;
  const maxRisk =
    partialConfig.maxRiskScoreForAutonomousRecovery ??
    activePolicyConfig.maxRiskScoreForAutonomousRecovery ??
    85;

  activePolicyConfig = {
    ...activePolicyConfig,
    ...partialConfig,
    ...(maxAttempts != null
      ? {
          maxInterventionAttempts: maxAttempts,
          maxAutomatedAttempts: maxAttempts,
          maxRetryAttemptsPerCase: maxAttempts,
        }
      : {}),
    ...(threshold != null
      ? {
          manualApprovalThresholdInr: threshold,
          approvalAmountThresholdInr: threshold,
          highValueThresholdInr: threshold,
        }
      : {}),
    ...(minProb != null ? { minRecoveryProbability: minProb, minimumRecoveryProbability: minProb } : {}),
    ...(maxRisk != null ? { maxRiskScoreForAutonomousRecovery: maxRisk } : {}),
  };
  return { ...activePolicyConfig };
}

/**
 * Resets policy configuration to default values.
 */
export function resetPolicyConfig(): PolicyConfig {
  activePolicyConfig = { ...DEFAULT_POLICY_CONFIG };
  return { ...activePolicyConfig };
}

/**
 * Toggles or sets the global execution kill switch.
 */
export function setKillSwitch(enabled: boolean): boolean {
  activePolicyConfig.killSwitchEnabled = Boolean(enabled);
  return activePolicyConfig.killSwitchEnabled;
}

/**
 * Returns true if the global execution kill switch is currently enabled.
 */
export function isKillSwitchEnabled(): boolean {
  return activePolicyConfig.killSwitchEnabled;
}

export interface PolicyEvaluationParams {
  recoveryCase: RecoveryCase;
  targetEnvironment?: AppEnvironment;
  lastExecutedAt?: string;
  config?: PolicyConfig;
}

/**
 * Evaluates a RecoveryCase against deterministic policy rules.
 * 
 * Rules are evaluated in strict priority hierarchy:
 * 1. LIVE execution barrier (Live mode is disabled in this build)
 * 2. Global kill switch (Blocks all actions immediately)
 * 3. NO_ACTION prohibition
 * 4. Manual escalation check (Requires approval)
 * 5. Excessive attempt limit (Blocks automated retries)
 * 6. Cooldown period (Blocks rapid repeated executions)
 * 7. High-value threshold (Bounded autonomy: requires operational approval)
 * 8. Strategy toggle checks (allowSmartRetry, allowPaymentMethodUpdate, allowPaymentLink)
 * 9. Minimum recovery probability threshold
 * 10. Automated action authorization
 */
export function evaluatePolicy({
  recoveryCase,
  targetEnvironment,
  lastExecutedAt,
  config,
}: PolicyEvaluationParams): PolicyEvaluationResult {
  const activeConfig = config ?? activePolicyConfig;
  const evaluatedAt = new Date().toISOString();
  const intervention =
    recoveryCase.recommendedIntervention ??
    recoveryCase.optimalIntervention ??
    InterventionType.NO_ACTION;
  const attempts = recoveryCase.attemptCount ?? 1;
  const revenue = Math.max(0, recoveryCase.revenueAtRiskInr ?? 0);
  const probability =
    recoveryCase.recoveryProbability ??
    recoveryCase.calculatedProbability ??
    0;
  const cause = recoveryCase.failureCause ?? FailureCause.UNKNOWN;

  // 1. LIVE Execution Safety Barrier
  const env = targetEnvironment ?? recoveryCase.environment ?? 'DEMO';
  if (env === 'LIVE') {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'ENVIRONMENT_LIVE_DISABLED',
      reason: 'Live execution is disabled in this build.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 2. Global Execution Kill Switch
  if (activeConfig.killSwitchEnabled) {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'GLOBAL_KILL_SWITCH',
      reason: 'Execution kill switch enabled; action blocked.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 3. NO_ACTION is explicitly blocked from execution
  if (intervention === InterventionType.NO_ACTION) {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'NO_ACTION_PROHIBITED',
      reason: 'No action recommended; execution blocked.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 4. Manual Review Escalations require explicit operational approval
  if (intervention === InterventionType.ESCALATION_MANUAL_REVIEW) {
    return {
      decision: 'REQUIRE_APPROVAL',
      policyDecisionType: PolicyDecisionType.REQUIRES_APPROVAL,
      ruleMatched: 'MANUAL_REVIEW_ESCALATION',
      reason: 'Manual review escalation requires operational approval.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 5. Attempt limit: prevent infinite automated retries
  if (attempts >= activeConfig.maxAutomatedAttempts) {
    if (intervention === InterventionType.SMART_RETRY) {
      return {
        decision: 'BLOCK',
        policyDecisionType: PolicyDecisionType.BLOCKED,
        ruleMatched: 'MAX_ATTEMPTS_EXCEEDED',
        reason: 'Maximum automated attempts reached; further retry blocked.',
        evaluatedAt,
        configSnapshot: { ...activeConfig },
      };
    }
    return {
      decision: 'REQUIRE_APPROVAL',
      policyDecisionType: PolicyDecisionType.REQUIRES_APPROVAL,
      ruleMatched: 'MAX_ATTEMPTS_EXCEEDED',
      reason: 'Maximum automated attempts reached; approval required.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 6. Cooldown check: prevent repeated executions within cooldown window
  const priorExecution = lastExecutedAt;
  if (priorExecution) {
    const priorTime = new Date(priorExecution).getTime();
    if (!Number.isNaN(priorTime)) {
      const elapsedMinutes = (Date.now() - priorTime) / (1000 * 60);
      if (elapsedMinutes >= 0 && elapsedMinutes < activeConfig.cooldownMinutes) {
        return {
          decision: 'BLOCK',
          policyDecisionType: PolicyDecisionType.BLOCKED,
          ruleMatched: 'COOLDOWN_ACTIVE',
          reason: 'Action within cooldown period; retry blocked.',
          evaluatedAt,
          configSnapshot: { ...activeConfig },
        };
      }
    }
  }

  // 7. High-Value Revenue at Risk (Bounded Autonomy Principle)
  // Even if recovery probability is 1.0, high amounts REQUIRE human/operational approval.
  const approvalThreshold =
    activeConfig.manualApprovalThresholdInr ??
    activeConfig.approvalAmountThresholdInr ??
    50000;
  if (revenue >= approvalThreshold) {
    return {
      decision: 'REQUIRE_APPROVAL',
      policyDecisionType: PolicyDecisionType.REQUIRES_APPROVAL,
      ruleMatched: 'HIGH_VALUE_THRESHOLD',
      reason: 'Revenue at risk exceeds automated-action threshold; approval required.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 8. Strategy Feature Toggles
  if (intervention === InterventionType.SMART_RETRY && !activeConfig.allowSmartRetry) {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'SMART_RETRY_DISABLED',
      reason: 'Smart retry is disabled by policy configuration.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  if (intervention === InterventionType.PAYMENT_METHOD_UPDATE && !activeConfig.allowPaymentMethodUpdate) {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'PAYMENT_METHOD_UPDATE_DISABLED',
      reason: 'Payment method update is disabled by policy configuration.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  if (intervention === InterventionType.PERSONALIZED_PAYMENT_LINK && !activeConfig.allowPaymentLink) {
    return {
      decision: 'BLOCK',
      policyDecisionType: PolicyDecisionType.BLOCKED,
      ruleMatched: 'PAYMENT_LINK_DISABLED',
      reason: 'Payment link generation is disabled by policy configuration.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 9. Minimum Recovery Probability Threshold
  if (probability < activeConfig.minimumRecoveryProbability) {
    return {
      decision: 'REQUIRE_APPROVAL',
      policyDecisionType: PolicyDecisionType.REQUIRES_APPROVAL,
      ruleMatched: 'LOW_RECOVERY_PROBABILITY',
      reason: 'Low recovery probability; action blocked or requires approval.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 10. Specific authorized clinical actions
  if (
    intervention === InterventionType.PAYMENT_METHOD_UPDATE &&
    (cause === FailureCause.EXPIRED_CARD || cause === FailureCause.CARD_BLOCKED)
  ) {
    return {
      decision: 'ALLOW',
      policyDecisionType: PolicyDecisionType.APPROVED,
      ruleMatched: 'PAYMENT_METHOD_UPDATE_ALLOWED',
      reason:
        cause === FailureCause.EXPIRED_CARD
          ? 'Expired card detected; payment method update selected.'
          : 'Card blocked detected; payment method update selected.',
      evaluatedAt,
      configSnapshot: { ...activeConfig },
    };
  }

  // 11. General Policy Passed -> Automated Action Permitted
  return {
    decision: 'ALLOW',
    policyDecisionType: PolicyDecisionType.APPROVED,
    ruleMatched: 'POLICY_CHECKS_PASSED',
    reason: 'Policy checks passed; automated action allowed.',
    evaluatedAt,
    configSnapshot: { ...activeConfig },
  };
}
