/**
 * Razorpay Test-Mode Service Adapter
 * RevenueShield AI (Phase 9)
 * 
 * CORE RESPONSIBILITIES:
 * 1. Test Mode isolation: Never execute live payments. LIVE mode fails safely.
 * 2. HMAC-SHA256 Webhook signature verification using RAW request body.
 * 3. Idempotent event ingestion preventing duplicate cases, interventions, or ledger entries.
 * 4. Normalization of Razorpay payloads into canonical RevenueShield domain models.
 * 5. Deterministic failure cause mapping preserving original provider error context.
 * 6. Integration with Policy Engine, Audit, and Ledger.
 */

import crypto from 'node:crypto';
import {
  ActionLifecycleState,
  AppEnvironment,
  AuditRecord,
  FailureCause,
  InterventionType,
  NormalizedPaymentEvent,
  PolicyEvaluationResult,
  RecoveryCase,
} from '../types.ts';
import { decideIntervention, scorePriority } from '../agents/intervention.ts';
import { evaluatePolicy } from '../agents/policy.ts';
import { recordAuditEntry } from '../agents/audit.ts';
import { executeSimulationCase } from '../agents/execution.ts';

/**
 * In-memory idempotency store for webhook events.
 * NOTE: In a distributed production deployment, this should be backed by
 * durable storage like Redis, Firestore, or Cloud SQL.
 */
export interface IdempotencyRecord {
  eventId: string;
  processedAt: string;
  rawEventType: string;
  status: 'PROCESSED' | 'IGNORED' | 'BLOCKED' | 'PENDING_APPROVAL';
  reason: string;
  caseId?: string;
  auditId?: string;
  recoveryCase?: RecoveryCase;
  policyDecision?: string;
}

class InMemoryIdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();

  has(eventId: string): boolean {
    return this.store.has(eventId);
  }

  get(eventId: string): IdempotencyRecord | undefined {
    return this.store.get(eventId);
  }

  set(eventId: string, record: IdempotencyRecord): void {
    this.store.set(eventId, record);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const idempotencyStore = new InMemoryIdempotencyStore();

/**
 * Returns true if Razorpay credentials are configured in the environment.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return Boolean(keyId && webhookSecret);
}

/**
 * Determines current Razorpay execution environment:
 * - 'DEMO': Synthetic deterministic simulation (default if unconfigured)
 * - 'TEST': Razorpay Test Mode integration
 * - 'LIVE': Explicitly NOT implemented (fails safely with error)
 */
export function getRazorpayEnvironment(explicitOverride?: string): AppEnvironment {
  const target = (explicitOverride || process.env.RAZORPAY_ENV || '').toUpperCase();
  if (target === 'LIVE') {
    return 'LIVE';
  }
  if (target === 'TEST' || isRazorpayConfigured()) {
    return 'TEST';
  }
  return 'DEMO';
}

/**
 * Verifies Razorpay HMAC-SHA256 webhook signature against the RAW request body.
 * 
 * CRITICAL:
 * Must use the exact, untouched raw body string or buffer.
 * Never parse JSON and re-stringify it before signature calculation.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !signature || !rawBody) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const expectedHex = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedHex, 'utf-8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates an HMAC-SHA256 signature for test payloads (used in local testing & simulation).
 */
export function generateTestWebhookSignature(rawBody: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Maps Razorpay failure codes and descriptions to the canonical FailureCause enum.
 * 
 * If a code or description cannot be classified with high confidence,
 * it safely defaults to FailureCause.UNKNOWN.
 * 
 * Original provider error details are preserved for audit.
 */
export function mapRazorpayFailureCause(
  errorCode?: string,
  errorDescription?: string,
  errorReason?: string
): FailureCause {
  const code = (errorCode || '').toUpperCase();
  const desc = (errorDescription || '').toLowerCase();
  const reason = (errorReason || '').toLowerCase();

  // 1. Expired Card
  if (
    code.includes('EXPIR') ||
    desc.includes('expired') ||
    desc.includes('expiry') ||
    reason.includes('expired')
  ) {
    return FailureCause.EXPIRED_CARD;
  }

  // 2. Blocked or Frozen Card
  if (
    code.includes('BLOCKED') ||
    code.includes('STOLEN') ||
    code.includes('LOST') ||
    desc.includes('blocked') ||
    desc.includes('frozen') ||
    desc.includes('stolen') ||
    reason.includes('blocked')
  ) {
    return FailureCause.CARD_BLOCKED;
  }

  // 3. Insufficient Funds / Account Balance
  if (
    code.includes('INSUFFICIENT') ||
    code.includes('BALANCE') ||
    code.includes('LOW_BALANCE') ||
    desc.includes('insufficient') ||
    desc.includes('balance') ||
    desc.includes('funds') ||
    reason.includes('insufficient')
  ) {
    return FailureCause.INSUFFICIENT_FUNDS;
  }

  // 4. Bank / Gateway Timeout
  if (
    code.includes('TIMEOUT') ||
    code.includes('DOWN') ||
    code.includes('GATEWAY_ERROR') ||
    desc.includes('timeout') ||
    desc.includes('timed out') ||
    desc.includes('bank down') ||
    desc.includes('issuer unavailable') ||
    reason.includes('timeout')
  ) {
    return FailureCause.BANK_TIMEOUT;
  }

  // 5. Bank Issuer Declined
  if (
    code.includes('DECLINED') ||
    code.includes('REJECT') ||
    code.includes('DO_NOT_HONOR') ||
    desc.includes('declined') ||
    desc.includes('not permitted') ||
    desc.includes('rejected by bank') ||
    reason.includes('declined')
  ) {
    return FailureCause.ISSUER_DECLINED;
  }

  // Default: Unknown / Unclassified
  return FailureCause.UNKNOWN;
}

/**
 * List of prioritized supported Razorpay webhook events.
 */
export const SUPPORTED_RAZORPAY_EVENTS = [
  'payment.failed',
  'payment.captured',
  'subscription.pending',
  'subscription.charged',
  'subscription.activated',
  'subscription.halted',
] as const;

export type SupportedRazorpayEvent = (typeof SUPPORTED_RAZORPAY_EVENTS)[number];

/**
 * Normalizes a raw Razorpay webhook payload into a canonical NormalizedPaymentEvent.
 */
export function normalizeWebhookEvent(rawPayload: any): NormalizedPaymentEvent {
  const eventName = rawPayload?.event || 'unknown';
  const providerEventId = rawPayload?.id || `evt_rzp_${Date.now()}`;
  const isSupported = SUPPORTED_RAZORPAY_EVENTS.includes(eventName as SupportedRazorpayEvent);
  const isActionable = eventName === 'payment.failed' || eventName === 'subscription.halted';

  const paymentEntity = rawPayload?.payload?.payment?.entity;
  const subscriptionEntity = rawPayload?.payload?.subscription?.entity;

  // Extract amount: Razorpay uses currency subunit (Paise for INR, 100 paise = 1 INR)
  let amountInr = 0;
  if (paymentEntity?.amount != null) {
    amountInr = Number(paymentEntity.amount) / 100;
  } else if (subscriptionEntity?.current_period_amount != null) {
    amountInr = Number(subscriptionEntity.current_period_amount) / 100;
  }

  const paymentId = paymentEntity?.id || undefined;
  const subscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || undefined;
  const customerReference = paymentEntity?.customer_id || paymentEntity?.email || subscriptionEntity?.customer_id;

  const rawErrorCode = paymentEntity?.error_code || rawPayload?.error?.code;
  const rawErrorMessage = paymentEntity?.error_description || rawPayload?.error?.description;
  const rawErrorReason = paymentEntity?.error_reason;

  const failureCause = isActionable
    ? mapRazorpayFailureCause(rawErrorCode, rawErrorMessage, rawErrorReason)
    : FailureCause.UNKNOWN;

  // Attempt count extraction (fallback to notes or default 1)
  const attemptCount = Number(
    paymentEntity?.notes?.attempt_count ||
    subscriptionEntity?.retry_count ||
    1
  );

  const occurredAt = rawPayload?.created_at
    ? new Date(rawPayload.created_at * 1000).toISOString()
    : new Date().toISOString();

  return {
    provider: 'RAZORPAY',
    providerEventId,
    paymentId,
    subscriptionId,
    customerReference,
    amountInr: Math.max(0, amountInr),
    status: paymentEntity?.status || subscriptionEntity?.status || 'UNKNOWN',
    failureCause,
    attemptCount: Math.max(1, attemptCount),
    occurredAt,
    rawEventType: eventName,
    rawErrorCode,
    rawErrorMessage,
    isActionable: isSupported && isActionable,
  };
}

export interface ProcessWebhookResult {
  statusCode: number;
  success: boolean;
  message: string;
  eventId: string;
  environment: AppEnvironment;
  actionState: ActionLifecycleState;
  recoveryCase?: RecoveryCase;
  auditEntry?: AuditRecord;
  auditRecordId?: string;
  policyEvaluation?: PolicyEvaluationResult;
}

export interface ProcessWebhookOptions {
  rawBody: string | Buffer;
  signature?: string;
  webhookSecret?: string;
  targetEnvironment?: AppEnvironment;
  dryRun?: boolean;
}

/**
 * Complete Razorpay Webhook Ingestion Pipeline:
 * 
 * 1. Signature Verification
 * 2. Idempotency Check
 * 3. Payload Parsing & Event Normalization
 * 4. Supported Event Classification
 * 5. RecoveryCase Lifecycle Integration
 * 6. Root Cause Diagnosis & Intervention
 * 7. Priority Scoring
 * 8. Policy Engine Evaluation (ALLOW / REQUIRE_APPROVAL / BLOCK)
 * 9. Dry-Run Gated Execution
 * 10. Audit Record Generation
 */
export function processRazorpayWebhook(options: ProcessWebhookOptions): ProcessWebhookResult {
  const {
    rawBody,
    signature,
    webhookSecret,
    targetEnvironment,
    dryRun = true,
  } = options;

  const environment = targetEnvironment ?? getRazorpayEnvironment();

  // 1. Signature Verification
  if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return {
      statusCode: 401,
      success: false,
      message: 'Invalid Razorpay webhook signature.',
      eventId: 'unknown',
      environment,
      actionState: 'FAILED',
    };
  }

  // 2. Parse Raw JSON safely
  let rawPayload: any;
  try {
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    rawPayload = JSON.parse(rawString);
  } catch {
    return {
      statusCode: 400,
      success: false,
      message: 'Malformed JSON in webhook request body.',
      eventId: 'unknown',
      environment,
      actionState: 'FAILED',
    };
  }

  // 3. Extract or generate deterministic event identifier
  const providerEntityId = rawPayload?.payload?.payment?.entity?.id ||
    rawPayload?.payload?.subscription?.entity?.id ||
    rawPayload?.entity_id;

  const eventId = rawPayload?.id || (
    providerEntityId
      ? `evt_${rawPayload?.event || 'generic'}_${providerEntityId}`
      : `evt_${crypto.createHash('sha256').update(rawBody).digest('hex').substring(0, 20)}`
  );

  // 4. Idempotency Check
  if (idempotencyStore.has(eventId)) {
    const existing = idempotencyStore.get(eventId)!;
    return {
      statusCode: 200,
      success: true,
      message: 'Duplicate webhook event; action suppressed.',
      eventId,
      environment,
      actionState: 'BLOCKED',
      recoveryCase: existing.recoveryCase,
    };
  }

  // 5. Live Mode Barrier
  if (environment === 'LIVE') {
    const blockedRecord: IdempotencyRecord = {
      eventId,
      processedAt: new Date().toISOString(),
      rawEventType: rawPayload?.event || 'unknown',
      status: 'BLOCKED',
      reason: 'Live execution is disabled in this build.',
    };
    idempotencyStore.set(eventId, blockedRecord);

    return {
      statusCode: 403,
      success: false,
      message: 'Live execution is disabled in this build.',
      eventId,
      environment: 'LIVE',
      actionState: 'BLOCKED',
    };
  }

  // 5. Normalize event
  const normalized = normalizeWebhookEvent(rawPayload);

  // 6. Handle unsupported or non-actionable events safely without crashing
  if (!normalized.isActionable) {
    const ignoredRecord: IdempotencyRecord = {
      eventId,
      processedAt: new Date().toISOString(),
      rawEventType: normalized.rawEventType,
      status: 'IGNORED',
      reason: `Event ${normalized.rawEventType} is non-actionable or not a failure event.`,
    };
    idempotencyStore.set(eventId, ignoredRecord);

    return {
      statusCode: 200,
      success: true,
      message: `Event ${normalized.rawEventType} received and verified; non-actionable.`,
      eventId,
      environment,
      actionState: 'PLANNED',
    };
  }

  // 7. Construct RecoveryCase
  const caseId = `case_rzp_${normalized.paymentId || normalized.subscriptionId || eventId}`;
  const initialCase: RecoveryCase = {
    id: caseId,
    customerId: normalized.customerReference || 'cust_rzp_unknown',
    subscriptionId: normalized.subscriptionId || 'sub_rzp_unknown',
    customerName: normalized.customerReference ? `Customer (${normalized.customerReference})` : 'Razorpay Customer',
    customerEmail: normalized.customerReference?.includes('@') ? normalized.customerReference : 'customer@example.com',
    subscriptionTier: 'PROFESSIONAL',
    revenueAtRiskInr: normalized.amountInr,
    failureCause: normalized.failureCause,
    attemptCount: normalized.attemptCount,
    customerResponsePropensity: 0.60, // Standard baseline propensity for active subscriber
    lastPaymentEventId: normalized.paymentId,
    lastAttemptAt: normalized.occurredAt,
    environment,
    dryRun,
    source: 'RAZORPAY_TEST',
    actionState: 'DETECTED',
  };

  // 8. Diagnose & Recommend Intervention
  const diagnosis = decideIntervention(initialCase);
  const diagnosedCase: RecoveryCase = {
    ...initialCase,
    recommendedIntervention: diagnosis.recommendedIntervention,
    interventionReasoning: diagnosis.reasoning,
    actionState: 'DIAGNOSED',
  };

  // 9. Score Priority (Canonical Probability & Risk Score)
  const prioritizedCase: RecoveryCase = {
    ...scorePriority(diagnosedCase),
    actionState: 'PRIORITIZED',
  };

  // 10. POLICY GUARDRAIL EVALUATION
  const policyResult = evaluatePolicy({
    recoveryCase: prioritizedCase,
    targetEnvironment: environment,
  });

  prioritizedCase.policyDecision = {
    decision: policyResult.policyDecisionType,
    reason: policyResult.reason,
    evaluatedAt: policyResult.evaluatedAt,
  };
  prioritizedCase.policyRuleDecision = policyResult.decision;

  let finalActionState: ActionLifecycleState = 'PLANNED';
  let executionOutcome = 'PENDING';

  if (policyResult.decision === 'BLOCK') {
    finalActionState = 'BLOCKED';
    executionOutcome = 'BLOCKED';
  } else if (policyResult.decision === 'REQUIRE_APPROVAL') {
    finalActionState = 'PENDING_APPROVAL';
    executionOutcome = 'PENDING_APPROVAL';
  } else if (policyResult.decision === 'ALLOW') {
    if (dryRun) {
      // In dry run: evaluate single-draw simulation trace without external side effects
      const { updatedCase } = executeSimulationCase(prioritizedCase, () => 0.35); // deterministic test draw
      Object.assign(prioritizedCase, updatedCase);
      finalActionState = updatedCase.agentRecovered ? 'RECOVERED' : 'NOT_RECOVERED';
      executionOutcome = updatedCase.agentRecovered ? 'RECOVERED' : 'NOT_RECOVERED';
    } else {
      // Even in test mode, dryRun=false marks executed
      finalActionState = 'EXECUTED';
      executionOutcome = 'EXECUTED';
    }
  }

  prioritizedCase.actionState = finalActionState;

  // 11. Record immutable audit entry (no secrets)
  const auditEntry = recordAuditEntry({
    caseId: prioritizedCase.id,
    eventId,
    action: `RECOVERY_${prioritizedCase.recommendedIntervention ?? InterventionType.NO_ACTION}`,
    intervention: prioritizedCase.recommendedIntervention ?? InterventionType.NO_ACTION,
    policyDecision: policyResult.decision,
    reason: policyResult.reason,
    recoveryProbability: prioritizedCase.recoveryProbability ?? 0,
    riskScore: prioritizedCase.riskScore ?? 0,
    priorityScore: prioritizedCase.priorityScore ?? 0,
    revenueAtRiskInr: prioritizedCase.revenueAtRiskInr,
    environment,
    dryRun,
    outcome: executionOutcome,
    actionState: finalActionState,
  });

  // 12. Register with Idempotency Store
  idempotencyStore.set(eventId, {
    eventId,
    processedAt: new Date().toISOString(),
    rawEventType: normalized.rawEventType,
    status: policyResult.decision === 'BLOCK' ? 'BLOCKED' : 'PROCESSED',
    reason: policyResult.reason,
    caseId: prioritizedCase.id,
    auditId: auditEntry.audit_id,
    recoveryCase: prioritizedCase,
    policyDecision: policyResult.decision,
  });

  return {
    statusCode: 200,
    success: true,
    message: policyResult.reason,
    eventId,
    environment,
    actionState: finalActionState,
    recoveryCase: prioritizedCase,
    auditEntry,
    auditRecordId: auditEntry?.audit_id || (auditEntry as any)?.id,
    policyEvaluation: policyResult,
  };
}

/**
 * Creates a valid, signed Razorpay test webhook payload for local simulation or automated testing.
 */
export function createSignedTestWebhookPayload(
  options: {
    event: SupportedRazorpayEvent | string;
    amountInr: number;
    eventId?: string;
    paymentId?: string;
    subscriptionId?: string;
    errorCode?: string;
    errorDescription?: string;
    errorReason?: string;
    secret?: string;
    attemptCount?: number;
  }
): { rawBody: string; signature: string; secret: string } {
  const secret = options.secret || process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_rs_2026';
  const amountPaise = Math.round(options.amountInr * 100);
  const paymentId = options.paymentId || `pay_test_${Math.random().toString(36).substring(2, 9)}`;
  const subscriptionId = options.subscriptionId || `sub_test_${Math.random().toString(36).substring(2, 9)}`;
  const eventId = options.eventId || `evt_${options.event}_${paymentId}`;

  const payloadObject = {
    id: eventId,
    entity: 'event',
    account_id: 'acc_revenueshield_test',
    event: options.event,
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: amountPaise,
          currency: 'INR',
          status: options.event === 'payment.failed' ? 'failed' : 'captured',
          error_code: options.errorCode,
          error_description: options.errorDescription,
          error_reason: options.errorReason,
          subscription_id: subscriptionId,
          email: 'founder@startup.in',
          contact: '+919988776655',
          notes: {
            attempt_count: options.attemptCount ?? 1,
          },
        },
      },
      subscription: {
        entity: {
          id: subscriptionId,
          status: options.event === 'subscription.halted' ? 'halted' : 'active',
          current_period_amount: amountPaise,
          retry_count: options.attemptCount ?? 1,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(payloadObject);
  const signature = generateTestWebhookSignature(rawBody, secret);

  return { rawBody, signature, secret };
}
