/**
 * RevenueShield AI - Customer-Facing Email Templates
 *
 * Professional, modern, responsive HTML billing notifications for SaaS end customers.
 * Completely free of technical jargon, internal IDs, risk scores, or sandbox labels.
 */

export type CustomerEmailTemplateType =
  | 'smart_retry'
  | 'payment_link'
  | 'discount_offer'
  | 'payment_method_update';

export interface CustomerEmailTemplateVariables {
  customerName: string;
  companyName: string;
  amount: string;
  paymentLink: string;
  discountPercent: string;
  discountAmount: string;
  billingPortalUrl: string;
}

export interface CustomerEmailTemplateDefinition {
  id: CustomerEmailTemplateType;
  name: string;
  subject: string;
  buttonText: string;
  description: string;
  defaultVariables: CustomerEmailTemplateVariables;
}

export const DEFAULT_TEMPLATE_VARIABLES: CustomerEmailTemplateVariables = {
  customerName: 'Alex Morgan',
  companyName: 'RevenueShield AI',
  amount: '₹14,999',
  paymentLink: 'https://billing.revenueshield.ai/pay/session_secure_checkout',
  discountPercent: '20% OFF',
  discountAmount: '₹3,000',
  billingPortalUrl: 'https://billing.revenueshield.ai/portal',
};

export const CUSTOMER_EMAIL_TEMPLATES: Record<
  CustomerEmailTemplateType,
  CustomerEmailTemplateDefinition
> = {
  smart_retry: {
    id: 'smart_retry',
    name: 'Smart Retry',
    subject: "We're retrying your payment",
    buttonText: 'Manage Billing',
    description:
      'Reassures the customer that their payment is automatically being retried with no immediate action needed.',
    defaultVariables: {
      ...DEFAULT_TEMPLATE_VARIABLES,
    },
  },
  payment_link: {
    id: 'payment_link',
    name: 'Payment Link',
    subject: 'Complete your payment securely',
    buttonText: 'Pay Now',
    description:
      'Provides a secure, direct payment link so the customer can complete their subscription renewal immediately.',
    defaultVariables: {
      ...DEFAULT_TEMPLATE_VARIABLES,
    },
  },
  discount_offer: {
    id: 'discount_offer',
    name: 'Discount Offer',
    subject: 'Special offer to keep your subscription active',
    buttonText: 'Renew Subscription',
    description:
      'Presents a targeted retention incentive with highlighted savings to encourage immediate renewal.',
    defaultVariables: {
      ...DEFAULT_TEMPLATE_VARIABLES,
      discountPercent: '20% OFF',
      discountAmount: '₹3,000',
    },
  },
  payment_method_update: {
    id: 'payment_method_update',
    name: 'Payment Method Update Request',
    subject: 'Update your payment method',
    buttonText: 'Update Payment Method',
    description:
      'Prompts the customer to update their expired or invalid card details to prevent service disruption.',
    defaultVariables: {
      ...DEFAULT_TEMPLATE_VARIABLES,
    },
  },
};

/**
 * Replaces dynamic variables:
 * {{customerName}}, {{companyName}}, {{amount}}, {{paymentLink}},
 * {{discountPercent}}, {{discountAmount}}, {{billingPortalUrl}}
 */
export function interpolateVariables(
  text: string,
  variables: Partial<CustomerEmailTemplateVariables>
): string {
  const merged: CustomerEmailTemplateVariables = {
    ...DEFAULT_TEMPLATE_VARIABLES,
    ...variables,
  };

  return text
    .replace(/\{\{customerName\}\}/g, merged.customerName || 'Customer')
    .replace(/\{\{companyName\}\}/g, merged.companyName || 'RevenueShield AI')
    .replace(/\{\{amount\}\}/g, merged.amount || '₹0')
    .replace(/\{\{paymentLink\}\}/g, merged.paymentLink || '#')
    .replace(/\{\{discountPercent\}\}/g, merged.discountPercent || '15% OFF')
    .replace(/\{\{discountAmount\}\}/g, merged.discountAmount || '₹0')
    .replace(/\{\{billingPortalUrl\}\}/g, merged.billingPortalUrl || '#');
}

