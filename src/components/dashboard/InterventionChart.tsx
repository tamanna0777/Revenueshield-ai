import React from 'react';
import { InterventionBreakdownItem } from '../../services/dashboard.ts';
import { formatPercentage } from '../../utils/format.ts';
import { InterventionType } from '../../types.ts';

interface InterventionChartProps {
  data: InterventionBreakdownItem[];
}

export const InterventionChart: React.FC<InterventionChartProps> = ({ data }) => {
  return (
    <div
      id="intervention-strategy-analysis"
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#0F172A]">
            Intervention Performance
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Recovery playbooks, incremental lift, and win rates
          </p>
        </div>
        <span className="text-xs font-mono text-[#64748B] bg-slate-100 px-2 py-0.5 rounded">
          {data.length} Playbooks
        </span>
      </div>

      {/* Razorpay-style Data-Dense Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              <th className="py-2.5 pr-3 font-semibold">Intervention</th>
              <th className="py-2.5 px-2 text-right font-semibold">Cases</th>
              <th className="py-2.5 px-2 text-right font-semibold">Lift</th>
              <th className="py-2.5 pl-2 text-right font-semibold">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]/60">
            {data.map((item) => {
              const isNoAction = item.intervention === InterventionType.NO_ACTION;

              return (
                <tr
                  key={item.intervention}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    isNoAction ? 'opacity-60' : ''
                  }`}
                >
                  <td className="py-2.5 pr-3 font-medium text-[#0F172A] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isNoAction ? 'bg-slate-400' : 'bg-[#635BFF]'
                        }`}
                      />
                      <span className={isNoAction ? 'italic text-slate-500' : ''}>
                        {item.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#64748B]">
                    {item.count}{' '}
                    <span className="text-[10px] text-slate-400">
                      ({item.percentageOfCases}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-medium">
                    {item.averageLiftPct > 0 ? (
                      <span className="text-[#10B981]">+{item.averageLiftPct}%</span>
                    ) : (
                      <span className="text-slate-400">0%</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono font-semibold text-[#0F172A]">
                    {formatPercentage(item.recoveryRatePct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
