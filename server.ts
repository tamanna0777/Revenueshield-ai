import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import {
  processRazorpayWebhook,
  createSignedTestWebhookPayload,
  isRazorpayConfigured,
  getRazorpayEnvironment,
} from './src/services/razorpay.ts';
import {
  getPolicyConfig,
  updatePolicyConfig,
  setKillSwitch,
  isKillSwitchEnabled,
} from './src/agents/policy.ts';
import { getAuditTrail, clearAuditTrail } from './src/agents/audit.ts';
import {
  addSimulatedCase,
  resetDemoState,
  approveRecoveryCase,
  rejectRecoveryCase,
} from './src/services/revenueRecovery.ts';
import {
  sendEmailViaResend,
  formatRecoveryCaseEmailPayload,
} from './src/services/email.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Dedicated Raw Body endpoint for Razorpay Webhooks
  // CRITICAL: Must consume unmodified raw request body for HMAC-SHA256 signature verification
  app.post(
    '/api/webhooks/razorpay',
    express.raw({ type: '*/*' }),
    (req, res) => {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      const rawBody = req.body;

      const result = processRazorpayWebhook({
        rawBody,
        signature,
        targetEnvironment: getRazorpayEnvironment(),
      });

      if (result.recoveryCase) {
        addSimulatedCase(result.recoveryCase);
        // Automatically dispatch recovery action email in real time
        const alertPayload = formatRecoveryCaseEmailPayload(result.recoveryCase);
        sendEmailViaResend(alertPayload).catch((err) => {
          console.error('[RevenueShield Auto-Alert Error]:', err);
        });
      }

      return res.status(result.statusCode).json({
        success: result.success,
        message: result.message,
        eventId: result.eventId,
        environment: result.environment,
        actionState: result.actionState,
        recoveryCase: result.recoveryCase,
        auditEntry: result.auditEntry,
      });
    }
  );

  // Standard JSON parser for other API routes
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'RevenueShield AI',
      timestamp: new Date().toISOString(),
    });
  });

  // System and Policy Status
  app.get('/api/status', (_req, res) => {
    res.json({
      environment: getRazorpayEnvironment(),
      isConfigured: isRazorpayConfigured(),
      killSwitchEnabled: isKillSwitchEnabled(),
      policyConfig: getPolicyConfig(),
    });
  });

  // Policy configuration management
  app.get('/api/policy', (_req, res) => {
    res.json(getPolicyConfig());
  });

  app.post('/api/policy/config', (req, res) => {
    const updated = updatePolicyConfig(req.body);
    res.json(updated);
  });

  app.post('/api/policy/kill-switch', (req, res) => {
    const { enabled } = req.body;
    const currentState = setKillSwitch(Boolean(enabled));
    res.json({ killSwitchEnabled: currentState });
  });

  // Audit trail endpoint (without credentials)
  app.get('/api/audit', (_req, res) => {
    res.json(getAuditTrail());
  });

  // Local Webhook Simulation Endpoint
  // Allows testing a complete signed test-mode webhook in demo/sandbox environments
  app.post('/api/webhooks/test-simulate', (req, res) => {
    const {
      event = 'payment.failed',
      amountInr = 4500,
      errorCode = 'BAD_REQUEST_PAYMENT_ACCOUNT_INSUFFICIENT_BALANCE',
      errorDescription = 'Payment failed due to insufficient funds in customer bank account',
      errorReason = 'insufficient_funds',
      attemptCount = 1,
    } = req.body;

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_rs_2026';
    const signed = createSignedTestWebhookPayload({
      event,
      amountInr,
      errorCode,
      errorDescription,
      errorReason,
      secret,
      attemptCount,
    });

    const result = processRazorpayWebhook({
      rawBody: signed.rawBody,
      signature: signed.signature,
      webhookSecret: secret,
      targetEnvironment: 'TEST',
      dryRun: true,
    });

    if (result.recoveryCase) {
      addSimulatedCase(result.recoveryCase);
      // Automatically dispatch recovery action email in real time
      const alertPayload = formatRecoveryCaseEmailPayload(result.recoveryCase);
      sendEmailViaResend(alertPayload).catch((err) => {
        console.error('[RevenueShield Auto-Alert Error]:', err);
      });
    }

    return res.status(result.statusCode).json({
      ...result,
      simulationNote: 'Simulated signed Razorpay Test Mode event processed via internal adapter',
    });
  });

  // Resend Email Endpoint (Step 2)
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, message, html, templateType, variables, recoveryCase } = req.body || {};

      const targetEmail =
        to ||
        recoveryCase?.customerEmail ||
        'customer@acmecorp.com';

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'RESEND_API_KEY environment variable is not configured',
        });
      }

      const result = await sendEmailViaResend({
        to: targetEmail,
        subject,
        message,
        html,
        templateType,
        variables,
        recoveryCase,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        recipient: result.recipient,
        fallbackUsed: result.fallbackUsed,
        message: 'Recovery action alert successfully sent via Resend',
      });
    } catch (err: any) {
      console.error('[RevenueShield API] Error in /api/send-email:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error while sending email',
      });
    }
  });

  // Manual or UI Recovery Action Trigger & Email Dispatch
  app.post('/api/recovery/trigger-action', async (req, res) => {
    try {
      const recoveryCase = req.body?.recoveryCase || req.body;
      if (!recoveryCase || !recoveryCase.id) {
        return res.status(400).json({
          success: false,
          error: 'Missing recovery case data in request body',
        });
      }

      const emailPayload = formatRecoveryCaseEmailPayload(recoveryCase);
      const emailResult = await sendEmailViaResend(emailPayload);

      return res.status(200).json({
        success: true,
        action: emailPayload.actionName,
        emailResult,
        caseId: recoveryCase.id,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to execute recovery action and notify',
      });
    }
  });

  // Demo Environment Reset Endpoint
  app.post('/api/demo/reset', (_req, res) => {
    const state = resetDemoState();
    res.json({
      success: true,
      message: 'Demo environment reset to canonical benchmark state (seed 2026)',
      policyConfig: getPolicyConfig(),
      killSwitchEnabled: isKillSwitchEnabled(),
      casesCount: state.executedCases.length,
    });
  });

  // Case Approval Workflow Endpoints (Step 3: Pending Approval)
  app.post('/api/cases/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { approver = 'Admin' } = req.body || {};
      const updatedCase = approveRecoveryCase(id, approver);

      if (!updatedCase) {
        return res.status(404).json({
          success: false,
          error: `Case not found with ID: ${id}`,
        });
      }

      // Automatically dispatch Resend email notification
      const emailPayload = formatRecoveryCaseEmailPayload(updatedCase);
      let emailResult = null;
      try {
        emailResult = await sendEmailViaResend(emailPayload);
      } catch (e: any) {
        console.error('[Approve Notification Warning]:', e.message);
      }

      return res.status(200).json({
        success: true,
        message: `Case ${id} approved by ${approver} and recovery action executed`,
        case: updatedCase,
        emailResult,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error processing approval',
      });
    }
  });

  app.post('/api/cases/:id/reject', (req, res) => {
    try {
      const { id } = req.params;
      const { approver = 'Admin' } = req.body || {};
      const updatedCase = rejectRecoveryCase(id, approver);

      if (!updatedCase) {
        return res.status(404).json({
          success: false,
          error: `Case not found with ID: ${id}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Case ${id} rejected by ${approver}. Action cancelled.`,
        case: updatedCase,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error processing rejection',
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RevenueShield AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
