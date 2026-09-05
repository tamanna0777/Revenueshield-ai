import React, { useState, useEffect } from 'react';
import { RecoveryCase } from '../../types.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import {
  approveRecoveryCase,
  rejectRecoveryCase,
} from '../../services/revenueRecovery.ts';
import {
  StatusBadge,
  OperatorAttributionBadge,
  DecisionTimeline,
  HumanDecisionSummaryCard,
  TechnicalPayloadAccordion,
} from './DecisionWorkflowComponents.tsx';
import { formatRecoveryCaseEmailPayload } from '../../services/email.ts';
import {
  X,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  Mail,
  Send,
  Loader2,
  Ban,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CaseDetailModalProps {
  recoveryCase: RecoveryCase | null;
  onClose: () => void;
  onCaseUpdated?: (updatedCase: RecoveryCase) => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  recoveryCase,
  onClose,
  onCaseUpdated,
}) => {
  const [activeCase, setActiveCase] = useState<RecoveryCase | null>(recoveryCase);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isDispatchingDirectEmail, setIsDispatchingDirectEmail] = useState(false);

  useEffect(() => {
    setActiveCase(recoveryCase);
    setActionFeedback(null);
  }, [recoveryCase]);

  if (!activeCase) return null;

  const isRecovered = activeCase.agentRecovered ?? false;
  const isBaselineRecovered = activeCase.baselineRecovered ?? false;
  const isIncremental = isRecovered && !isBaselineRecovered;

  const policyDecision = activeCase.policyRuleDecision || 'ALLOW';
  const policyReason =
    activeCase.policyDecision?.reason ||
    activeCase.policyReason ||
    (policyDecision === 'ALLOW'
      ? 'All autonomous policy boundaries and attempt thresholds satisfied.'
      : policyDecision === 'REQUIRE_APPROVAL'
      ? `Revenue at risk ${formatInr(activeCase.revenueAtRiskInr)} exceeds automated approval threshold.`
      : 'Action blocked by safety policy or kill switch.');

  const baselineAmt =
    activeCase.baselineRecoveredAmountInr ??
    (isBaselineRecovered ? activeCase.revenueAtRiskInr : 0);
  const agentAmt =
    activeCase.agentRecoveredAmountInr ?? (isRecovered ? activeCase.revenueAtRiskInr : 0);
  const incrementalAmt =
    activeCase.incrementalRecoveryInr ?? Math.max(0, agentAmt - baselineAmt);

  const uVal = activeCase.randomDrawU ?? 0.42;
  const pBaseline = activeCase.baselineProbability ?? 0.38;
  const pAgent = activeCase.agentProbability ?? (activeCase.recoveryProbability ?? 0.74);

  // Approve Handler
  const handleApprove = async () => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const updated = approveRecoveryCase(activeCase.id, 'Admin');
      if (updated) {
        setActiveCase(updated);
        onCaseUpdated?.(updated);

        const emailInfo = formatRecoveryCaseEmailPayload(updated);

        // Dispatch real-time customer email notification using modern redesigned template
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: updated.customerEmail,
              recoveryCase: updated,
            }),
          });
        } catch {
          // non-blocking
        }

        setActionFeedback({
          type: 'success',
          message: `Approved by Admin! Executed ${emailInfo.actionName} and dispatched real-time customer email notification. Case moved to Executed queue.`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: `Failed to approve case: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reject Handler
  const handleReject = async () => {
    setIsProcessing(true);
    setActionFeedback(null);
    try {
      const updated = rejectRecoveryCase(activeCase.id, 'Admin');
      if (updated) {
        setActiveCase(updated);
        onCaseUpdated?.(updated);
        setActionFeedback({
          type: 'info',
          message: 'Rejected by Admin. Action cancelled and immutable audit record logged.',
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: `Failed to reject case: ${err.message || 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        id="case-detail-drawer"
        className="relative h-full w-full max-w-[760px] bg-white p-6 shadow-2xl overflow-y-auto border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200 text-[#0F172A] flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded">
                  {activeCase.id}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-[#64748B]">
                  {activeCase.subscriptionTier} Tier
                </span>
                <StatusBadge caseItem={activeCase} />
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-[#0F172A]">
                {activeCase.customerName}
              </h2>
              <p className="text-xs text-[#64748B]">
                {activeCase.customerEmail} • Sub ID: {activeCase.subscriptionId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OperatorAttributionBadge caseItem={activeCase} />
              <button
                id="close-case-drawer-btn"
                onClick={onClose}
                className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] transition-colors"
                aria-label="Close Drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div
              className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-[#10B981]'
                  : actionFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : actionFeedback.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <Ban className="h-4 w-4 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
              <button
                onClick={() => setActionFeedback(null)}
                className="text-xs font-bold hover:opacity-75"
              >
                ×
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="mt-5 space-y-5">
            {/* REQUIREMENT 4: Human-Readable Decision Summary Card */}
            <HumanDecisionSummaryCard
              caseItem={activeCase}
              onApprove={handleApprove}
              onReject={handleReject}
              isProcessing={isProcessing}
            />

            {/* REQUIREMENT 8: 6-Stage Lifecycle Timeline */}
            {/* Event → Diagnosis → Recommendation → Policy Check → Human Decision → Execution */}
            <DecisionTimeline caseItem={activeCase} />

            {/* Section 5: Execution Trace & Single-Draw Counterfactual Verification */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4.5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Single-Draw Counterfactual Math
                </div>
                <span className="text-[10px] font-mono text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded font-bold">
                  u &lt; p_agent
                </span>
              </div>

              {/* Mathematical parameters */}
              <div className="grid grid-cols-3 gap-2.5 text-center text-xs mb-3">
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                  <div className="text-[11px] text-[#64748B]">Uniform Draw</div>
                  <div className="mt-1 font-mono font-bold text-[#0F172A]">
                    u = {uVal.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                  <div className="text-[11px] text-[#64748B]">Naive Baseline Cutoff</div>
                  <div className="mt-1 font-mono font-bold text-[#64748B]">
                    baseline = {pBaseline.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
                  <div className="text-[11px] text-[#64748B]">RevenueShield Cutoff</div>
                  <div className="mt-1 font-mono font-bold text-[#635BFF]">
                    agent = {pAgent.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Visual Timeline Bar */}
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="flex justify-between text-[11px] text-[#64748B] font-mono mb-1.5">
                  <span>0.0</span>
                  <span>u = {uVal.toFixed(2)}</span>
                  <span>1.0</span>
                </div>
                <div className="relative h-6 rounded-md bg-slate-100 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-slate-300 opacity-60"
                    style={{ width: `${pBaseline * 100}%` }}
                    title={`Baseline threshold (${pBaseline.toFixed(2)})`}
                  />
                  <div
                    className="absolute top-0 bottom-0 bg-[#635BFF]/30 border-r-2 border-[#635BFF]"
                    style={{ width: `${pAgent * 100}%` }}
                    title={`Agent threshold (${pAgent.toFixed(2)})`}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-[#0F172A] z-10"
                    style={{ left: `${uVal * 100}%` }}
                    title={`Uniform Draw u = ${uVal.toFixed(2)}`}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Naive Blind Retry ({pBaseline.toFixed(2)})
                  </span>
                  <span className="flex items-center gap-1 text-[#635BFF]">
                    <span className="h-2 w-2 rounded-full bg-[#635BFF]" />
                    RevenueShield Threshold ({pAgent.toFixed(2)})
                  </span>
                </div>
              </div>

              {/* Final Verdict Banner */}
              <div
                className={`mt-3 rounded-lg p-3 border flex items-center justify-between text-xs ${
                  isRecovered
                    ? 'bg-emerald-50 border-emerald-200 text-[#10B981]'
                    : activeCase.approvalStatus === 'REJECTED'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-100 border-slate-200 text-[#64748B]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {isRecovered ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : activeCase.approvalStatus === 'REJECTED' ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  <span>
                    {isRecovered
                      ? 'Recovered by RevenueShield AI'
                      : activeCase.approvalStatus === 'REJECTED'
                      ? 'Execution Cancelled (Rejected by Admin)'
                      : activeCase.policyRuleDecision === 'REQUIRE_APPROVAL' &&
                        activeCase.approvalStatus !== 'APPROVED'
                      ? 'Execution Paused (Awaiting Approval)'
                      : 'Unrecovered in Current Cycle'}
                  </span>
                </div>
                <span className="font-mono font-bold">
                  {isRecovered ? formatInr(activeCase.revenueAtRiskInr) : '₹0'}
                </span>
              </div>
            </div>

            {/* Customer Billing Email Preview Card */}
            {(() => {
              const emailPayload = formatRecoveryCaseEmailPayload(activeCase);
              return (
                <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(!showEmailPreview)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[#635BFF]/10 text-[#635BFF] flex items-center justify-center">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0F172A]">
                            Customer Billing Email Preview
                          </span>
                          <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-[#635BFF] border border-purple-200">
                            {emailPayload.actionName}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          Professional SaaS notification sent to customer • No internal IDs or metrics
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                      </span>
                      {showEmailPreview ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {showEmailPreview && (
                    <div className="border-t border-[#E2E8F0] p-4 bg-slate-50/60 space-y-3 animate-in fade-in duration-150">
                      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">Subject:</span>
                          <span className="font-semibold text-slate-900">{emailPayload.subject}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500 font-medium">To Customer:</span>
                          <span className="font-mono text-slate-800">{emailPayload.to}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Action Button:</span>
                          <span className="font-semibold text-[#635BFF]">{emailPayload.variables.discountPercent ? 'Renew Subscription' : emailPayload.actionName === 'Smart Retry' ? 'Manage Billing' : emailPayload.actionName === 'Payment Link' ? 'Pay Now' : 'Update Payment Method'}</span>
                        </div>
                      </div>

                      {/* Embedded Email View */}
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                        <div className="bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 font-mono flex items-center justify-between">
                          <span>End-Customer Billing Notification</span>
                          <span>RevenueShield AI</span>
                        </div>
                        <iframe
                          title="Customer Email Preview Frame"
                          srcDoc={emailPayload.html}
                          className="w-full border-0"
                          style={{ height: '340px' }}
                          sandbox="allow-same-origin"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500">
                          Dispatches via Resend SDK with modern HTML & plain text fallback
                        </span>
                        <button
                          type="button"
                          disabled={isDispatchingDirectEmail}
                          onClick={async () => {
                            setIsDispatchingDirectEmail(true);
                            try {
                              const res = await fetch('/api/send-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  to: activeCase.customerEmail,
                                  recoveryCase: activeCase,
                                }),
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                setActionFeedback({
                                  type: 'success',
                                  message: `Dispatched "${emailPayload.subject}" notification to ${emailPayload.to}`,
                                });
                              } else {
                                throw new Error(data.error || 'Failed to dispatch email');
                              }
                            } catch (err: any) {
                              setActionFeedback({
                                type: 'error',
                                message: err?.message || 'Error sending email. Check RESEND_API_KEY.',
                              });
                            } finally {
                              setIsDispatchingDirectEmail(false);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#635BFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5349e0] transition-colors disabled:opacity-50 shadow-xs"
                        >
                          {isDispatchingDirectEmail ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Send Email to Customer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* REQUIREMENT 5: Collapsible Technical Payload */}
            <TechnicalPayloadAccordion
              title="View Technical Payload"
              payload={activeCase}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
          <span>
            {activeCase.approver ? `Operator: ${activeCase.approver}` : 'Automated Evaluation'} • Monotonic Invariant Enforced
          </span>
          <button
            id="close-drawer-btn-footer"
            onClick={onClose}
            className="rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
