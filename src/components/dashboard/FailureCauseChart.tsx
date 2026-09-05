import React from 'react';
import { FailureCauseBreakdownItem } from '../../services/dashboard.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';

interface FailureCauseChartProps {
  data: FailureCauseBreakdownItem[];
}

export const FailureCauseChart: React.FC<FailureCauseChartProps> = ({ data }) => {
  return (
    <div
      id="failure-cause-analysis"
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#0F172A]">
            Root Cause Analysis
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Breakdown of failed payments by diagnostic trigger
          </p>
        </div>
        <span className="text-xs font-mono text-[#64748B] bg-slate-100 px-2 py-0.5 rounded">
          {data.length} Root Causes
        </span>
      </div>

      {/* Razorpay-style Data-Dense Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              <th className="py-2.5 pr-3 font-semibold">Cause</th>
              <th className="py-2.5 px-2 text-right font-semibold">Cases</th>
              <th className="py-2.5 px-2 text-right font-semibold">At Risk</th>
              <th className="py-2.5 pl-2 text-right font-semibold">Recovery Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]/60">
            {data.map((item) => (
              <tr
                key={item.cause}
                className="hover:bg-slate-50/70 transition-colors"
              >
                <td className="py-2.5 pr-3 font-medium text-[#0F172A] whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#635BFF]" />
                    <span>{item.label}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-right font-mono text-[#64748B]">
                  {item.count}{' '}
                  <span className="text-[10px] text-slate-400">
                    ({item.percentageOfCases}%)
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right font-mono font-semibold text-[#0F172A]">
                  {formatInr(item.revenueAtRiskInr)}
                </td>
                <td className="py-2.5 pl-2 text-right font-mono font-medium text-[#10B981]">
                  {formatPercentage(item.recoveryRatePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

