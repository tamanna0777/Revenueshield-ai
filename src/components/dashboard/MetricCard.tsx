import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant: 'success' | 'accent' | 'neutral' | 'warning';
  };
  trend?: string;
  isPrimary?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  isPrimary = false,
}) => {
  return (
    <div
      id={id}
      className={`group relative flex h-full flex-col justify-between rounded-xl border p-5 transition-all duration-150 ${
        isPrimary
          ? 'border-[#635BFF]/30 bg-gradient-to-b from-[#F8F9FF] to-white shadow-xs ring-1 ring-[#635BFF]/20'
          : 'border-[#E2E8F0] bg-white hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#64748B]">
          {title}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isPrimary
              ? 'bg-[#635BFF]/10 text-[#635BFF]'
              : 'bg-slate-100 text-[#64748B] group-hover:text-[#0F172A]'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3">
        <div
          className={`text-[28px] font-bold tracking-tight ${
            isPrimary ? 'text-[#635BFF]' : 'text-[#0F172A]'
          }`}
        >
          {value}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          {subtitle && (
            <p className="text-[12px] text-[#64748B] truncate">
              {subtitle}
            </p>
          )}
          {trend && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#10B981] shrink-0">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          )}
          {badge && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                badge.variant === 'success'
                  ? 'bg-emerald-50 text-[#10B981] border border-emerald-200'
                  : badge.variant === 'accent'
                  ? 'bg-[#635BFF]/10 text-[#635BFF] border border-[#635BFF]/20'
                  : 'bg-slate-100 text-[#64748B]'
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

