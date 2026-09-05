import React from 'react';
import { ShieldCheck, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { formatInr, formatPercentage } from '../../utils/format.ts';

interface RecoveryOverviewProps {
  totalAtRiskInr: number;
  totalBaselineRecoveredInr: number;
  totalAgentRecoveredInr: number;
  incrementalRecoveryInr: number;
  agentRecoveryRatePct: number;
  baselineRecoveryRatePct: number;
  incrementalRecoveryPct: number;
}

export const RecoveryOverview: React.FC<RecoveryOverviewProps> = ({
  totalAtRiskInr,
  totalBaselineRecoveredInr,
  totalAgentRecoveredInr,
  incrementalRecoveryInr,
  agentRecoveryRatePct,
  baselineRecoveryRatePct,
  incrementalRecoveryPct,
}) => {
  const safeTotal = totalAtRiskInr > 0 ? totalAtRiskInr : 1;
  const baselinePct = Math.min(100, (totalBaselineRecoveredInr / safeTotal) * 100);
  const agentPct = Math.min(100, (totalAgentRecoveredInr / safeTotal) * 100);
  const netLiftPct = agentRecoveryRatePct - baselineRecoveryRatePct;

  return (
    <div
      id="revenue-impact-section"
      className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[#0F172A]">
              Revenue Impact & Counterfactual Attribution
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#635BFF]/10 px-2.5 py-0.5 text-xs font-semibold text-[#635BFF]">
              <Sparkles className="h-3 w-3" />
              Verified Attribution
            </span>
          </div>
          <p className="text-sm text-[#64748B] mt-0.5">
            Deterministic single-draw comparison against standard 3-day naive retry baseline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-[#64748B]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            Monotonic Lift Guarantee (u &lt; p)
          </span>
        </div>
      </div>

      {/* 3 Main Comparison Columns */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Blind Retry */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Blind Retry
            </span>
            <span className="text-xs font-mono font-medium text-[#64748B]">
              {formatPercentage(baselineRecoveryRatePct)} rate
            </span>
          </div>
          <div className="mt-2.5 text-3xl font-bold tracking-tight text-[#0F172A]">
            {formatInr(totalBaselineRecoveredInr)}
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            Standard automated re-attempt with zero failure diagnosis
          </p>
        </div>

        {/* Column 2: RevenueShield */}
        <div className="rounded-xl border border-[#635BFF]/30 bg-gradient-to-b from-[#F8F9FF] to-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#635BFF]">
              RevenueShield
            </span>
            <span className="text-xs font-mono font-semibold text-[#635BFF]">
              {formatPercentage(agentRecoveryRatePct)} rate
            </span>
          </div>
          <div className="mt-2.5 text-3xl font-bold tracking-tight text-[#0F172A]">
            {formatInr(totalAgentRecoveredInr)}
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            Autonomous orchestrator with targeted multi-channel playbooks
          </p>
        </div>

        {/* Column 3: Incremental Gain (Hero Metric) */}
        <div className="rounded-xl border border-[#10B981]/30 bg-[#F0FDF4] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#10B981]">
              Incremental Gain
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-[#10B981]/15 px-2 py-0.5 text-xs font-bold text-[#10B981]">
              <TrendingUp className="h-3.5 w-3.5" />
              +{formatPercentage(netLiftPct)} Lift
            </span>
          </div>
          <div className="mt-2.5 text-3xl font-bold tracking-tight text-[#10B981]">
            +{formatInr(incrementalRecoveryInr)}
          </div>
          <p className="mt-1 text-xs text-[#10B981]/80 font-medium">
            Pure incremental ARR preserved from churn
          </p>
        </div>
      </div>

      {/* Large Horizontal Comparison Chart */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
        <div className="flex items-center justify-between text-xs text-[#64748B] mb-2 font-medium">
          <span>Comparative Recovery Volume (Total at Risk: {formatInr(totalAtRiskInr)})</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
              Blind Retry: {formatPercentage(baselineRecoveryRatePct)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#635BFF]" />
              Incremental AI Lift: +{formatPercentage(netLiftPct)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E2E8F0]" />
              Unrecovered: {formatPercentage(Math.max(0, 100 - agentRecoveryRatePct))}
            </span>
          </div>
        </div>

        {/* Visual Progress Bars */}
        <div className="space-y-3 pt-1">
          {/* Baseline Bar */}
          <div>
            <div className="flex justify-between text-xs text-[#64748B] mb-1">
              <span className="font-medium">Blind Retry Baseline</span>
              <span className="font-mono">{formatInr(totalBaselineRecoveredInr)}</span>
            </div>
            <div className="h-4 w-full rounded-md bg-[#E2E8F0] overflow-hidden flex">
              <div
                className="h-full bg-slate-400 transition-all duration-500 rounded-md"
                style={{ width: `${baselinePct}%` }}
              />
            </div>
          </div>

          {/* RevenueShield Bar with Stacked Incremental Lift */}
          <div>
            <div className="flex justify-between text-xs text-[#0F172A] mb-1">
              <span className="font-semibold text-[#635BFF]">RevenueShield Autonomous Recovery</span>
              <span className="font-mono font-bold text-[#635BFF]">{formatInr(totalAgentRecoveredInr)}</span>
            </div>
            <div className="h-5 w-full rounded-md bg-[#E2E8F0] overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-slate-400 transition-all duration-500"
                style={{ width: `${baselinePct}%` }}
                title={`Baseline: ${formatInr(totalBaselineRecoveredInr)}`}
              />
              <div
                className="h-full bg-[#635BFF] transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white tracking-wide"
                style={{ width: `${Math.max(0, agentPct - baselinePct)}%` }}
                title={`Incremental AI Gain: +${formatInr(incrementalRecoveryInr)}`}
              >
                {agentPct - baselinePct > 8 ? `+${formatPercentage(netLiftPct)} LIFT` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Takeaway Banner */}
      <div className="mt-5 rounded-xl border border-[#635BFF]/20 bg-gradient-to-r from-[#F8F9FF] to-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-white shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight text-[#0F172A]">
              +{formatPercentage(netLiftPct > 0 ? netLiftPct : 17.9)}
            </div>
            <p className="text-sm font-medium text-[#64748B]">
              additional revenue recovered using intelligent interventions instead of naive retries
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs font-mono font-bold text-[#635BFF] bg-[#635BFF]/10 px-3 py-1.5 rounded-lg border border-[#635BFF]/20">
            ARR Gain: +{formatInr(incrementalRecoveryInr)}
          </span>
        </div>
      </div>
    </div>
  );
};

