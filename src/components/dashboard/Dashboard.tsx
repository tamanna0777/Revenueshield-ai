import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  initializeDemoData,
  runRecoverySimulation,
  reEvaluatePolicies,
  resetDemoState,
  DEFAULT_DEMO_SEED,
  DEFAULT_SAMPLE_SIZE,
} from '../../services/revenueRecovery.ts';
import {
  getDashboardSummary,
  getFailureCauseMetrics,
  getInterventionMetrics,
  getRecentExecutions,
  DashboardTopKpis,
  FailureCauseBreakdownItem,
  InterventionBreakdownItem,
  ActivityFeedItem,
} from '../../services/dashboard.ts';
import {
  getPolicyConfig,
  updatePolicyConfig,
  setKillSwitch,
  isKillSwitchEnabled,
} from '../../agents/policy.ts';
import { PolicyConfig, RecoveryCase } from '../../types.ts';
import { MetricCard } from './MetricCard.tsx';
import { RecoveryOverview } from './RecoveryOverview.tsx';
import { FailureCauseChart } from './FailureCauseChart.tsx';
import { InterventionChart } from './InterventionChart.tsx';
import { PriorityCasesTable } from './PriorityCasesTable.tsx';
import { ActivityFeed } from './ActivityFeed.tsx';
import { AnalyticsPage } from './AnalyticsPage.tsx';
import { CaseDetailModal } from './CaseDetailModal.tsx';
import { GuardrailsPanel } from './GuardrailsPanel.tsx';
import { RazorpaySimulatorModal } from './RazorpaySimulatorModal.tsx';
import { AuditTrailModal } from './AuditTrailModal.tsx';
import { DemoGuideModal } from './DemoGuideModal.tsx';
import { EmailTemplatesModal } from './EmailTemplatesModal.tsx';
import { formatInr, formatPercentage } from '../../utils/format.ts';
import {
  Shield,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Zap,
  Users,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Lock,
  LayoutDashboard,
  BarChart3,
  Compass,
  AlertOctagon,
  FileText,
  Cpu,
  Mail,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [seed, setSeed] = useState<number>(DEFAULT_DEMO_SEED);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  // Dashboard state
  const [kpis, setKpis] = useState<DashboardTopKpis | null>(null);
  const [failureCauses, setFailureCauses] = useState<FailureCauseBreakdownItem[]>([]);
  const [interventions, setInterventions] = useState<InterventionBreakdownItem[]>([]);
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [inspectedCase, setInspectedCase] = useState<RecoveryCase | null>(null);

  // Financial Guardrails & Demo Modals state
  const [policyConfig, setPolicyConfigState] = useState<PolicyConfig>(getPolicyConfig());
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(isKillSwitchEnabled());
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState<boolean>(false);
  const [isEmailTemplatesOpen, setIsEmailTemplatesOpen] = useState<boolean>(false);

  // Initialize or re-run simulation
  const refreshSimulation = (newSeed: number) => {
    startTransition(() => {
      const state = runRecoverySimulation(newSeed, DEFAULT_SAMPLE_SIZE);
      setKpis(getDashboardSummary());
      setFailureCauses(getFailureCauseMetrics());
      setInterventions(getInterventionMetrics());
      setCases(state.executedCases);
      setActivities(getRecentExecutions(25));
      setPolicyConfigState(getPolicyConfig());
      setKillSwitchActive(isKillSwitchEnabled());
    });
  };

  useEffect(() => {
    // Initial run
    refreshSimulation(seed);
  }, []);

  const handleSeedChange = (newSeed: number) => {
    setSeed(newSeed);
    refreshSimulation(newSeed);
  };

  // Financial Guardrails Handlers
  const handleUpdatePolicyConfig = (updated: Partial<PolicyConfig>) => {
    const newCfg = updatePolicyConfig(updated);
    setPolicyConfigState({ ...newCfg });
    // Re-evaluate cases in real-time
    const updatedCases = reEvaluatePolicies(newCfg);
    setCases([...updatedCases]);
  };

  const handleToggleKillSwitch = (enabled: boolean) => {
    const newState = setKillSwitch(enabled);
    setKillSwitchActive(newState);
    const updatedCases = reEvaluatePolicies();
    setCases([...updatedCases]);
  };

  // Reset Demo to benchmark seed 2026 & default policies
  const handleResetDemo = () => {
    startTransition(() => {
      const state = resetDemoState();
      setSeed(DEFAULT_DEMO_SEED);
      setKpis(getDashboardSummary());
      setFailureCauses(getFailureCauseMetrics());
      setInterventions(getInterventionMetrics());
      setCases(state.executedCases);
      setActivities(getRecentExecutions(25));
      setPolicyConfigState(getPolicyConfig());
      setKillSwitchActive(false);
      setInspectedCase(null);
    });
  };

  // Handle new case simulated via Razorpay test event
  const handleCaseSimulated = (newCase: RecoveryCase) => {
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    setActivities(getRecentExecutions(25));
    setKpis(getDashboardSummary());
  };

  // Handle case approval/rejection update
  const handleCaseUpdated = (updatedCase: RecoveryCase) => {
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
    setActivities(getRecentExecutions(25));
    setKpis(getDashboardSummary());
    if (inspectedCase && inspectedCase.id === updatedCase.id) {
      setInspectedCase(updatedCase);
    }
  };

  // 1-Click Demo Scenario Selector (finds ideal high-value scenario case)
  const handleSelectDemoScenario = () => {
    const candidate =
      cases.find((c) => c.revenueAtRiskInr >= 15000 && c.attemptCount === 1) ||
      cases[0];
    if (candidate) {
      setInspectedCase(candidate);
    }
  };

  // Compute live policy distribution
  const policyCounts = useMemo(() => {
    let allowed = 0;
    let requireApproval = 0;
    let blocked = 0;

    for (const c of cases) {
      const dec = c.policyRuleDecision || 'ALLOW';
      if (dec === 'ALLOW') allowed++;
      else if (dec === 'REQUIRE_APPROVAL') requireApproval++;
      else if (dec === 'BLOCK') blocked++;
    }

    return { allowed, requireApproval, blocked, total: cases.length };
  }, [cases]);

  if (!kpis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-3 text-[#64748B]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#635BFF]" />
          <span className="text-sm font-medium">Bootstrapping RevenueShield AI simulation engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-xs shadow-xs">
        {/* Level 1: Brand & Action Controls */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[76px] sm:min-h-[80px] py-2.5 sm:py-3.5 items-center justify-between gap-4 lg:gap-6 flex-wrap md:flex-nowrap">
            {/* Brand Mark & Connection Status */}
            <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#635BFF] text-white shadow-sm ring-4 ring-[#635BFF]/10 shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]">
                    RevenueShield AI
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-[#635BFF]/10 border border-[#635BFF]/20 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-[#635BFF] font-mono tracking-wide shadow-2xs">
                    AUTONOMOUS RECOVERY
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                  </span>
                  <span className="text-xs sm:text-[13px] text-[#475569] font-medium">
                    Connected to Razorpay Test Webhooks
                  </span>
                </div>
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Trigger Test Webhook */}
              <button
                id="btn-simulate-razorpay"
                onClick={() => setIsSimulatorOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-[#635BFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#5249e0] transition-colors"
                title="Trigger simulated Razorpay test webhook wizard"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Trigger</span> Test Webhook
              </button>

              {/* Audit Trail */}
              <button
                id="btn-audit-trail"
                onClick={() => setIsAuditOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
                title="Open Deterministic Decision Log"
              >
                <FileText className="h-3.5 w-3.5 text-[#635BFF]" />
                <span>Audit Trail</span>
              </button>

              {/* Email Templates */}
              <button
                id="btn-email-templates"
                onClick={() => setIsEmailTemplatesOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
                title="Manage Customer Email Notification Templates"
              >
                <Mail className="h-3.5 w-3.5 text-[#635BFF]" />
                <span>Email Templates</span>
              </button>

              {/* Guardrails */}
              <button
                id="btn-guardrails-panel"
                onClick={() => setIsGuardrailsOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
                title="Configure Financial Guardrails & Thresholds"
              >
                <Sliders className="h-3.5 w-3.5 text-[#635BFF]" />
                <span>Guardrails</span>
              </button>

              {/* Kill Switch */}
              <div className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs">
                <span className="text-[11px] text-[#64748B] font-medium hidden sm:inline">
                  Kill Switch:
                </span>
                <button
                  id="btn-header-kill-switch"
                  onClick={() => handleToggleKillSwitch(!killSwitchActive)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors ${
                    killSwitchActive
                      ? 'bg-[#EF4444] text-white animate-pulse'
                      : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                  title={killSwitchActive ? 'Deactivate Kill Switch' : 'Activate Kill Switch'}
                >
                  {killSwitchActive ? 'ON (BLOCKED)' : 'OFF'}
                </button>
              </div>

              {/* Demo Guide */}
              <button
                id="btn-demo-guide"
                onClick={() => setIsDemoGuideOpen(true)}
                className="hidden lg:flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
                title="Open 9-Step Hackathon Judge Walkthrough"
              >
                <Compass className="h-3.5 w-3.5 text-[#64748B]" />
                <span>Demo Guide</span>
              </button>

              {/* Reset Demo */}
              <button
                id="btn-reset-demo"
                onClick={handleResetDemo}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 transition-colors shadow-xs"
                title="Reset simulation to default benchmark state"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Level 2: Primary Navigation Tabs & Operational Status */}
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-wrap gap-3">
            {/* View Switcher Tabs */}
            <nav className="flex items-center space-x-1 py-1.5">
              <button
                id="tab-overview"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-white text-[#635BFF] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Overview Dashboard</span>
              </button>

              <button
                id="tab-analytics"
                role="tab"
                aria-selected={activeTab === 'analytics'}
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-[#635BFF] shadow-xs border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Analytics & Econometric Lift</span>
              </button>
            </nav>

            {/* Status Pills */}
            <div className="flex items-center gap-2 py-1.5 flex-wrap">
              <span className="font-mono text-[10px] uppercase font-semibold text-[#0F172A] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                SANDBOX MODE
              </span>

              <span className="font-mono text-[10px] text-[#10B981] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                <Lock className="h-2.5 w-2.5" />
                DRY RUN (Safe)
              </span>

              <span className="font-mono text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                Risk Score &lt; {policyConfig.maxRiskScoreForAutonomousRecovery ?? 85}
              </span>

              <span className="font-mono text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                {policyConfig.maxRetryAttemptsPerCase ?? policyConfig.maxAutomatedAttempts ?? 3} Retries Cap
              </span>

              <span className="font-mono text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0] hidden md:inline">
                Approval &gt; {formatInr(policyConfig.highValueThresholdInr ?? policyConfig.approvalAmountThresholdInr ?? 50000, true)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Kill Switch Alert Banner */}
      {killSwitchActive && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-[#EF4444] shadow-xs animate-in fade-in duration-200">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-xs font-bold">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 shrink-0 animate-bounce" />
              <span>
                GLOBAL KILL SWITCH ACTIVE — All autonomous recovery interventions are currently blocked by policy guardrails.
              </span>
            </div>
            <button
              onClick={() => handleToggleKillSwitch(false)}
              className="rounded-md bg-white border border-rose-200 px-3 py-1 text-xs font-bold text-[#EF4444] hover:bg-rose-100 transition-colors"
            >
              Deactivate Kill Switch
            </button>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {activeTab === 'analytics' ? (
          <AnalyticsPage cases={cases} kpis={kpis} />
        ) : (
          <>
            {/* Top 6 KPI Metric Cards Grid */}
            <section aria-label="Top Financial KPIs" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <MetricCard
                id="kpi-revenue-at-risk"
                title="Revenue at Risk"
                value={formatInr(kpis.totalAtRiskInr)}
                subtitle="Delinquent subscription cohort"
                icon={AlertCircle}
                badge={{ text: '100% Cohort', variant: 'warning' }}
              />

              <MetricCard
                id="kpi-baseline-recovered"
                title="Baseline Recovered"
                value={formatInr(kpis.totalBaselineRecoveredInr)}
                subtitle={`${formatPercentage(kpis.baselineRecoveryRatePct)} recovery rate`}
                icon={RefreshCw}
                badge={{ text: 'Blind Retry', variant: 'neutral' }}
              />

              <MetricCard
                id="kpi-agent-recovered"
                title="Agent Recovered"
                value={formatInr(kpis.totalAgentRecoveredInr)}
                subtitle={`${formatPercentage(kpis.agentRecoveryRatePct)} recovery rate`}
                icon={Shield}
                badge={{ text: 'RevenueShield', variant: 'accent' }}
              />

              <MetricCard
                id="kpi-incremental-recovery"
                title="Incremental Recovery"
                value={formatInr(kpis.incrementalRecoveryInr)}
                subtitle={`+${formatPercentage(kpis.incrementalRecoveryPct)} net margin lift`}
                icon={TrendingUp}
                badge={{ text: `+${formatInr(kpis.incrementalRecoveryInr, true)}`, variant: 'success' }}
                isPrimary={true}
              />

              <MetricCard
                id="kpi-recovery-rate"
                title="Agent Recovery Rate"
                value={formatPercentage(kpis.agentRecoveryRatePct)}
                subtitle={`vs ${formatPercentage(kpis.baselineRecoveryRatePct)} baseline`}
                icon={CheckCircle2}
                badge={{
                  text: `+${formatPercentage(kpis.agentRecoveryRatePct - kpis.baselineRecoveryRatePct)} Lift`,
                  variant: 'success',
                }}
              />

              <MetricCard
                id="kpi-cases-processed"
                title="Cases Processed"
                value={kpis.casesProcessed.toLocaleString('en-IN')}
                subtitle={`${kpis.agentRecoveredCount} recovered cases`}
                icon={Users}
                badge={{ text: 'Deterministic', variant: 'neutral' }}
              />
            </section>

            {/* Recovery Overview Funnel */}
            <section aria-label="Recovery Performance Funnel">
              <RecoveryOverview
                totalAtRiskInr={kpis.totalAtRiskInr}
                totalBaselineRecoveredInr={kpis.totalBaselineRecoveredInr}
                totalAgentRecoveredInr={kpis.totalAgentRecoveredInr}
                incrementalRecoveryInr={kpis.incrementalRecoveryInr}
                agentRecoveryRatePct={kpis.agentRecoveryRatePct}
                baselineRecoveryRatePct={kpis.baselineRecoveryRatePct}
                incrementalRecoveryPct={kpis.incrementalRecoveryPct}
              />
            </section>

            {/* Analytics Breakdown Grid: Failure Causes & Interventions */}
            <section aria-label="Diagnostic Breakdown" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FailureCauseChart data={failureCauses} />
              <InterventionChart data={interventions} />
            </section>

            {/* Priority Cases Table */}
            <section aria-label="Ranked Recovery Opportunities">
              <PriorityCasesTable cases={cases} onCaseUpdated={handleCaseUpdated} />
            </section>

            {/* Bottom Section: Activity Feed & Technical Guarantees */}
            <section aria-label="Audit and Engine Diagnostics" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Activity Feed (2 Cols) */}
              <div className="lg:col-span-2">
                <ActivityFeed
                  activities={activities}
                  onSelectCase={(caseId) => {
                    const found = cases.find((c) => c.id === caseId);
                    if (found) setInspectedCase(found);
                  }}
                />
              </div>

              {/* Technical Architecture & Mathematical Guarantees (1 Col) */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#635BFF]" />
                      <h3 className="text-sm font-bold tracking-tight text-[#0F172A]">
                        System Guarantees
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded-full font-medium">
                      TECH SPEC
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    {/* Guarantee 1: Single-Draw Monotonicity */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A] text-xs">
                          Single-Draw Monotonicity (u &lt; p)
                        </span>
                        <span className="font-mono text-[10px] text-[#10B981] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                          Δ ≥ 0
                        </span>
                      </div>
                      <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed">
                        Baseline and Agent are evaluated on the exact same pseudo-random draw. Guarantees non-negative lift.
                      </p>
                    </div>

                    {/* Guarantee 2: Prediction ≠ Authorization */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A] text-xs">
                          Prediction ≠ Authorization
                        </span>
                        <span className="font-mono text-[10px] text-[#635BFF] bg-[#635BFF]/10 px-1.5 py-0.5 rounded font-bold">
                          INDEPENDENT
                        </span>
                      </div>
                      <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed">
                        High ML score informs priority; policy engine deterministically controls execution.
                      </p>
                    </div>

                    {/* Guarantee 3: Financial Safety Limits */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A] text-xs">
                          Financial Safety Limits
                        </span>
                        <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                          BOUNDED
                        </span>
                      </div>
                      <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed">
                        Max retries cap, manager approval above threshold, and margin preservation enforced.
                      </p>
                    </div>

                    {/* Guarantee 4: Zero-Secrets Invariant */}
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A] text-xs">
                          Zero-Secrets Invariant
                        </span>
                        <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                          ENFORCED
                        </span>
                      </div>
                      <p className="text-[#64748B] text-xs mt-1.5 leading-relaxed">
                        HMAC verification with constant-time equality. No credentials exposed to client state.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B]">
                  <div className="flex items-center justify-between font-mono">
                    <span>Deterministic Seed: <strong className="text-[#0F172A] font-semibold">{seed}</strong></span>
                    <span>Subscriptions: <strong className="text-[#0F172A] font-semibold">{cases.length}</strong></span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Case inspection modal */}
      {inspectedCase && (
        <CaseDetailModal
          recoveryCase={inspectedCase}
          onClose={() => setInspectedCase(null)}
          onCaseUpdated={handleCaseUpdated}
        />
      )}

      {/* Financial Guardrails Control Panel Drawer */}
      <GuardrailsPanel
        isOpen={isGuardrailsOpen}
        onClose={() => setIsGuardrailsOpen(false)}
        config={policyConfig}
        killSwitchEnabled={killSwitchActive}
        onUpdateConfig={handleUpdatePolicyConfig}
        onToggleKillSwitch={handleToggleKillSwitch}
        casePolicyCounts={policyCounts}
      />

      {/* Razorpay Test Event Simulator Modal Wizard */}
      <RazorpaySimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onCaseSimulated={handleCaseSimulated}
      />

      {/* Audit Trail Modal Feed */}
      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />

      {/* Hackathon Judge Demo Script Guide Modal */}
      <DemoGuideModal
        isOpen={isDemoGuideOpen}
        onClose={() => setIsDemoGuideOpen(false)}
        onSelectDemoScenario={handleSelectDemoScenario}
      />

      {/* Customer Email Templates Manager & Preview Modal */}
      <EmailTemplatesModal
        isOpen={isEmailTemplatesOpen}
        onClose={() => setIsEmailTemplatesOpen(false)}
      />
    </div>
  );
};
