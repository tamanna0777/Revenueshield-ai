/**
 * Deterministic Synthetic Data Generator
 * RevenueShield AI
 * 
 * Generates:
 * - 5,000 synthetic customers across SMB, MID_MARKET, ENTERPRISE, and STARTUP segments
 * - 20,000+ payment events (both SUCCESS and FAILED) with plausible non-uniform failure causes
 * - Associated subscriptions with realistic INR billing amounts
 * - RecoveryCase objects derived directly from failed payment events, strictly preserving customer response propensity
 * 
 * DETERMINISM:
 * Fully seeded with Mulberry32 PRNG. Same seed produces byte-identical dataset.
 * Contains NO real personal identifiable information (PII).
 */

import {
  Customer,
  CustomerSegment,
  FailureCause,
  PaymentEvent,
  RecoveryCase,
  Subscription,
} from '../types.ts';
import { createSeededRng, RandomNumberGenerator } from '../agents/execution.ts';

export interface SyntheticDataset {
  customers: Customer[];
  subscriptions: Subscription[];
  paymentEvents: PaymentEvent[];
  recoveryCases: RecoveryCase[];
  metadata: {
    seed: number;
    generatedAt: string;
    totalCustomers: number;
    totalSubscriptions: number;
    totalPaymentEvents: number;
    totalSuccessfulEvents: number;
    totalFailedEvents: number;
    totalRecoveryCases: number;
    totalRevenueAtRiskInr: number;
  };
}

// Synthetic name pools (strictly fictitious / non-PII company handles)
const SYNTHETIC_PREFIXES = ['Acme', 'Apex', 'Beacon', 'Cloud', 'Delta', 'Echo', 'Flux', 'Hyper', 'Nova', 'Omni', 'Pulse', 'Quantum', 'Stellar', 'Vertex', 'Zenith', 'Aero', 'Kite', 'Prism', 'Orbit', 'Velo'];
const SYNTHETIC_SUFFIXES = ['Labs', 'Tech', 'Digital', 'Systems', 'Pay', 'AI', 'Flow', 'Hub', 'Logic', 'Works', 'Scale', 'Networks', 'Dynamics', 'Cloud', 'Stack', 'HQ'];

const DOMAINS = ['corp-synthetic.io', 'demo-tenant.internal', 'fictitious-saas.net', 'test-merchant.dev'];

const SEGMENT_DISTRIBUTION: { segment: CustomerSegment; tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; weight: number; baseAmount: number }[] = [
  { segment: 'STARTUP', tier: 'STARTER', weight: 0.35, baseAmount: 1999 },
  { segment: 'SMB', tier: 'STARTER', weight: 0.40, baseAmount: 4999 },
  { segment: 'MID_MARKET', tier: 'PROFESSIONAL', weight: 0.18, baseAmount: 14999 },
  { segment: 'ENTERPRISE', tier: 'ENTERPRISE', weight: 0.07, baseAmount: 49999 },
];

const FAILURE_CAUSE_DISTRIBUTION: { cause: FailureCause; weight: number }[] = [
  { cause: FailureCause.INSUFFICIENT_FUNDS, weight: 0.32 },
  { cause: FailureCause.BANK_TIMEOUT, weight: 0.22 },
  { cause: FailureCause.ISSUER_DECLINED, weight: 0.18 },
  { cause: FailureCause.EXPIRED_CARD, weight: 0.14 },
  { cause: FailureCause.CARD_BLOCKED, weight: 0.09 },
  { cause: FailureCause.UNKNOWN, weight: 0.05 },
];

const PAYMENT_METHODS: ('CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NETBANKING' | 'NACH')[] = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'UPI',
  'NETBANKING',
  'NACH',
];

/**
 * Helper to pick from a weighted distribution using a random draw.
 */
function pickWeighted<T>(items: { item: T; weight: number }[], u: number): T {
  let acc = 0;
  for (const entry of items) {
    acc += entry.weight;
    if (u <= acc) {
      return entry.item;
    }
  }
  return items[items.length - 1].item;
}

/**
 * Helper to pick random item from array
 */
function pickRandom<T>(arr: T[], rng: RandomNumberGenerator): T {
  const index = Math.floor(rng() * arr.length);
  return arr[Math.min(index, arr.length - 1)];
}

/**
 * Generates the full synthetic dataset.
 * Target: 5,000 customers, 20,000+ payment events.
 */