/**
 * Generates customer-friendly plain text content for the specified template.
 */
export function renderCustomerEmailText(
  type: CustomerEmailTemplateType,
  vars: Partial<CustomerEmailTemplateVariables>
): string {
  const v: CustomerEmailTemplateVariables = {
    ...DEFAULT_TEMPLATE_VARIABLES,
    ...vars,
  };

  const greeting = v.customerName ? `Hello ${v.customerName},` : 'Hello,';

  let body = '';
  switch (type) {
    case 'smart_retry':
      body = [
        greeting,
        '',
        'We noticed that your recent subscription payment could not be completed.',
        '',
        'No action is needed right now. We will automatically retry the payment shortly.',
        '',
        'If the issue persists, we will notify you with next steps.',
        '',
        'Thank you for choosing us.',
        '',
        `Manage Billing: ${v.billingPortalUrl}`,
      ].join('\n');
      break;

    case 'payment_link':
      body = [
        greeting,
        '',
        'We were unable to process your recent subscription payment.',
        '',
        'Please use the secure payment link below to complete your payment and continue uninterrupted service.',
        '',
        `Amount Due: ${v.amount}`,
        `Pay Now: ${v.paymentLink}`,
      ].join('\n');
      break;

    case 'discount_offer':
      body = [
        greeting,
        '',
        "We'd love to keep you with us.",
        '',
        'Complete your subscription renewal today and receive the special offer shown below.',
        '',
        `Offer Percentage: ${v.discountPercent}`,
        `Savings Amount: ${v.discountAmount}`,
        `Subscription Renewal Amount: ${v.amount}`,
        '',
        `Renew Subscription: ${v.paymentLink}`,
      ].join('\n');
      break;

    case 'payment_method_update':
      body = [
        greeting,
        '',
        'Your payment method requires attention.',
        '',
        'Please update your billing information to avoid any interruption to your subscription.',
        '',
        `Update Payment Method: ${v.billingPortalUrl}`,
      ].join('\n');
      break;
  }

  const footer = [
    '',
    '--------------------------------------------------',
    'Need help?',
    'Contact our support team anytime.',
    '',
    `© ${v.companyName || 'RevenueShield AI'}`,
  ].join('\n');

  return body + '\n' + footer;
}

/**
 * Generates modern, responsive, bulletproof HTML email for the specified template.
 */
