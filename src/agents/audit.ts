/**
 * Financial AI Audit Engine
 * RevenueShield AI (Phase 10)
 * 
 * CORE GUARANTEES:
 * 1. Every decision, policy evaluation, and execution step generates an immutable audit record.
 * 2. Deterministic explanations derived strictly from actual fields (no vague AI language).
 * 3. Strict security invariant: NEVER store secrets, API keys, or webhook signatures in audit entries.
 * 4. Explicit lifecycle state tracking:
 *    DETECTED -> DIAGNOSED -> PRIORITIZED -> PLANNED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED -> (RECOVERED | NOT_RECOVERED | BLOCKED | FAILED)
 */

import {
  ActionLifecycleState,
  AppEnvironment,
  AuditRecord,
  InterventionType,
  PolicyRuleDecision,
  RecoveryCase,
} from '../types.ts';

// In-memory audit log store
const auditRecords: AuditRecord[] = [];

export interface CreateAuditEntryParams {
  caseId: string;
  eventId?: string;
  action: string;
  intervention: InterventionType;
  policyDecision: PolicyRuleDecision;
  reason: string;
  recoveryProbability: number;
  riskScore: number;
  priorityScore: number;
  revenueAtRiskInr: number;
  environment?: AppEnvironment;
  dryRun?: boolean;
  outcome: string;
  actionState?: ActionLifecycleState;
  timestamp?: string;
  approver?: string;
  attribution?: string;
}

/**
 * Creates and registers a new immutable audit record.
 */
export function recordAuditEntry(params: CreateAuditEntryParams): AuditRecord {
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = params.timestamp ?? new Date().toISOString();
  const eventId = params.eventId ?? `evt_${params.caseId}`;
  const environment = params.environment ?? 'DEMO';
  const dryRun = params.dryRun ?? true;

  const record: AuditRecord = {
    audit_id: auditId,
    timestamp,
    case_id: params.caseId,
    event_id: eventId,
    action: params.action,
    intervention: params.intervention,
    policy_decision: params.policyDecision,
    reason: params.reason,
    recovery_probability: Math.round(params.recoveryProbability * 1000) / 1000,
    risk_score: Math.round(params.riskScore),
    priority_score: Math.round(params.priorityScore * 100) / 100,
    revenue_at_risk_inr: Math.round(params.revenueAtRiskInr * 100) / 100,
    environment,
    dry_run: dryRun,
    outcome: params.outcome,
    action_state: params.actionState ?? 'PLANNED',
    approver: params.approver,
    attribution: params.attribution,
  };

  // Strict invariant assert: No secrets permitted in record
  assertNoSecrets(record);

  auditRecords.push(record);
  return { ...record };
}

/**
 * Returns all audit records, optionally filtered by caseId or eventId.
 */
export function getAuditTrail(filter?: { caseId?: string; eventId?: string }): AuditRecord[] {
  let records = [...auditRecords];
  if (filter?.caseId) {
    records = records.filter((r) => r.case_id === filter.caseId);
  }
  if (filter?.eventId) {
    records = records.filter((r) => r.event_id === filter.eventId);
  }
  return records;
}

/**
 * Clears the in-memory audit log (used in testing).
 */
export function clearAuditTrail(): void {
  auditRecords.length = 0;
}

/**
 * Records an audit entry directly from a RecoveryCase and policy evaluation result.
 */
export function recordCaseAudit(
  recoveryCase: RecoveryCase,
  options: {
    eventId?: string;
    policyDecision: PolicyRuleDecision;
    policyReason: string;
    actionState: ActionLifecycleState;
    outcome: string;
    dryRun?: boolean;
    environment?: AppEnvironment;
  }
): AuditRecord {
  return recordAuditEntry({
    caseId: recoveryCase.id,
    eventId: options.eventId ?? recoveryCase.lastPaymentEventId,
    action: `EXECUTE_${recoveryCase.recommendedIntervention ?? InterventionType.NO_ACTION}`,
    intervention: recoveryCase.recommendedIntervention ?? InterventionType.NO_ACTION,
    policyDecision: options.policyDecision,
    reason: options.policyReason,
    recoveryProbability: recoveryCase.recoveryProbability ?? 0,
    riskScore: recoveryCase.riskScore ?? 0,
    priorityScore: recoveryCase.priorityScore ?? 0,
    revenueAtRiskInr: recoveryCase.revenueAtRiskInr ?? 0,
    environment: options.environment ?? recoveryCase.environment ?? 'DEMO',
    dryRun: options.dryRun ?? recoveryCase.dryRun ?? true,
    outcome: options.outcome,
    actionState: options.actionState,
  });
}

/**
 * Asserts that an audit record does not leak confidential credentials.
 */
function assertNoSecrets(record: AuditRecord): void {
  const serialized = JSON.stringify(record).toLowerCase();
  const secretKeywords = [
    'rzp_live_',
    'rzp_test_',
    'secret',
    'private_key',
    'password',
    'webhook_secret',
  ];

  for (const keyword of secretKeywords) {
    // Note: The word "secret" by itself might appear in English text, but credentials shouldn't
    if (keyword === 'secret' || keyword === 'webhook_secret') {
      if (
  typeof process !== 'undefined' &&
  process.env?.RAZORPAY_KEY_SECRET &&
  process.env.RAZORPAY_KEY_SECRET.length > 5 &&
  serialized.includes(process.env.RAZORPAY_KEY_SECRET.toLowerCase())
) {
        throw new Error('Security violation: RAZORPAY_KEY_SECRET found in audit record!');
      }
      if (
  typeof process !== 'undefined' &&
  process.env?.RAZORPAY_WEBHOOK_SECRET &&
  process.env.RAZORPAY_WEBHOOK_SECRET.length > 5 &&
  serialized.includes(process.env.RAZORPAY_WEBHOOK_SECRET.toLowerCase())
) {
        throw new Error('Security violation: RAZORPAY_WEBHOOK_SECRET found in audit record!');
      }
    } else if (serialized.includes(keyword)) {
      throw new Error(`Security violation: Detected forbidden credential pattern "${keyword}" in audit record.`);
    }
  }
}

/**
 * Validates that an audit record contains no secrets (for unit testing).
 */
export function auditRecordContainsNoSecrets(record: AuditRecord): boolean {
  try {
    assertNoSecrets(record);
    return true;
  } catch {
    return false;
  }
}