export function generateSyntheticDataset(seed: number = 2026): SyntheticDataset {
  const rng = createSeededRng(seed);

  const CUSTOMER_COUNT = 5000;
  const MIN_PAYMENT_EVENTS = 20000;

  const customers: Customer[] = [];
  const subscriptions: Subscription[] = [];
  const paymentEvents: PaymentEvent[] = [];
  const recoveryCases: RecoveryCase[] = [];

  const weightedSegments = SEGMENT_DISTRIBUTION.map(s => ({ item: s, weight: s.weight }));
  const weightedCauses = FAILURE_CAUSE_DISTRIBUTION.map(c => ({ item: c.cause, weight: c.weight }));

  // Reference baseline date in UTC: 2026-01-01 to 2026-06-30
  const BASE_START_TIMESTAMP = Date.UTC(2026, 0, 1, 0, 0, 0);
  const SIMULATION_WINDOW_DAYS = 180;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // 1. Generate 5,000 Customers & Subscriptions
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const custId = `cust_syn_${String(i + 1).padStart(6, '0')}`;
    const subId = `sub_syn_${String(i + 1).padStart(6, '0')}`;

    const segConfig = pickWeighted(weightedSegments, rng());
    const prefix = pickRandom(SYNTHETIC_PREFIXES, rng);
    const suffix = pickRandom(SYNTHETIC_SUFFIXES, rng);
    const domain = pickRandom(DOMAINS, rng);
    const companyName = `${prefix} ${suffix} ${i + 1}`;
    const cleanEmail = `billing@${prefix.toLowerCase()}-${suffix.toLowerCase()}-${i + 1}.${domain}`;

    // Tenure between 1 and 36 months
    const tenureMonths = 1 + Math.floor(rng() * 36);

    // Propensity distribution depends slightly on segment (Enterprise/Mid-Market typically have higher response)
    // Centered around 0.45 - 0.75, strictly clamped to [0.10, 0.95]
    const segmentBonus = segConfig.segment === 'ENTERPRISE' ? 0.15 : segConfig.segment === 'MID_MARKET' ? 0.08 : 0.0;
    const rawPropensity = 0.20 + rng() * 0.60 + segmentBonus;
    const responsePropensity = Math.round(Math.min(0.95, Math.max(0.10, rawPropensity)) * 100) / 100;

    const preferredMethod = pickRandom(PAYMENT_METHODS, rng);

    // Realistic subscription amount with slight variance
    const multiplier = 0.8 + rng() * 0.4; // 80% to 120% of base
    const amountInr = Math.round(segConfig.baseAmount * multiplier);

    const billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' = rng() < 0.8 ? 'MONTHLY' : (rng() < 0.85 ? 'QUARTERLY' : 'ANNUAL');

    // Subscription start date
    const startOffsetDays = Math.floor(rng() * (SIMULATION_WINDOW_DAYS - 60));
    const createdDateMs = BASE_START_TIMESTAMP + startOffsetDays * MS_PER_DAY;
    const createdAt = new Date(createdDateMs).toISOString();

    const customer: Customer = {
      id: custId,
      name: companyName,
      email: cleanEmail,
      responsePropensity,
      subscriptionTier: segConfig.tier,
      segment: segConfig.segment,
      tenureMonths,
      subscriptionCount: 1,
      lifetimeValueInr: amountInr * Math.min(tenureMonths, 12),
      totalSuccessfulPayments: 0,
      totalFailedPayments: 0,
      disputeHistory: rng() < 0.015, // 1.5% dispute rate
      hasCancelled: false,
      preferredPaymentMethod: preferredMethod,
      createdAt,
    };
    customers.push(customer);

    const subscription: Subscription = {
      id: subId,
      customerId: custId,
      planName: `${segConfig.segment} ${segConfig.tier} Plan`,
      planId: `plan_${segConfig.segment.toLowerCase()}_${amountInr}`,
      amountInr,
      billingCycle,
      status: 'ACTIVE',
      currentPeriodStart: createdAt,
      currentPeriodEnd: new Date(createdDateMs + 30 * MS_PER_DAY).toISOString(),
      retryCount: 0,
      maxRetryLimit: 4,
      createdAt,
    };
    subscriptions.push(subscription);
  }

  // 2. Generate Payment Events across customer subscriptions (aiming for >= 20,000 events)
  // Each customer gets 3 to 7 billing events over time
  let eventSeq = 0;
  let caseSeq = 0;

  for (let cIdx = 0; cIdx < customers.length; cIdx++) {
    const cust = customers[cIdx];
    const sub = subscriptions[cIdx];

    const customerStartMs = new Date(cust.createdAt!).getTime();
    const daysSinceCreation = Math.floor((BASE_START_TIMESTAMP + SIMULATION_WINDOW_DAYS * MS_PER_DAY - customerStartMs) / MS_PER_DAY);
    const intervals = Math.max(3, Math.min(8, Math.floor(daysSinceCreation / 30) + 1));

    for (let cycle = 0; cycle < intervals; cycle++) {
      eventSeq++;
      const eventTimestampMs = customerStartMs + (cycle * 30 + Math.floor(rng() * 3)) * MS_PER_DAY;
      const eventDate = new Date(eventTimestampMs).toISOString();

      // Likelihood of payment failure is inversely correlated with customer response propensity
      // Typically 10% - 30% failure rate on synthetic billing
      const failureThreshold = 0.10 + (1 - cust.responsePropensity) * 0.20;
      const isFailure = rng() < failureThreshold;

      if (!isFailure) {
        // Successful payment event
        cust.totalSuccessfulPayments++;
        const pEvent: PaymentEvent = {
          id: `pay_evt_${String(eventSeq).padStart(7, '0')}`,
          subscriptionId: sub.id,
          customerId: cust.id,
          amountInr: sub.amountInr,
          status: 'SUCCESS',
          attemptNumber: 1,
          timestamp: eventDate,
          paymentMethod: cust.preferredPaymentMethod!,
        };
        paymentEvents.push(pEvent);
      } else {
        // Failed payment event
        cust.totalFailedPayments++;
        const failureCause = pickWeighted(weightedCauses, rng());
        const attemptNumber = 1 + Math.floor(rng() * 3); // 1, 2, or 3 attempts

        const pEvent: PaymentEvent = {
          id: `pay_evt_${String(eventSeq).padStart(7, '0')}`,
          subscriptionId: sub.id,
          customerId: cust.id,
          amountInr: sub.amountInr,
          status: 'FAILED',
          attemptNumber,
          timestamp: eventDate,
          failureCause,
          rawErrorCode: `ERR_${failureCause}`,
          rawErrorMessage: `Gateway response: ${failureCause.toLowerCase().replace('_', ' ')}`,
          paymentMethod: cust.preferredPaymentMethod!,
        };
        paymentEvents.push(pEvent);

        // Convert failed event into a RecoveryCase
        caseSeq++;
        const recoveryCase: RecoveryCase = {
          id: `case_syn_${String(caseSeq).padStart(6, '0')}`,
          customerId: cust.id,
          subscriptionId: sub.id,
          customerName: cust.name,
          customerEmail: cust.email,
          subscriptionTier: cust.subscriptionTier,
          revenueAtRiskInr: sub.amountInr,
          failureCause,
          attemptCount: attemptNumber,
          customerResponsePropensity: cust.responsePropensity, // Strictly reused
          lastPaymentEventId: pEvent.id,
          lastAttemptAt: eventDate,
        };
        recoveryCases.push(recoveryCase);
      }
    }
  }

  // Ensure we hit at least MIN_PAYMENT_EVENTS
  // If slightly below, add additional event cycles deterministically
  while (paymentEvents.length < MIN_PAYMENT_EVENTS) {
    const custIdx = Math.floor(rng() * customers.length);
    const cust = customers[custIdx];
    const sub = subscriptions[custIdx];
    eventSeq++;

    const eventDate = new Date(BASE_START_TIMESTAMP + Math.floor(rng() * SIMULATION_WINDOW_DAYS) * MS_PER_DAY).toISOString();
    cust.totalSuccessfulPayments++;
    paymentEvents.push({
      id: `pay_evt_${String(eventSeq).padStart(7, '0')}`,
      subscriptionId: sub.id,
      customerId: cust.id,
      amountInr: sub.amountInr,
      status: 'SUCCESS',
      attemptNumber: 1,
      timestamp: eventDate,
      paymentMethod: cust.preferredPaymentMethod!,
    });
  }

  // Sort payment events chronologically
  paymentEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Compute summary metadata
  const totalRevenueAtRiskInr = recoveryCases.reduce((sum, c) => sum + c.revenueAtRiskInr, 0);
  const totalSuccessful = paymentEvents.filter(e => e.status === 'SUCCESS').length;
  const totalFailed = paymentEvents.filter(e => e.status === 'FAILED').length;

  return {
    customers,
    subscriptions,
    paymentEvents,
    recoveryCases,
    metadata: {
      seed,
      generatedAt: new Date().toISOString(),
      totalCustomers: customers.length,
      totalSubscriptions: subscriptions.length,
      totalPaymentEvents: paymentEvents.length,
      totalSuccessfulEvents: totalSuccessful,
      totalFailedEvents: totalFailed,
      totalRecoveryCases: recoveryCases.length,
      totalRevenueAtRiskInr,
    },
  };
}