export function renderCustomerEmailHtml(
  type: CustomerEmailTemplateType,
  vars: Partial<CustomerEmailTemplateVariables>
): string {
  const v: CustomerEmailTemplateVariables = {
    ...DEFAULT_TEMPLATE_VARIABLES,
    ...vars,
  };

  const greeting = v.customerName ? `Hello ${v.customerName},` : 'Hello,';
  const tmpl = CUSTOMER_EMAIL_TEMPLATES[type];
  const subject = tmpl.subject;

  let bodyContentHtml = '';
  let ctaButtonHtml = '';

  switch (type) {
    case 'smart_retry': {
      bodyContentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          ${greeting}
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          We noticed that your recent subscription payment could not be completed.
        </p>
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
          <div style="font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 6px;">
            Payment Retry in Progress
          </div>
          <div style="font-size: 14px; line-height: 1.5; color: #475569;">
            No action is needed right now. We will automatically retry the payment shortly.
          </div>
          ${
            v.amount
              ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #CBD5E1; font-size: 13px; color: #64748B;">
                  Subscription Amount: <strong style="color: #0F172A; font-size: 14px;">${v.amount}</strong>
                </div>`
              : ''
          }
        </div>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          If the issue persists, we will notify you with next steps.
        </p>
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          Thank you for choosing us.
        </p>
      `;

      ctaButtonHtml = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #635BFF;">
              <a href="${v.billingPortalUrl}" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; letter-spacing: 0.2px;">
                Manage Billing
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }

    case 'payment_link': {
      bodyContentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          ${greeting}
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          We were unable to process your recent subscription payment.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          Please use the secure payment link below to complete your payment and continue uninterrupted service.
        </p>
        
        <!-- Payment Details Summary Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 18px 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 13px; color: #64748B; font-weight: 500;">
                    Amount Due
                  </td>
                  <td align="right" style="font-size: 18px; font-weight: 700; color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    ${v.amount}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 10px; font-size: 12px; color: #64748B;">
                    🔒 256-bit encrypted checkout with instant receipt confirmation
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      ctaButtonHtml = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #635BFF;">
              <a href="${v.paymentLink}" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.2px;">
                Pay Now
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }

    case 'discount_offer': {
      bodyContentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          ${greeting}
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          We'd love to keep you with us.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          Complete your subscription renewal today and receive the special offer shown below.
        </p>

        <!-- Dedicated Offer Display Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 2px solid #635BFF; border-radius: 10px; margin: 22px 0; overflow: hidden;">
          <tr>
            <td style="background-color: #635BFF; padding: 10px 20px; color: #FFFFFF; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
              Exclusive Renewal Benefit
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 12px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 13px; color: #64748B; font-weight: 500; display: block;">Offer Percentage</span>
                    <strong style="font-size: 22px; color: #635BFF; font-weight: 800;">${v.discountPercent}</strong>
                  </td>
                  <td align="right" style="padding-bottom: 12px; border-bottom: 1px solid #E2E8F0;">
                    <span style="font-size: 13px; color: #64748B; font-weight: 500; display: block;">Savings Amount</span>
                    <strong style="font-size: 20px; color: #10B981; font-weight: 800;">${v.discountAmount}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px; font-size: 13px; color: #475569;">
                    Regular Subscription: <span style="text-decoration: line-through; color: #94A3B8;">${v.amount}</span>
                  </td>
                  <td align="right" style="padding-top: 12px; font-size: 12px; color: #64748B;">
                    Applied automatically at checkout
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      ctaButtonHtml = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #635BFF;">
              <a href="${v.paymentLink}" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.2px;">
                Renew Subscription
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }

    case 'payment_method_update': {
      bodyContentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          ${greeting}
        </p>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          Your payment method requires attention.
        </p>
        <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
          Please update your billing information to avoid any interruption to your subscription.
        </p>
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 20px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <div style="font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 4px;">
                Secure Card & Payment Method Portal
              </div>
              <div style="font-size: 13px; color: #64748B; line-height: 1.5;">
                You can add a new credit/debit card, UPI autopay, or alternate billing method in seconds.
              </div>
              ${
                v.amount
                  ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 13px; color: #475569;">
                      Pending Renewal: <strong style="color: #0F172A;">${v.amount}</strong>
                    </div>`
                  : ''
              }
            </td>
          </tr>
        </table>
      `;

      ctaButtonHtml = `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #635BFF;">
              <a href="${v.billingPortalUrl}" target="_blank" style="font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.2px;">
                Update Payment Method
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <center style="width: 100%; background-color: #F1F5F9; padding: 32px 0 40px 0;">
    <!-- Main Email Container -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto;" class="email-container">
      
      <!-- Top Brand Header Bar -->
      <tr>
        <td style="padding: 0 0 16px 0; text-align: left;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color: #635BFF; width: 28px; height: 28px; border-radius: 7px; text-align: center; vertical-align: middle;">
                      <span style="color: #FFFFFF; font-size: 16px; font-weight: 800; line-height: 28px;">🛡️</span>
                    </td>
                    <td style="padding-left: 10px; font-size: 16px; font-weight: 700; color: #0F172A; letter-spacing: -0.2px;">
                      ${v.companyName || 'RevenueShield'}
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="vertical-align: middle;">
                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; background-color: #E2E8F0; padding: 4px 8px; border-radius: 4px;">
                  Billing Notice
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Card Body -->
      <tr>
        <td style="background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04); overflow: hidden;">
          
          <!-- Top Accent Line -->
          <div style="height: 4px; background-color: #635BFF; width: 100%;"></div>

          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 32px;" class="mobile-padding">
                
                <!-- Email Subject Heading -->
                <h1 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0F172A; line-height: 1.3; letter-spacing: -0.3px;">
                  ${subject}
                </h1>

                <!-- Body Content -->
                ${bodyContentHtml}

                <!-- Call to Action Button -->
                ${ctaButtonHtml}

                <!-- Assistance Note -->
                <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #F1F5F9; font-size: 13px; line-height: 1.5; color: #64748B;">
                  Questions regarding this notice? Simply reply to this email or visit our billing center anytime.
                </p>

              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Standard Customer Footer -->
      <tr>
        <td style="padding: 24px 16px 0 16px; text-align: center;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="font-size: 13px; line-height: 1.6; color: #64748B;">
                <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">
                  Need help?
                </p>
                <p style="margin: 0 0 12px 0;">
                  Contact our support team anytime.
                </p>
                <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                  © ${v.companyName || 'RevenueShield AI'}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>
  `.trim();
}

/**
 * Maps an intervention to the appropriate customer email template type:
 * - SMART_RETRY -> smart_retry
 * - PERSONALIZED_PAYMENT_LINK -> payment_link
 * - CUSTOMER_NOTIFICATION -> discount_offer
 * - PAYMENT_METHOD_UPDATE -> payment_method_update
 * - ESCALATION_MANUAL_REVIEW -> payment_link
 */
export function resolveCustomerTemplateType(
  intervention?: string | null
): CustomerEmailTemplateType {
  if (!intervention) return 'smart_retry';

  const normalized = intervention.toUpperCase();

  if (normalized.includes('UPDATE') || normalized.includes('METHOD')) {
    return 'payment_method_update';
  }
  if (normalized.includes('NOTIFICATION') || normalized.includes('DISCOUNT') || normalized.includes('OFFER')) {
    return 'discount_offer';
  }
  if (normalized.includes('LINK') || normalized.includes('PAYMENT_LINK') || normalized.includes('ESCALATION')) {
    return 'payment_link';
  }
  if (normalized.includes('RETRY')) {
    return 'smart_retry';
  }

  return 'smart_retry';
}

/**
 * Converts a recovery case into clean customer-facing template variables.
 * Excludes all internal IDs, scores, and technical engine properties.
 */
export function buildCustomerVariablesFromCase(
  c: any
): CustomerEmailTemplateVariables {
  const amountNumber = Number(c.revenueAtRiskInr || c.amount || 0);
  const formattedAmount = amountNumber > 0 ? `₹${amountNumber.toLocaleString('en-IN')}` : '₹14,999';

  // Calculate clean 20% discount offer
  const discountPct = '20% OFF';
  const discountVal = amountNumber > 0 ? Math.round(amountNumber * 0.2) : 3000;
  const formattedDiscountAmount = `₹${discountVal.toLocaleString('en-IN')}`;

  const cleanName =
    c.customerName && c.customerName !== 'Subscriber' && !c.customerName.includes('case-')
      ? c.customerName
      : 'Valued Customer';

  return {
    customerName: cleanName,
    companyName: 'RevenueShield AI',
    amount: formattedAmount,
    paymentLink: 'https://billing.revenueshield.ai/pay/secure_checkout',
    discountPercent: discountPct,
    discountAmount: formattedDiscountAmount,
    billingPortalUrl: 'https://billing.revenueshield.ai/portal',
  };
}
