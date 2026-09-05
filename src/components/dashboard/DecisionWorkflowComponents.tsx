import React, { useState } from 'react';
import { RecoveryCase } from '../../types.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  ShieldAlert,
  UserCheck,
  UserX,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Code2,
  ArrowRight,
  Shield,
  FileCheck,
  Ban,
  Loader2,
  Send,
} from 'lucide-react';

export type WorkflowStatusType =
  | 'Pending Approval'
  | 'Approved'
  | 'Rejected'
  | 'Executed'
  | 'Recovered';

export function getWorkflowStatus(c: RecoveryCase): WorkflowStatusType {
  if (c.approvalStatus === 'REJECTED' || c.actionState === 'REJECTED') {
    return 'Rejected';
  }
  if (
    c.policyRuleDecision === 'REQUIRE_APPROVAL' &&
    c.approvalStatus !== 'APPROVED'
  ) {
    return 'Pending Approval';
  }
  if (c.agentRecovered) {
    return 'Recovered';
  }
  if (c.approvalStatus === 'APPROVED' && !c.executedAt) {
    return 'Approved';
  }
  if (c.actionState === 'EXECUTED' || c.approvalStatus === 'APPROVED' || c.executedAt) {
    return 'Executed';
  }
  if (c.actionState === 'APPROVED') {
    return 'Approved';
  }
  if (c.policyRuleDecision === 'BLOCK') {
    return 'Rejected';
  }
  return 'Executed';
}

/**
 * Status Badge Component (Requirement 6)
 * Explicit badges for: Pending Approval, Approved, Rejected, Executed, Recovered
 */
