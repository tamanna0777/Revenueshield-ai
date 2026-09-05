import React from 'react';
import { ActivityFeedItem } from '../../services/dashboard.ts';
import { formatInr, formatTime } from '../../utils/format.ts';
import { CheckCircle2, XCircle, Clock, Zap, ArrowUpRight } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityFeedItem[];
  onSelectCase?: (caseId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  onSelectCase,
}) => {
  return (
    <div
      id="simulation-activity-feed"
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#635BFF]" />
            Live Recovery Stream
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real-time automated recovery actions and transaction outcomes
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#10B981] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Active Stream
        </span>
      </div>

      <div className="mt-3 divide-y divide-[#E2E8F0] max-h-[420px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B]">
            No activity events recorded in current run.
          </div>
        ) : (
          activities.map((item) => {
            const isSuccess = item.status === 'RECOVERED';

            return (
              <div
                key={item.id}
                onClick={() => onSelectCase && onSelectCase(item.caseId)}
                className="py-2.5 flex items-start gap-3 transition-colors hover:bg-[#F8FAFC] rounded-lg px-2 cursor-pointer"
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {isSuccess ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-[#10B981]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 border border-[#E2E8F0] text-[#64748B]">
                      <XCircle className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0F172A] truncate">
                      {item.customerName}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0F172A] shrink-0">
                      {formatInr(item.amountInr)}
                    </span>
                  </div>

                  <p className="text-xs text-[#64748B] mt-0.5 truncate">
                    {item.message}
                  </p>

                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[#64748B] font-mono">
                    <span className="font-semibold text-[#0F172A]">{item.caseId}</span>
                    <span>•</span>
                    <span>{item.failureCause.replace(/_/g, ' ')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-[#94A3B8] hover:text-[#0F172A] mt-1">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
