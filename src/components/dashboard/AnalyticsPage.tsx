import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  AreaChart,
  Area,
} from 'recharts';
import { RecoveryCase } from '../../types.ts';
import { DashboardTopKpis } from '../../services/dashboard.ts';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import {
  TrendingUp,
  BarChart3,
  Layers,
  ArrowUpRight,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

export interface AnalyticsPageProps {
  cases?: RecoveryCase[];
  kpis?: DashboardTopKpis | null;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ cases, kpis }) => {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('30D');

  // Defensive data wrapping: ensure array exists and never undefined
  const safeCases = useMemo(() => {
    const raw = Array.isArray(cases) ? cases : [];
    return raw;
  }, [cases]);

  // Defensive KPI wrapping: guarantees all properties exist with numeric defaults
  const safeKpis = useMemo(() => {
    return (
      kpis ?? {
        totalAtRiskInr: 0,
        totalBaselineRecoveredInr: 0,
        totalAgentRecoveredInr: 0,
        incrementalRecoveryInr: 0,
        agentRecoveryRatePct: 0,
        baselineRecoveryRatePct: 0,
        incrementalRecoveryPct: 0,
        casesProcessed: 0,
        agentRecoveredCount: 0,
        baselineRecoveredCount: 0,
      }
    );
  }, [kpis]);

  // Console telemetry for observability
  console.log('[RevenueShield Analytics] Rendering with safeCases:', safeCases.length, 'kpis:', safeKpis);

  // 1. Daily Recovery Trend
  const dailyTrendData = useMemo(() => {
    const buckets: Record<
      string,
      { day: string; atRisk: number; agentRecovered: number; baselineRecovered: number }
    > = {};

    const numDays = 14;
    for (let i = 1; i <= numDays; i++) {
      buckets[`Day ${i}`] = {
        day: `Day ${i}`,
        atRisk: 0,
        agentRecovered: 0,
        baselineRecovered: 0,
      };
    }

    if (safeCases.length > 0) {
      safeCases.forEach((c, idx) => {
        const dayIndex = (idx % numDays) + 1;
        const key = `Day ${dayIndex}`;
        if (buckets[key]) {
          buckets[key].atRisk += c.revenueAtRiskInr || 0;
          if (c.agentRecovered) {
            buckets[key].agentRecovered +=
              c.agentRecoveredAmountInr || c.revenueAtRiskInr || 0;
          }
          if (c.baselineRecovered) {
            buckets[key].baselineRecovered +=
              c.baselineRecoveredAmountInr || c.revenueAtRiskInr || 0;
          }
        }
      });
    }

    return Object.values(buckets);
  }, [safeCases]);

  // 2. Recovery by Channel / Intervention Type
  const channelData = useMemo(() => {
    const channelMap: Record<
      string,
      { channel: string; attempted: number; recovered: number; count: number }
    > = {
      SMART_RETRY: { channel: 'Smart Retry', attempted: 0, recovered: 0, count: 0 },
      PAYMENT_METHOD_UPDATE: {
        channel: 'Method Update',
        attempted: 0,
        recovered: 0,
        count: 0,
      },
      PERSONALIZED_PAYMENT_LINK: {
        channel: 'Payment Link',
        attempted: 0,
        recovered: 0,
        count: 0,
      },
      CUSTOMER_NOTIFICATION: {
        channel: 'Notification',
        attempted: 0,
        recovered: 0,
        count: 0,
      },
    };

    if (safeCases.length > 0) {
      safeCases.forEach((c) => {
        const type = c.recommendedIntervention || 'SMART_RETRY';
        if (channelMap[type]) {
          channelMap[type].count += 1;
          channelMap[type].attempted += c.revenueAtRiskInr || 0;
          if (c.agentRecovered) {
            channelMap[type].recovered +=
              c.agentRecoveredAmountInr || c.revenueAtRiskInr || 0;
          }
        }
      });
    }

    return Object.values(channelMap).map((item) => ({
      ...item,
      rate: item.attempted > 0 ? (item.recovered / item.attempted) * 100 : 0,
    }));
  }, [safeCases]);

  // 3. Recovery by Ticket Size (<₹10k, ₹10k–₹50k, >₹50k)
  const ticketSizeData = useMemo(() => {
    const tiers = [
      { tier: '< ₹10,000', label: 'Low (<₹10k)', atRisk: 0, recovered: 0, count: 0 },
      {
        tier: '₹10,000 – ₹50,000',
        label: 'Mid (₹10k–₹50k)',
        atRisk: 0,
        recovered: 0,
        count: 0,
      },
      { tier: '> ₹50,000', label: 'High (>₹50k)', atRisk: 0, recovered: 0, count: 0 },
    ];

    if (safeCases.length > 0) {
      safeCases.forEach((c) => {
        const amt = c.revenueAtRiskInr || 0;
        let targetTier = tiers[0];
        if (amt > 50000) {
          targetTier = tiers[2];
        } else if (amt >= 10000) {
          targetTier = tiers[1];
        }

        targetTier.count += 1;
        targetTier.atRisk += amt;
        if (c.agentRecovered) {
          targetTier.recovered += c.agentRecoveredAmountInr || amt;
        }
      });
    }

    return tiers.map((t) => ({
      ...t,
      recoveryRate: t.atRisk > 0 ? (t.recovered / t.atRisk) * 100 : 0,
    }));
  }, [safeCases]);

  // 4. Counterfactual Performance Comparison (Cumulative ML agent vs baseline)
  const counterfactualData = useMemo(() => {
    if (safeCases.length === 0) {
      return [
        { step: 'Start', Agent: 0, Baseline: 0, Delta: 0 },
        { step: 'End', Agent: 0, Baseline: 0, Delta: 0 },
      ];
    }

    let cumAgent = 0;
    let cumBaseline = 0;
    const stepSize = Math.max(1, Math.floor(safeCases.length / 12));
    const points: { step: string; Agent: number; Baseline: number; Delta: number }[] = [];

    safeCases.forEach((c, idx) => {
      if (c.agentRecovered) {
        cumAgent += c.agentRecoveredAmountInr || c.revenueAtRiskInr || 0;
      }
      if (c.baselineRecovered) {
        cumBaseline += c.baselineRecoveredAmountInr || c.revenueAtRiskInr || 0;
      }

      if ((idx + 1) % stepSize === 0 || idx === safeCases.length - 1) {
        points.push({
          step: `Case ${idx + 1}`,
          Agent: Math.round(cumAgent),
          Baseline: Math.round(cumBaseline),
          Delta: Math.round(cumAgent - cumBaseline),
        });
      }
    });

    return points;
  }, [safeCases]);

  // Fallback if data is completely absent (avoid returning blank/null)
  if (!kpis && safeCases.length === 0) {
    return (
      <div
        id="analytics-loading-state"
        className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-10 text-center shadow-xs"
      >
        <RefreshCw className="h-8 w-8 animate-spin text-[#635BFF] mb-3" />
        <h3 className="text-sm font-bold text-[#0F172A]">Loading Recovery Telemetry...</h3>
        <p className="text-xs text-[#64748B] mt-1 max-w-sm">
          Aggregating counterfactual datasets and econometric lift models.
        </p>
      </div>
    );
  }

  return (
    <div id="analytics-page" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
            Recovery Analytics & Counterfactual Attribution
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Deep-dive operational telemetry, channel performance, and econometric lift analysis
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 text-xs font-medium">
            {(['7D', '30D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  timeRange === r
                    ? 'bg-[#0F172A] text-white font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {r === '7D' ? 'Last 7 Days' : r === '30D' ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const dataStr =
                'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify(safeCases, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute('href', dataStr);
              downloadAnchor.setAttribute('download', 'revenueshield_analytics_export.json');
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Export Raw Data</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#64748B]">Total Volume Analyzed</span>
          <div className="text-xl font-bold font-mono text-[#0F172A] mt-1">
            {formatInr(safeKpis.totalAtRiskInr)}
          </div>
          <span className="text-[11px] text-[#64748B] mt-0.5 block font-mono">
            {safeCases.length} distinct failed subscriptions
          </span>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#64748B]">ML Agent Recovered</span>
          <div className="text-xl font-bold font-mono text-[#10B981] mt-1">
            {formatInr(safeKpis.totalAgentRecoveredInr)}
          </div>
          <span className="text-[11px] text-[#10B981] font-semibold mt-0.5 block">
            {formatPercentage(safeKpis.agentRecoveryRatePct)} gross conversion
          </span>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <span className="text-xs text-[#64748B]">Counterfactual Baseline</span>
          <div className="text-xl font-bold font-mono text-[#64748B] mt-1">
            {formatInr(safeKpis.totalBaselineRecoveredInr)}
          </div>
          <span className="text-[11px] text-[#64748B] mt-0.5 block">
            {formatPercentage(safeKpis.baselineRecoveryRatePct)} naive 24h retry
          </span>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#635BFF]/5 p-4 shadow-xs">
          <span className="text-xs text-[#635BFF] font-semibold">Net Incremental Alpha</span>
          <div className="text-xl font-bold font-mono text-[#635BFF] mt-1">
            {formatInr(safeKpis.incrementalRecoveryInr)}
          </div>
          <span className="text-[11px] text-[#635BFF] font-medium mt-0.5 block">
            +{formatPercentage(safeKpis.incrementalRecoveryPct)} lift above baseline
          </span>
        </div>
      </div>

      {/* Grid of 4 Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: DAILY RECOVERY TREND */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#635BFF]" />
                1. Daily Recovery Trend
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Volume at risk vs autonomous recovered amount across simulation epochs
              </p>
            </div>
          </div>

          <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => formatInr(v)}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="atRisk" name="Volume at Risk" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="agentRecovered"
                  name="ML Agent Recovered"
                  stroke="#635BFF"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#635BFF' }}
                />
                <Line
                  type="monotone"
                  dataKey="baselineRecovered"
                  name="Naive Baseline"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: RECOVERY BY CHANNEL */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#10B981]" />
                2. Recovery by Channel & Intervention
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Capital recovered vs attempted across smart retry and messaging vectors
              </p>
            </div>
          </div>

          <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={channelData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="channel" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => formatInr(v)}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="attempted" name="Volume Attempted" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" name="Successfully Recovered" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: RECOVERY BY TICKET SIZE */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#F59E0B]" />
                3. Recovery by Invoice Ticket Size
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Conversion efficacy categorized by transaction value brackets
              </p>
            </div>
          </div>

          <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ticketSizeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="tier" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => formatInr(v)}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="atRisk" name="Total Invoiced" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" name="Total Recovered" fill="#635BFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 4: COUNTERFACTUAL PERFORMANCE COMPARISON */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-[#635BFF]" />
                4. Counterfactual Performance Comparison
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Cumulative revenue recovered: ML Agent vs Fixed Baseline over time
              </p>
            </div>
          </div>

          <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={counterfactualData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="agentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="step" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => formatInr(v)}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="Agent"
                  name="ML Agent (Cumulative)"
                  stroke="#635BFF"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#agentGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="Baseline"
                  name="Baseline (Cumulative)"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
