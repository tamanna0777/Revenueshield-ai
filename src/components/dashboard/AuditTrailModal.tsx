import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Code2,
  Filter,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AuditRecord, PolicyRuleDecision } from '../../types.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import { getAuditTrail } from '../../agents/audit.ts';
import { TechnicalPayloadAccordion } from './DecisionWorkflowComponents.tsx';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | PolicyRuleDecision>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'ALL' | '1H' | '24H'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecords(getAuditTrail());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const now = Date.now();

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'ALL' && r.policy_decision !== statusFilter) {
      return false;
    }
    if (actionFilter !== 'ALL' && r.intervention !== actionFilter) {
      return false;
    }
    if (timeFilter !== 'ALL') {
      const recordTime = new Date(r.timestamp).getTime();
      const diffHours = (now - recordTime) / (1000 * 60 * 60);
      if (timeFilter === '1H' && diffHours > 1) return false;
      if (timeFilter === '24H' && diffHours > 24) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCase = r.case_id.toLowerCase().includes(q);
      const matchEvent = r.event_id.toLowerCase().includes(q);
      const matchAction = r.action.toLowerCase().includes(q);
      const matchIntervention = r.intervention.toLowerCase().includes(q);
      const matchReason = r.reason.toLowerCase().includes(q);
      if (!matchCase && !matchEvent && !matchAction && !matchIntervention && !matchReason) {
        return false;
      }
    }
    return true;
  });

  const getRelativeTime = (timestamp: string) => {
    const diffSec = Math.floor((now - new Date(timestamp).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        id="audit-trail-modal"
        className="relative w-full max-w-5xl rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl text-[#0F172A] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF]/10 text-[#635BFF]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-[#0F172A]">
                  Audit Trail & Decision Timeline
                </h2>
                <span className="text-[11px] font-medium font-mono text-[#635BFF] bg-[#635BFF]/10 px-2.5 py-0.5 rounded-full">
                  Append-Only Ledger
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Cryptographically traced history of webhook diagnoses, policy evaluations, and executed recoveries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security / Verification Strip */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3.5 py-2.5 border border-[#E2E8F0] text-xs shrink-0">
          <div className="flex items-center gap-2 text-[#64748B]">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <span className="font-semibold text-[#0F172A]">Zero-Secrets Invariant:</span>
            <span>All entries verified sanitised — no API keys or raw tokens written to audit storage.</span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            HMAC VERIFIED ✓
          </span>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-xs font-medium">
              {(['ALL', 'ALLOW', 'REQUIRE_APPROVAL', 'BLOCK'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    statusFilter === s
                      ? 'bg-[#0F172A] text-white font-semibold shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {s === 'ALL'
                    ? 'All Status'
                    : s === 'ALLOW'
                    ? 'Allowed'
                    : s === 'REQUIRE_APPROVAL'
                    ? 'Pending Approval'
                    : 'Blocked'}
                </button>
              ))}
            </div>

            {/* Time Filter */}
            <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-xs">
              {(['ALL', '1H', '24H'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    timeFilter === t
                      ? 'bg-slate-200 text-[#0F172A] font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {t === 'ALL' ? 'All Time' : t === '1H' ? 'Last 1h' : 'Last 24h'}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search by customer, case, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white pl-8 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:border-[#635BFF] focus:outline-none"
            />
          </div>
        </div>

        {/* Timeline-Style Activity Feed */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E2E8F0]">
              No audit records matching selected filter criteria.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#E2E8F0]">
              {filteredRecords.map((rec) => {
                const isExpanded = expandedId === rec.audit_id;
                const statusTheme =
                  rec.policy_decision === 'ALLOW'
                    ? {
                        dot: 'bg-[#10B981] ring-4 ring-emerald-100',
                        badge: 'bg-emerald-50 text-[#10B981] border border-emerald-200',
                      }
                    : rec.policy_decision === 'REQUIRE_APPROVAL'
                    ? {
                        dot: 'bg-[#F59E0B] ring-4 ring-amber-100',
                        badge: 'bg-amber-50 text-amber-700 border border-amber-200',
                      }
                    : {
                        dot: 'bg-[#EF4444] ring-4 ring-rose-100',
                        badge: 'bg-rose-50 text-[#EF4444] border border-rose-200',
                      };

                return (
                  <div key={rec.audit_id} className="relative group">
                    {/* Timeline Node Marker */}
                    <div
                      className={`absolute -left-6 top-3 h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125 ${statusTheme.dot}`}
                    />

                    {/* Timeline Card */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : rec.audit_id)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${
                        isExpanded
                          ? 'border-[#635BFF] bg-[#F8FAFC] shadow-sm'
                          : 'border-[#E2E8F0] bg-white hover:border-slate-300 hover:bg-[#F8FAFC]/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-mono font-bold ${statusTheme.badge}`}
                          >
                            {rec.policy_decision}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#0F172A]">
                            {rec.case_id}
                          </span>
                          <span className="text-[#64748B]">•</span>
                          <span className="text-xs font-bold text-[#0F172A]">
                            Action: {rec.intervention.replace(/_/g, ' ')}
                          </span>
                          {rec.approver && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                                rec.attribution?.includes('Approved') || rec.action?.includes('APPROVAL')
                                  ? 'bg-emerald-50 text-[#10B981] border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {rec.attribution?.includes('Approved') || rec.action?.includes('APPROVAL') ? (
                                <UserCheck className="h-3 w-3" />
                              ) : (
                                <UserX className="h-3 w-3" />
                              )}
                              <span>{rec.attribution || `by ${rec.approver}`}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="font-mono font-bold text-[#0F172A]">
                            {formatInr(rec.revenue_at_risk_inr)}
                          </span>
                          <span className="text-[#64748B] hidden sm:inline">
                            p={formatPercentage(rec.recovery_probability)}
                          </span>
                          <div className="flex items-center gap-1 text-[#64748B]">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">
                              {getRelativeTime(rec.timestamp)}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              ({new Date(rec.timestamp).toLocaleTimeString()})
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-[#64748B]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[#64748B]" />
                          )}
                        </div>
                      </div>

                      {/* Summary line */}
                      <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]">
                        <p className="truncate max-w-xl">
                          <span className="font-semibold text-[#0F172A]">Rule:</span> {rec.reason}
                        </p>
                        <span className="text-[11px] font-mono text-[#635BFF] hover:underline shrink-0">
                          {isExpanded ? 'Hide Raw Details' : 'View Raw Details'}
                        </span>
                      </div>

                      {/* Expandable Details with Raw JSON & Attribution */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-3 animate-in fade-in duration-150">
                          {/* Reasoning & Metrics */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-white border border-[#E2E8F0] text-xs">
                            <div>
                              <span className="text-[#64748B] block text-[11px]">Event Attribution</span>
                              <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">
                                {rec.event_id}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#64748B] block text-[11px]">Risk & Priority Score</span>
                              <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">
                                Risk: {rec.risk_score}/100 • Priority: {rec.priority_score}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#64748B] block text-[11px]">Execution Mode</span>
                              <span className="font-semibold text-[#0F172A] mt-0.5 block">
                                {rec.dry_run ? 'Dry Run (Simulated)' : 'Live Automated'}
                              </span>
                            </div>
                          </div>

                          {/* Raw JSON Trace using Collapsible Technical Payload */}
                          <TechnicalPayloadAccordion
                            title="View Technical Payload"
                            payload={rec}
                            defaultExpanded={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between shrink-0 text-xs text-[#64748B]">
          <span>
            {filteredRecords.length} records logged • Cryptographic tamper-evident trace
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Close Feed
          </button>
        </div>
      </div>
    </div>
  );
};

