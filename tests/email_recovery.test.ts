import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mapInterventionToRecoveryAction,
  formatRecoveryCaseEmailPayload,
  sendEmailViaResend,
} from '../src/services/email.ts';
import { InterventionType, RecoveryCase } from '../src/types.ts';

console.log('--- Running Email & Recovery Engine Integration Test Suite ---');

// Test 1: Action mapping test
const testCases: Array<[InterventionType, string]> = [
  [InterventionType.SMART_RETRY, 'Smart Retry'],
  [InterventionType.PERSONALIZED_PAYMENT_LINK, 'Payment Link'],
  [InterventionType.PAYMENT_METHOD_UPDATE, 'Payment Link'],
  [InterventionType.CUSTOMER_NOTIFICATION, 'Discount Offer'],
  [InterventionType.ESCALATION_MANUAL_REVIEW, 'Escalation'],
];

for (const [intervention, expectedAction] of testCases) {
  const mapped = mapInterventionToRecoveryAction(intervention);
  assert.strictEqual(
    mapped,
    expectedAction,
    `Expected ${intervention} to map to ${expectedAction}, got ${mapped}`
  );
}
console.log('  ✓ Action Mapping: All 4 recovery actions (Smart Retry, Payment Link, Discount Offer, Escalation) mapped accurately');

// Test 2: Email payload format test
const mockCase: Partial<RecoveryCase> = {
  id: 'case_test_999',
  customerName: 'Acme Software Labs',
  customerEmail: 'tamannashaikh702@gmail.com',
  revenueAtRiskInr: 12500,
  recommendedIntervention: InterventionType.SMART_RETRY,
  failureCause: 'INSUFFICIENT_FUNDS' as any,
  recoveryProbability: 0.82,
  subscriptionId: 'sub_enterprise_001',
  policyRuleDecision: 'ALLOW',
  actionState: 'RECOVERED',
};

const payload = formatRecoveryCaseEmailPayload(mockCase);
assert.strictEqual(payload.actionName, 'Smart Retry');
assert.strictEqual(payload.to, 'tamannashaikh702@gmail.com');
assert(payload.subject.includes('Smart Retry'), 'Subject must contain action name');
assert(payload.message.includes('12,500'), 'Message must contain formatted amount');
assert(payload.message.includes('Acme Software Labs'), 'Message must contain customer name');
console.log('  ✓ Email Formatting: Generated canonical payload with real-time recovery event details');

// Test 3: Live Resend email dispatch
const resendKey = process.env.RESEND_API_KEY;
assert(Boolean(resendKey), 'RESEND_API_KEY must be configured in environment');

sendEmailViaResend({
  to: 'tamannashaikh702@gmail.com',
  subject: payload.subject,
  message: payload.message,
}).then((res) => {
  assert.strictEqual(res.success, true, `Expected email send to succeed: ${res.error}`);
  assert(Boolean(res.data?.id), 'Response must contain Resend message ID');
  console.log(`  ✓ Resend Live Delivery: Email dispatched successfully with ID: ${res.data.id}`);
  console.log('--- All Email & Recovery Engine Tests Passed! ---');
}).catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
