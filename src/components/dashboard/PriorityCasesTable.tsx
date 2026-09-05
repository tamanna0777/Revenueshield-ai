import React, { useState, useMemo } from 'react';
import { FailureCause, InterventionType, RecoveryCase } from '../../types.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  SlidersHorizontal,
  Send,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Zap,
  Filter,
} from 'lucide-react';
import { CaseDetailModal } from './CaseDetailModal.tsx';
import {
  StatusBadge,
  OperatorAttributionBadge,
  getWorkflowStatus,
  WorkflowStatusType,
} from './DecisionWorkflowComponents.tsx';
import {
  approveRecoveryCase,
  rejectRecoveryCase,
} from '../../services/revenueRecovery.ts';

interface PriorityCasesTableProps {
  cases: RecoveryCase[];
  onCaseUpdated?: (updatedCase: RecoveryCase) => void;
}

type SortField = 'priorityScore' | 'revenueAtRiskInr' | 'recoveryProbability' | 'customerName';
type SortDirection = 'asc' | 'desc';
type QueueFilter = 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'RECOVERED' | 'REJECTED';

export const PriorityCasesTable: React.FC<PriorityCasesTableProps> = ({
  cases,
  onCaseUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQueue, setSelectedQueue] = useState<QueueFilter>('ALL');
  const [selectedCause, setSelectedCause] = useState<string>('ALL');
  const [selectedIntervention, setSelectedIntervention] = useState<string>('ALL');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('priorityScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCase, setActiveCase] = useState<RecoveryCase | null>(null);

  // Per-row processing state
  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);
  const [alertedCaseIds, setAlertedCaseIds] = useState<Set<string>>(new Set());
  const [dispatchingCaseId, setDispatchingCaseId] = useState<string | null>(null);

  const pageSize = 10;

  // Queue counts for badges
  const queueCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let executed = 0;
    let recovered = 0;
    let rejected = 0;

    for (const c of cases) {
      const st = getWorkflowStatus(c);
      if (st === 'Pending Approval') pending++;
      else if (st === 'Approved') approved++;
      else if (st === 'Executed') executed++;
      else if (st === 'Recovered') recovered++;
      else if (st === 'Rejected') rejected++;
    }

    return {
      all: cases.length,
      pending,
      approved,
      executed,
      recovered,
      rejected,
    };
  }, [cases]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Row-level Approve Action (Requirement 1, 2)
  const handleApproveCase = async (c: RecoveryCase, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingCaseId(c.id);
    try {
      const updated = approveRecoveryCase(c.id, 'Admin');
      if (updated) {
        onCaseUpdated?.(updated);

        // Trigger real-time customer email notification using modern redesigned template
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
      }
    } finally {
      setProcessingCaseId(null);
    }
  };

  // Row-level Reject Action (Requirement 1, 3)
  const handleRejectCase = (c: RecoveryCase, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingCaseId(c.id);
    try {
      const updated = rejectRecoveryCase(c.id, 'Admin');
      if (updated) {
        onCaseUpdated?.(updated);
      }
    } finally {
      setProcessingCaseId(null);
    }
  };

  // Filter & Sort
  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => {
        // Queue Filter
        if (selectedQueue !== 'ALL') {
          const st = getWorkflowStatus(c);
          if (selectedQueue === 'PENDING_APPROVAL' && st !== 'Pending Approval') return false;
          if (selectedQueue === 'APPROVED' && st !== 'Approved') return false;
          if (selectedQueue === 'EXECUTED' && st !== 'Executed') return false;
          if (selectedQueue === 'RECOVERED' && st !== 'Recovered') return false;
          if (selectedQueue === 'REJECTED' && st !== 'Rejected') return false;
        }

        const matchesSearch =
          searchQuery === '' ||
          c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCause = selectedCause === 'ALL' || c.failureCause === selectedCause;
        const matchesIntervention =
          selectedIntervention === 'ALL' || c.recommendedIntervention === selectedIntervention;
        const matchesPolicy =
          selectedPolicy === 'ALL' || (c.policyRuleDecision || 'ALLOW') === selectedPolicy;

        return matchesSearch && matchesCause && matchesIntervention && matchesPolicy;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortField === 'customerName') {
          valA = a.customerName.toLowerCase();
          valB = b.customerName.toLowerCase();
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }

        if (sortField === 'priorityScore') {
          valA = a.priorityScore ?? 0;
          valB = b.priorityScore ?? 0;
        } else if (sortField === 'revenueAtRiskInr') {
          valA = a.revenueAtRiskInr ?? 0;
          valB = b.revenueAtRiskInr ?? 0;
        } else if (sortField === 'recoveryProbability') {
          valA = a.recoveryProbability ?? 0;
          valB = b.recoveryProbability ?? 0;
        }

        return sortDirection === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [
    cases,
    selectedQueue,
    searchQuery,
    selectedCause,
    selectedIntervention,
    selectedPolicy,
    sortField,
    sortDirection,
  ]);

  const totalPages = Math.ceil(filteredCases.length / pageSize) || 1;
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage]);

  const queueTabs: { id: QueueFilter; label: string; count: number; badgeColor?: string }[] = [
    { id: 'ALL', label: 'All Cases', count: queueCounts.all },
    {
      id: 'PENDING_APPROVAL',
      label: 'Pending Approval',
      count: queueCounts.pending,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
    },
    {
      id: 'APPROVED',
      label: 'Approved',
      count: queueCounts.approved,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    {
      id: 'EXECUTED',
      label: 'Executed',
      count: queueCounts.executed,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    },
    {
      id: 'RECOVERED',
      label: 'Recovered',
      count: queueCounts.recovered,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      id: 'REJECTED',
      label: 'Rejected',
      count: queueCounts.rejected,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    },
  ];

  return (
    <div
      id="priority-cases-card"
      className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-4 border-b border-[#E2E8F0] bg-white flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-[#0F172A]">
                Ranked Recovery Opportunities & Approval Queue
              </h3>
              <span className="font-mono text-xs font-semibold text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded-full">
                {filteredCases.length} Opportunities
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Strictly prioritized by Priority Score = Revenue at Risk × Δ(P_agent - P_baseline). Manage pending approvals in real time.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
            <input
              id="search-cases-input"
              type="text"
              placeholder="Search customer, ID, email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] placeholder-[#94A3B8] focus:border-[#635BFF] focus:outline-hidden focus:ring-1 focus:ring-[#635BFF]"
            />
          </div>
        </div>

        {/* Queue Switcher Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          {queueTabs.map((tab) => {
            const isSelected = selectedQueue === tab.id;
            return (
              <button
                key={tab.id}
                id={`queue-tab-${tab.id.toLowerCase()}`}
                onClick={() => {
                  setSelectedQueue(tab.id);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-2xs'
                    : 'bg-slate-100/80 text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    isSelected
                      ? 'bg-white/20 text-white font-bold'
                      : tab.badgeColor || 'bg-white text-[#64748B]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              <th
                onClick={() => handleSort('customerName')}
                className="py-3 px-4 cursor-pointer hover:text-[#0F172A]"
              >
                <div className="flex items-center gap-1">
                  <span>Customer & ID</span>
                  {sortField === 'customerName' &&
                    (sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th
                onClick={() => handleSort('revenueAtRiskInr')}
                className="py-3 px-3 text-right cursor-pointer hover:text-[#0F172A]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>At Risk (INR)</span>
                  {sortField === 'revenueAtRiskInr' &&
                    (sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th className="py-3 px-3">Failure Diagnosis</th>
              <th className="py-3 px-3">Recommended Action</th>
              <th
                onClick={() => handleSort('recoveryProbability')}
                className="py-3 px-3 text-right cursor-pointer hover:text-[#0F172A]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Propensity</span>
                  {sortField === 'recoveryProbability' &&
                    (sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th
                onClick={() => handleSort('priorityScore')}
                className="py-3 px-3 text-right cursor-pointer hover:text-[#0F172A]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Priority</span>
                  {sortField === 'priorityScore' &&
                    (sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {paginatedCases.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#64748B]">
                  No recovery cases match the current filter or queue selection.
                </td>
              </tr>
            ) : (
              paginatedCases.map((c, index) => {
                const isRecovered = c.agentRecovered;
                const isIncremental = isRecovered && !c.baselineRecovered;
                const globalRank = (currentPage - 1) * pageSize + index + 1;
                const isRequireApproval =
                  c.policyRuleDecision === 'REQUIRE_APPROVAL' &&
                  c.approvalStatus !== 'APPROVED' &&
                  c.approvalStatus !== 'REJECTED';
                const isProcessing = processingCaseId === c.id;

                return (
                  <tr
                    key={c.id}
                    onClick={() => setActiveCase(c)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50/80 group ${
                      isRequireApproval ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Customer */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#64748B] w-6">
                          #{globalRank}
                        </span>
                        <div>
                          <div className="font-semibold text-[#0F172A] flex items-center gap-1">
                            {c.customerName}
                            {isIncremental && (
                              <Sparkles className="h-3 w-3 text-[#10B981]" />
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] font-mono">
                            {c.id} • {c.subscriptionTier}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* MRR */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#0F172A]">
                      {formatInr(c.revenueAtRiskInr)}
                    </td>

                    {/* Failure Cause */}
                    <td className="py-3 px-3">
                      <span className="text-[#0F172A] font-medium block">
                        {c.failureCause.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Attempt {c.attemptCount}
                      </span>
                    </td>

                    {/* Intervention */}
                    <td className="py-3 px-3">
                      <span className="font-medium text-[#635BFF] bg-[#635BFF]/8 px-2 py-0.5 rounded text-[11px] inline-block">
                        {c.recommendedIntervention?.replace(/_/g, ' ') ?? 'NO ACTION'}
                      </span>
                    </td>

                    {/* Probability */}
                    <td className="py-3 px-3 text-right font-mono text-[#0F172A] font-semibold">
                      {formatPercentage(c.recoveryProbability ?? 0.5)}
                      <span className="text-[10px] text-[#64748B] block font-normal">
                        Risk {c.riskScore?.toFixed(0) ?? '—'}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#0F172A]">
                      {c.priorityScore?.toFixed(1) ?? '—'}
                    </td>

                    {/* Workflow Status Badge & Attribution (Requirement 6, 7) */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusBadge caseItem={c} />
                        {c.approver && (
                          <span className="text-[10px] text-[#64748B] font-medium">
                            {c.approvalStatus === 'APPROVED' ? 'by ' : 'by '}
                            {c.approver}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action Column (Requirement 1, 2, 3) */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Requirement 1: Approve and Reject Buttons on cases with REQUIRE_APPROVAL */}
                        {isRequireApproval && (
                          <div className="flex items-center gap-1 mr-1">
                            {/* Reject Button */}
                            <button
                              id={`btn-row-reject-${c.id}`}
                              title="Reject recovery action"
                              disabled={isProcessing}
                              onClick={(e) => handleRejectCase(c, e)}
                              className="inline-flex items-center gap-0.5 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-400 disabled:opacity-50 transition-colors shadow-2xs"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              <span>Reject</span>
                            </button>

                            {/* Approve Button */}
                            <button
                              id={`btn-row-approve-${c.id}`}
                              title="Approve & execute recovery action"
                              disabled={isProcessing}
                              onClick={(e) => handleApproveCase(c, e)}
                              className="inline-flex items-center gap-0.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-bold text-[#10B981] hover:bg-emerald-100 hover:border-emerald-400 disabled:opacity-50 transition-colors shadow-2xs"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              <span>Approve</span>
                            </button>
                          </div>
                        )}

                        {/* Alert button for non-pending cases */}
                        {!isRequireApproval && (
                          <button
                            title="Trigger real-time Resend recovery alert"
                            disabled={dispatchingCaseId === c.id || alertedCaseIds.has(c.id)}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setDispatchingCaseId(c.id);
                              try {
                                await fetch('/api/send-email', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    to: c.customerEmail,
                                    recoveryCase: c,
                                  }),
                                });
                                setAlertedCaseIds((prev) => new Set(prev).add(c.id));
                              } catch {
                                // non-blocking
                              } finally {
                                setDispatchingCaseId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors shadow-2xs ${
                              alertedCaseIds.has(c.id)
                                ? 'bg-emerald-50 text-[#10B981] border border-emerald-200'
                                : 'bg-[#635BFF]/10 text-[#635BFF] hover:bg-[#635BFF]/20 border border-[#635BFF]/20'
                            }`}
                          >
                            {dispatchingCaseId === c.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : alertedCaseIds.has(c.id) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span>{alertedCaseIds.has(c.id) ? 'Alerted' : 'Alert'}</span>
                          </button>
                        )}

                        {/* Inspect Button */}
                        <button
                          id={`btn-inspect-${c.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCase(c);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3 w-3 text-[#64748B]" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B] bg-white">
        <div>
          Showing{' '}
          <span className="font-semibold text-[#0F172A]">
            {filteredCases.length === 0 ? 0 : Math.min(filteredCases.length, (currentPage - 1) * pageSize + 1)}
          </span>{' '}
          to{' '}
          <span className="font-semibold text-[#0F172A]">
            {Math.min(filteredCases.length, currentPage * pageSize)}
          </span>{' '}
          of <span className="font-semibold text-[#0F172A]">{filteredCases.length}</span> cases
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-8 items-center gap-1 px-2.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>
          <span className="px-2 text-xs font-mono font-medium text-[#0F172A]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 items-center gap-1 px-2.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-[#0F172A] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Drawer */}
      <CaseDetailModal
        recoveryCase={activeCase}
        onClose={() => setActiveCase(null)}
        onCaseUpdated={(updated) => {
          setActiveCase(updated);
          onCaseUpdated?.(updated);
        }}
      />
    </div>
  );
};
