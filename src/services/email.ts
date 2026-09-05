import { Resend } from 'resend';
import { RecoveryCase } from '../types.ts';
import {
  CustomerEmailTemplateType,
  CustomerEmailTemplateVariables,
  CUSTOMER_EMAIL_TEMPLATES,
  renderCustomerEmailHtml,
  renderCustomerEmailText,
  resolveCustomerTemplateType,
  buildCustomerVariablesFromCase,
} from './emailTemplates.ts';

export * from './emailTemplates.ts';

export type RecoveryActionName =
  | 'Smart Retry'
  | 'Payment Link'
  | 'Discount Offer'
  | 'Payment Method Update Request';

export interface EmailRequestPayload {
  to: string;
  subject?: string;
  message?: string;
  html?: string;
  templateType?: CustomerEmailTemplateType;
  variables?: Partial<CustomerEmailTemplateVariables>;
  recoveryCase?: Partial<RecoveryCase>;
}

export interface SendEmailResult {
  success: boolean;
  data?: any;
  error?: string;
  recipient?: string;
  fallbackUsed?: boolean;
}

/**
 * Maps an intervention or case to the canonical user-facing action title.
 */
export function mapInterventionToRecoveryAction(
  intervention?: string | null
): RecoveryActionName {
  const type = resolveCustomerTemplateType(intervention);
  switch (type) {
    case 'smart_retry':
      return 'Smart Retry';
    case 'payment_link':
      return 'Payment Link';
    case 'discount_offer':
      return 'Discount Offer';
    case 'payment_method_update':
      return 'Payment Method Update Request';
    default:
      return 'Smart Retry';
  }
}

/**
 * Formats a clean, professional, customer-facing email notification payload.
 *
 * Guaranteed free of:
 * - Developer names
 * - Internal IDs
 * - Audit payloads & JSON dumps
 * - Risk scores & probability metrics
 * - Policy decisions & sandbox/test labels
 * - Technical recovery engine terminology
 */
export function formatRecoveryCaseEmailPayload(
  recoveryCase: Partial<RecoveryCase>,
  overrideTemplateType?: CustomerEmailTemplateType
): {
  to: string;
  subject: string;
  message: string;
  html: string;
  actionName: RecoveryActionName;
  templateType: CustomerEmailTemplateType;
  variables: CustomerEmailTemplateVariables;
} {
  const templateType =
    overrideTemplateType ||
    resolveCustomerTemplateType(recoveryCase.recommendedIntervention);

  const variables = buildCustomerVariablesFromCase(recoveryCase);
  const templateDef = CUSTOMER_EMAIL_TEMPLATES[templateType];

  const subject = templateDef.subject;
  const html = renderCustomerEmailHtml(templateType, variables);
  const text = renderCustomerEmailText(templateType, variables);
  const actionName = mapInterventionToRecoveryAction(
    recoveryCase.recommendedIntervention
  );

  const customerEmail =
    recoveryCase.customerEmail &&
    recoveryCase.customerEmail.includes('@') &&
    !recoveryCase.customerEmail.includes('founder@')
      ? recoveryCase.customerEmail
      : 'customer@acmecorp.com';

  return {
    to: customerEmail,
    subject,
    message: text,
    html,
    actionName,
    templateType,
    variables,
  };
}

/**
 * Dispatches a customer email using the Resend SDK.
 * Sends responsive HTML along with plain-text fallback.
 */
export async function sendEmailViaResend(
  payload: EmailRequestPayload
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'RESEND_API_KEY environment variable is not configured',
    };
  }

  const resend = new Resend(apiKey);
  const targetEmail = payload.to?.trim() || 'customer@acmecorp.com';

  // Determine template, subject, HTML, and text
  let templateType: CustomerEmailTemplateType =
    payload.templateType ||
    (payload.recoveryCase
      ? resolveCustomerTemplateType(payload.recoveryCase.recommendedIntervention)
      : 'smart_retry');

  let variables: CustomerEmailTemplateVariables = payload.recoveryCase
    ? buildCustomerVariablesFromCase(payload.recoveryCase)
    : {
        customerName: 'Valued Customer',
        companyName: 'RevenueShield AI',
        amount: '₹14,999',
        paymentLink: 'https://billing.revenueshield.ai/pay/secure_checkout',
        discountPercent: '20% OFF',
        discountAmount: '₹3,000',
        billingPortalUrl: 'https://billing.revenueshield.ai/portal',
        ...(payload.variables || {}),
      };

  if (payload.variables) {
    variables = { ...variables, ...payload.variables };
  }

  const templateDef = CUSTOMER_EMAIL_TEMPLATES[templateType];
  const emailSubject = payload.subject || templateDef.subject;
  const emailHtml = payload.html || renderCustomerEmailHtml(templateType, variables);
  const emailText = payload.message || renderCustomerEmailText(templateType, variables);

  try {
    let sendResult = await resend.emails.send({
      from: 'RevenueShield <onboarding@resend.dev>',
      to: [targetEmail],
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    let fallbackUsed = false;
    // If running in Resend's free tier sandbox that restricts recipients to the verified developer address:
    if (
      sendResult.error &&
      typeof sendResult.error.message === 'string' &&
      sendResult.error.message.includes('only send testing emails to your own email address')
    ) {
      // In Resend free sandbox, route message envelope to verified account without altering the subject or body
      const authorizedSandboxRecipient =
        process.env.RESEND_VERIFIED_EMAIL || 'tamannashaikh702@gmail.com';

      sendResult = await resend.emails.send({
        from: 'RevenueShield <onboarding@resend.dev>',
        to: [authorizedSandboxRecipient],
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });
      fallbackUsed = true;
    }

    if (sendResult.error) {
      console.error('[RevenueShield Resend Error]:', sendResult.error);
      return {
        success: false,
        error: sendResult.error.message || 'Failed to send email via Resend',
        recipient: targetEmail,
      };
    }

    return {
      success: true,
      data: sendResult.data,
      recipient: targetEmail,
      fallbackUsed,
    };
  } catch (err: any) {
    console.error('[RevenueShield Resend Exception]:', err);
    return {
      success: false,
      error: err?.message || 'Unexpected exception sending email via Resend',
      recipient: targetEmail,
    };
  }
}
