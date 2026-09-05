/**
 * Core Domain Types for RevenueShield AI
 * Track 3 — AI Revenue Recovery
 */

export enum FailureCause {
  UNKNOWN = 'UNKNOWN',
  CARD_BLOCKED = 'CARD_BLOCKED',
  EXPIRED_CARD = 'EXPIRED_CARD',
  ISSUER_DECLINED = 'ISSUER_DECLINED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  BANK_TIMEOUT = 'BANK_TIMEOUT',
}

export enum InterventionType {
  SMART_RETRY = 'SMART_RETRY',
  PAYMENT_METHOD_UPDATE = 'PAYMENT_METHOD_UPDATE',
  PERSONALIZED_PAYMENT_LINK = 'PERSONALIZED_PAYMENT_LINK',
  CUSTOMER_NOTIFICATION = 'CUSTOMER_NOTIFICATION',
  ESCALATION_MANUAL_REVIEW = 'ESCALATION_MANUAL_REVIEW',
  NO_ACTION = 'NO_ACTION',
}

export enum PolicyDecisionType {
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL',
}

export type AppEnvironment = 'DEMO' | 'TEST' | 'LIVE';

export type PolicyRuleDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';

export type ActionLifecycleState =
  | 'DETECTED'
  | 'DIAGNOSED'
  | 'PRIORITIZED'
  | 'PLANNED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'RECOVERED'
  | 'NOT_RECOVERED'
  | 'BLOCKED'
  | 'FAILED';

export interface PolicyConfig {
  maxAutomatedAttempts: number;
  cooldownMinutes: number;
  approvalAmountThresholdInr: number;
  minimumRecoveryProbability: number;
  allowPaymentMethodUpdate: boolean;
  allowPaymentLink: boolean;
  allowSmartRetry: boolean;
  killSwitchEnabled: boolean;

  // Compatibility aliases
  maxInterventionAttempts?: number;
  maxRetryAttemptsPerCase?: number;
  manualApprovalThresholdInr?: number;
  highValueThresholdInr?: number;
  maxRiskScoreForAutonomousRecovery?: number;
  minRecoveryProbability?: number;
  cooldownPeriodHours?: number;
  maxDiscountRate?: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  blockedChannels?: string[];
}

export interface PolicyEvaluationResult {
  decision: PolicyRuleDecision;
  policyDecisionType: PolicyDecisionType;
  ruleMatched: string;
  reason: string;
  evaluatedAt: string;
  configSnapshot: PolicyConfig;
}

export interface NormalizedPaymentEvent {
  provider: 'RAZORPAY';
  providerEventId: string;
  paymentId?: string;
  subscriptionId?: string;
  customerReference?: string;
  amountInr: number;
  status: string;
  failureCause: FailureCause;
  attemptCount: number;
  occurredAt: string;
  rawEventType: string;
  rawErrorCode?: string;
  rawErrorMessage?: string;
  isActionable: boolean;
}

export interface AuditRecord {
  audit_id: string;
  id?: string; // Compatibility alias
  timestamp: string;
  case_id: string;
  event_id: string;
  action: string;
  intervention: InterventionType;
  policy_decision: PolicyRuleDecision;
  reason: string;
  recovery_probability: number;
  risk_score: number;
  priority_score: number;
  revenue_at_risk_inr: number;
  environment: AppEnvironment;
  dry_run: boolean;
  outcome: string;
  action_state?: ActionLifecycleState;
  approver?: string;
  attribution?: string;
}

export type CustomerSegment = 'SMB' | 'MID_MARKET' | 'ENTERPRISE' | 'STARTUP';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  responsePropensity: number; // 0.0 to 1.0
  subscriptionTier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  segment?: CustomerSegment;
  tenureMonths?: number;
  subscriptionCount?: number;
  lifetimeValueInr: number;
  totalSuccessfulPayments: number;
  totalFailedPayments: number;
  disputeHistory: boolean;
  hasCancelled: boolean;
  preferredPaymentMethod?: 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NETBANKING' | 'NACH';
  createdAt?: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planName: string;
  planId?: string;
  amountInr: number;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'HALTED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt?: string;
  createdAt?: string;
  retryCount: number;
  maxRetryLimit: number;
}

export interface PaymentEvent {
  id: string;
  subscriptionId: string;
  customerId: string;
  amountInr: number;
  status: 'SUCCESS' | 'FAILED';
  attemptNumber: number;
  timestamp: string;
  failureCause?: FailureCause;
  rawErrorCode?: string;
  rawErrorMessage?: string;
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NETBANKING' | 'NACH';
}

export interface PolicyDecision {
  decision: PolicyDecisionType;
  policyViolated?: string;
  reason: string;
  evaluatedAt: string;
}

export interface RecoveryCase {
  id: string;
  customerId: string;
  subscriptionId: string;
  customerName: string;
  customerEmail: string;
  subscriptionTier: string;
  revenueAtRiskInr: number;
  failureCause: FailureCause;
  attemptCount: number;
  customerResponsePropensity: number; // Raw or base propensity
  lastPaymentEventId?: string;
  lastAttemptAt?: string;

  // Interventions & Decisions
  recommendedIntervention?: InterventionType;
  optimalIntervention?: InterventionType; // Compatibility alias
  interventionReasoning?: string;
  policyDecision?: PolicyDecision;
  policyReason?: string; // Compatibility alias

  // Canonical recovery probability (p_recover)
  recoveryProbability?: number;
  calculatedProbability?: number; // Compatibility alias

  // Derived scoring values (Phase 2)
  riskScore?: number;        // 0 to 100
  urgencyWeight?: number;    // e.g. 1.0 to 1.45
  priorityScore?: number;    // revenue * recoveryProbability * (riskScore/100) * urgencyWeight

  // Execution & Simulation results (Phase 3 & Phase 4)
  baselineProbability?: number;
  agentProbability?: number;
  randomDrawU?: number;
  baselineRecovered?: boolean;
  agentRecovered?: boolean;
  baselineRecoveredAmountInr?: number;
  agentRecoveredAmountInr?: number;
  incrementalRecoveryInr?: number;
  recoveredAmountInr?: number; // Kept for backward compatibility
  executedAt?: string;

  // Phase 9 & 10 Guardrail and Lifecycle Tracking
  actionState?: ActionLifecycleState;
  policyRuleDecision?: PolicyRuleDecision;
  environment?: AppEnvironment;
  dryRun?: boolean;
  source?: 'SYNTHETIC' | 'RAZORPAY_TEST';

  // Operator Approval Workflow
  approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approver?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  caseId: string;
  customerId: string;
  failureReason: FailureCause;
  riskScore: number;
  priorityScore: number;
  recoveryProbability: number;
  recommendedIntervention: InterventionType;
  policyDecision: PolicyDecisionType;
  policyReason?: string;
  executionStatus: 'PENDING' | 'EXECUTED' | 'BLOCKED' | 'ESCALATED' | 'SIMULATED';
  baselineProbability?: number;
  agentProbability?: number;
  randomDrawU?: number;
  baselineRecovered?: boolean;
  agentRecovered?: boolean;
  recoveredAmountInr?: number;
  incrementalRecoveryInr?: number;
  reasoning: string;
}

export interface LedgerSummary {
  totalAtRiskInr: number;
  totalBaselineRecoveredInr: number;
  totalAgentRecoveredInr: number;
  incrementalRecoveryInr: number;
  incrementalRecoveryPct: number;
  recoveryRatePct: number;
  totalCases: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  blockedActions: number;
  escalations: number;
}