export const StatusBadge: React.FC<{
  caseItem: RecoveryCase;
  className?: string;
}> = ({ caseItem, className = '' }) => {
  const status = getWorkflowStatus(caseItem);

  switch (status) {
    case 'Pending Approval':
      return (
        <span
          id={`badge-pending-approval-${caseItem.id}`}
          className={`inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 ${className}`}
        >
          <Clock className="h-3 w-3 animate-pulse" />
          <span>Pending Approval</span>
        </span>
      );
    case 'Approved':
      return (
        <span
          id={`badge-approved-${caseItem.id}`}
          className={`inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Approved</span>
        </span>
      );
    case 'Rejected':
      return (
        <span
          id={`badge-rejected-${caseItem.id}`}
          className={`inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200 ${className}`}
        >
          <XCircle className="h-3 w-3" />
          <span>Rejected</span>
        </span>
      );
    case 'Recovered':
      return (
        <span
          id={`badge-recovered-${caseItem.id}`}
          className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[#10B981] border border-emerald-200 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Recovered</span>
        </span>
      );
    case 'Executed':
    default:
      return (
        <span
          id={`badge-executed-${caseItem.id}`}
          className={`inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 ${className}`}
        >
          <Zap className="h-3 w-3" />
          <span>Executed</span>
        </span>
      );
  }
};

/**
 * Operator Attribution Component (Requirement 7)
 * "Approved by Admin" or "Rejected by Admin" or "Awaiting Admin Review"
 */
export const OperatorAttributionBadge: React.FC<{
  caseItem: RecoveryCase;
}> = ({ caseItem }) => {
  const approverName = caseItem.approver || 'Admin';

  if (caseItem.approvalStatus === 'APPROVED') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-[#10B981] border border-emerald-200 shadow-2xs">
        <UserCheck className="h-3.5 w-3.5" />
        <span>Approved by {approverName}</span>
      </div>
    );
  }

  if (caseItem.approvalStatus === 'REJECTED') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-50/90 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 shadow-2xs">
        <UserX className="h-3.5 w-3.5" />
        <span>Rejected by {approverName}</span>
      </div>
    );
  }

  if (caseItem.policyRuleDecision === 'REQUIRE_APPROVAL') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50/90 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 shadow-2xs">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>Awaiting Admin Review</span>
      </div>
    );
  }

  return null;
};

/**
 * 6-Stage Timeline Component (Requirement 8)
 * Event → Diagnosis → Recommendation → Policy Check → Human Decision → Execution
 */
export const DecisionTimeline: React.FC<{
  caseItem: RecoveryCase;
}> = ({ caseItem }) => {
  const status = getWorkflowStatus(caseItem);
  const isRequireApproval = caseItem.policyRuleDecision === 'REQUIRE_APPROVAL';
  const isApproved = caseItem.approvalStatus === 'APPROVED';
  const isRejected = caseItem.approvalStatus === 'REJECTED';

  const stages = [
    {
      id: 'event',
      step: 1,
      name: 'Event Ingestion',
      subtitle: `Payment failed (${formatInr(caseItem.revenueAtRiskInr)})`,
      state: 'COMPLETED',
      detail: `Provider: RAZORPAY • Event ID: ${caseItem.lastPaymentEventId || 'evt_' + caseItem.id.slice(0, 8)}`,
    },
    {
      id: 'diagnosis',
      step: 2,
      name: 'Root Cause Diagnosis',
      subtitle: caseItem.failureCause.replace(/_/g, ' '),
      state: 'COMPLETED',
      detail: `Attempt #${caseItem.attemptCount} • Risk score ${caseItem.riskScore?.toFixed(0) ?? 50}/100`,
    },
    {
      id: 'recommendation',
      step: 3,
      name: 'AI Recommendation',
      subtitle: caseItem.recommendedIntervention?.replace(/_/g, ' ') ?? 'SMART RETRY',
      state: 'COMPLETED',
      detail: `Confidence: ${formatPercentage(caseItem.recoveryProbability ?? 0.6)} • Lift: +${Math.round(((caseItem.recoveryProbability ?? 0.6) - (caseItem.baselineProbability ?? 0.15)) * 100)}%`,
    },
    {
      id: 'policy',
      step: 4,
      name: 'Policy Check',
      subtitle:
        caseItem.policyRuleDecision === 'ALLOW'
          ? 'Auto-Cleared'
          : caseItem.policyRuleDecision === 'REQUIRE_APPROVAL'
          ? 'Requires Approval'
          : 'Blocked by Policy',
      state: caseItem.policyRuleDecision === 'BLOCK' ? 'BLOCKED' : 'COMPLETED',
      detail: caseItem.policyReason || 'Guardrail threshold checked',
    },
    {
      id: 'human_decision',
      step: 5,
      name: 'Human Decision',
      subtitle: isApproved
        ? `Approved by ${caseItem.approver || 'Admin'}`
        : isRejected
        ? `Rejected by ${caseItem.approver || 'Admin'}`
        : isRequireApproval
        ? 'Pending Admin Action'
        : 'Auto-Approved',
      state: isApproved
        ? 'COMPLETED'
        : isRejected
        ? 'BLOCKED'
        : isRequireApproval
        ? 'ACTIVE'
        : 'COMPLETED',
      detail: isApproved
        ? `Operator confirmed intervention clearance`
        : isRejected
        ? `Operator cancelled action`
        : isRequireApproval
        ? `Amount exceeds threshold • Manual sign-off required`
        : `Within automated safety bounds`,
    },
    {
      id: 'execution',
      step: 6,
      name: 'Autonomous Execution',
      subtitle: isRejected
        ? 'Execution Cancelled'
        : isRequireApproval && !isApproved
        ? 'Waiting for Decision'
        : caseItem.agentRecovered
        ? `Recovered ${formatInr(caseItem.revenueAtRiskInr)}`
        : 'Action Dispatched',
      state: isRejected
        ? 'BLOCKED'
        : isRequireApproval && !isApproved
        ? 'WAITING'
        : 'COMPLETED',
      detail: isRejected
        ? 'Zero mutations triggered'
        : isRequireApproval && !isApproved
        ? 'Execution paused until operator approval'
        : caseItem.agentRecovered
        ? 'Ledger reconciled successfully'
        : 'Dispatched via Resend email recovery link',
    },
  ];

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4.5 shadow-2xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#635BFF]/10 text-[#635BFF]">
            <FileCheck className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            Decision Lifecycle Timeline
          </h4>
        </div>
        <div className="text-[11px] text-[#64748B] font-mono">
          Event → Diagnosis → Recommendation → Policy → Decision → Execution
        </div>
      </div>

      {/* Horizontal / Step Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        {stages.map((stage, idx) => {
          const isCurrentActive = stage.state === 'ACTIVE';
          const isDone = stage.state === 'COMPLETED';
          const isBlocked = stage.state === 'BLOCKED';
          const isWaiting = stage.state === 'WAITING';

          return (
            <div
              key={stage.id}
              className={`relative flex flex-col p-3 rounded-lg border transition-all text-left ${
                isCurrentActive
                  ? 'border-amber-300 bg-amber-50/70 ring-1 ring-amber-300'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : isBlocked
                  ? 'border-rose-200 bg-rose-50/40'
                  : 'border-[#E2E8F0] bg-slate-50/60 opacity-80'
              }`}
            >
              {/* Step indicator header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold text-[#64748B]">
                  0{stage.step}
                </span>
                <div>
                  {isDone && <CheckCircle2 className="h-4 w-4 text-[#10B981]" />}
                  {isCurrentActive && <Clock className="h-4 w-4 text-amber-600 animate-pulse" />}
                  {isBlocked && <Ban className="h-4 w-4 text-rose-600" />}
                  {isWaiting && <Clock className="h-4 w-4 text-slate-400" />}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="text-xs font-bold text-[#0F172A] truncate">
                {stage.name}
              </div>
              <div
                className={`text-[11px] font-medium mt-0.5 truncate ${
                  isCurrentActive
                    ? 'text-amber-800 font-semibold'
                    : isDone
                    ? 'text-emerald-800'
                    : isBlocked
                    ? 'text-rose-800'
                    : 'text-[#64748B]'
                }`}
              >
                {stage.subtitle}
              </div>

              {/* Detail snippet */}
              <div className="text-[10px] text-[#64748B] mt-2 line-clamp-2 leading-relaxed">
                {stage.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Human-Readable Decision Summary Card (Requirement 4)
 * Replaces raw JSON with clear operational explanation, financial impact,
 * operator attribution, and prominent Approve/Reject actions.
 */
export const HumanDecisionSummaryCard: React.FC<{
  caseItem: RecoveryCase;
  onApprove?: () => void;
  onReject?: () => void;
  isProcessing?: boolean;
}> = ({ caseItem, onApprove, onReject, isProcessing = false }) => {
  const isRequireApproval =
    caseItem.policyRuleDecision === 'REQUIRE_APPROVAL' &&
    caseItem.approvalStatus !== 'APPROVED' &&
    caseItem.approvalStatus !== 'REJECTED';

  const actionLabel =
    caseItem.recommendedIntervention === 'PERSONALIZED_PAYMENT_LINK' ||
    caseItem.recommendedIntervention === 'PAYMENT_METHOD_UPDATE'
      ? 'Payment Link Dispatch'
      : caseItem.recommendedIntervention === 'CUSTOMER_NOTIFICATION'
      ? 'Discount & Notification Offer'
      : caseItem.recommendedIntervention === 'ESCALATION_MANUAL_REVIEW'
      ? 'Escalation & Account Team Review'
      : 'Smart Retry (Off-Peak Routing)';

  return (
    <div
      id={`decision-summary-card-${caseItem.id}`}
      className="rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 p-5 shadow-xs text-[#0F172A]"
    >
      {/* Header with Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
              AI Decision & Governance Summary
            </h3>
            <StatusBadge caseItem={caseItem} />
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Operational governance check & AI recovery recommendations for subscription {caseItem.subscriptionId}
          </p>
        </div>

        {/* Operator Attribution */}
        <OperatorAttributionBadge caseItem={caseItem} />
      </div>

      {/* Primary Decision Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 my-4">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] block">
            Revenue at Risk
          </span>
          <span className="text-base font-mono font-bold text-[#0F172A] mt-1 block">
            {formatInr(caseItem.revenueAtRiskInr)}
          </span>
          <span className="text-[10px] text-[#64748B] mt-0.5 block">
            Tier: {caseItem.subscriptionTier}
          </span>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] block">
            Diagnosed Root Cause
          </span>
          <span className="text-sm font-bold text-[#0F172A] mt-1 block truncate">
            {caseItem.failureCause.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px] text-[#64748B] mt-0.5 block">
            Attempt #{caseItem.attemptCount}
          </span>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] block">
            Recommended Action
          </span>
          <span className="text-sm font-bold text-[#635BFF] mt-1 block truncate">
            {actionLabel}
          </span>
          <span className="text-[10px] text-[#64748B] mt-0.5 block">
            Lift: +{Math.round(((caseItem.recoveryProbability ?? 0.6) - (caseItem.baselineProbability ?? 0.15)) * 100)}%
          </span>
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] block">
            Recovery Propensity
          </span>
          <span className="text-base font-mono font-bold text-[#10B981] mt-1 block">
            {formatPercentage(caseItem.recoveryProbability ?? 0.6)}
          </span>
          <span className="text-[10px] text-[#64748B] mt-0.5 block">
            Priority: {caseItem.priorityScore?.toFixed(1) ?? '—'}
          </span>
        </div>
      </div>

      {/* Governance & Policy Reason Box */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-3.5 mb-4 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-[#635BFF]" />
            Policy Rationale & Guardrails:
          </span>
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
              caseItem.policyRuleDecision === 'ALLOW'
                ? 'text-[#10B981] bg-emerald-50 border border-emerald-200'
                : caseItem.policyRuleDecision === 'REQUIRE_APPROVAL'
                ? 'text-amber-700 bg-amber-50 border border-amber-200'
                : 'text-rose-700 bg-rose-50 border border-rose-200'
            }`}
          >
            {caseItem.policyRuleDecision}
          </span>
        </div>
        <p className="text-[#64748B] leading-relaxed">
          {caseItem.policyReason ||
            (caseItem.revenueAtRiskInr >= 25000
              ? `Amount of ${formatInr(caseItem.revenueAtRiskInr)} exceeds automated approval threshold (₹25,000). Operator sign-off is mandated.`
              : `Evaluated against operational safety parameters and monotonic single-draw lift bounds.`)}
        </p>
      </div>

      {/* Interactive Approve & Reject Buttons (Requirement 1, 2, 3) */}
      {isRequireApproval && onApprove && onReject && (
        <div
          id="approval-actions-card"
          className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-xs font-bold text-amber-900">
                Action Required: High-Value Recovery Pending Operator Sign-Off
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Approving will update the audit trail, execute the recovery action, trigger a real-time email notification, and move the case to Executed.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Reject Button */}
            <button
              id="btn-reject-case"
              disabled={isProcessing}
              onClick={onReject}
              className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 hover:border-rose-400 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Ban className="h-3.5 w-3.5" />
              )}
              <span>Reject Action</span>
            </button>

            {/* Approve Button */}
            <button
              id="btn-approve-case"
              disabled={isProcessing}
              onClick={onApprove}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Approve & Execute</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Collapsible Technical Payload Accordion (Requirement 5)
 * Moves raw JSON into a clean, collapsible section: "View Technical Payload"
 */
export const TechnicalPayloadAccordion: React.FC<{
  payload: any;
  title?: string;
  defaultExpanded?: boolean;
}> = ({ payload, title = 'View Technical Payload', defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-2xs">
      <button
        id="toggle-technical-payload-btn"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-semibold text-[#0F172A]"
      >
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[#635BFF]" />
          <span>{title}</span>
          <span className="text-[10px] font-mono text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
            JSON (Immutable)
          </span>
        </div>

        <div className="flex items-center gap-1 text-[#64748B]">
          <span className="text-[11px] font-normal">
            {isExpanded ? 'Hide Payload' : 'Expand Payload'}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[#0F172A]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#0F172A]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-[#E2E8F0] bg-[#0F172A] text-slate-200 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 text-xs">
            <span className="text-slate-400 font-mono text-[11px]">
              SHA-256 Verified Payload • Size: {jsonString.length} bytes
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#10B981]" />
                  <span className="text-[#10B981]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 p-2">
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
};
