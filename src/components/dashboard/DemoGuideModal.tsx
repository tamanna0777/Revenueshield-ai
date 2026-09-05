import React from 'react';
import {
  X,
  Compass,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  FileText,
  Sliders,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDemoScenario: () => void;
}

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Review Revenue at Risk',
    desc: 'Examine the total delinquent revenue across subscriptions, current baseline blind-retry recovery, and overall recovery potential.',
    icon: TrendingUp,
  },
  {
    step: 2,
    title: 'Open a High-Priority Case',
    desc: 'Inspect the top ranked case in the Priority Queue. See how priority balances monetary value, recovery probability, and churn risk.',
    icon: Sparkles,
  },
  {
    step: 3,
    title: 'Inspect "Why this intervention?"',
    desc: 'Understand the deterministic diagnosis: why the customer failed (e.g. Expired Card) and which targeted intervention produces the highest probability lift.',
    icon: CheckCircle2,
  },
  {
    step: 4,
    title: 'Open Financial Guardrails',
    desc: 'Click "Guardrails" in the top bar to view bounded autonomy thresholds, max retries, and high-value approvals.',
    icon: Sliders,
  },
  {
    step: 5,
    title: 'Lower Approval Threshold',
    desc: 'Switch the High-Value Threshold from ₹50,000 to ₹15,000 (or click the "Strict ₹15k" preset).',
    icon: Sliders,
  },
  {
    step: 6,
    title: 'Observe Policy Transition (Prediction ≠ Authorization)',
    desc: 'Watch high-value cases transition from ALLOW to REQUIRE_APPROVAL while their ML recovery probability and intervention diagnosis remain 100% untouched.',
    icon: ShieldCheck,
  },
  {
    step: 7,
    title: 'Trigger Razorpay Test Event',
    desc: 'Click "Test Webhook". Dispatch an HMAC-SHA256 signed webhook wizard and observe the 5-stage automated pipeline execution.',
    icon: Zap,
  },
  {
    step: 8,
    title: 'Open Audit Trail',
    desc: 'Open the immutable Audit Trail to verify zero-secrets compliance and view the full EVENT → DIAGNOSIS → POLICY → OUTCOME story.',
    icon: FileText,
  },
  {
    step: 9,
    title: 'Verify Incremental Recovery',
    desc: 'Check the Counterfactual Single-Draw Ledger: both baseline and AI share the exact same random draw (u), proving true incremental lift.',
    icon: CheckCircle2,
  },
];

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectDemoScenario,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        id="demo-guide-modal"
        className="relative w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl text-[#0F172A] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF]/10 text-[#635BFF]">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-[#0F172A]">
                  Hackathon Judge Demo Guide
                </h2>
                <span className="text-[11px] font-mono font-medium text-[#635BFF] bg-[#635BFF]/10 px-2 py-0.5 rounded-full">
                  9-Step Interactive Walkthrough
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Evaluate RevenueShield AI autonomous pipeline and bounded autonomy in 3 minutes
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

        {/* 1-Click Scenario Launcher Banner */}
        <div className="mt-4 rounded-xl bg-[#635BFF]/5 p-4 border border-[#635BFF]/20 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold text-[#635BFF]">
              1-Click Demo Scenario Spotlight
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Instantly opens the benchmark high-value case to demonstrate policy evaluation.
            </p>
          </div>
          <button
            id="launch-demo-scenario-btn"
            onClick={() => {
              onSelectDemoScenario();
              onClose();
            }}
            className="rounded-lg bg-[#635BFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5249e0] transition-colors shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <span>Launch Case</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Steps List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {DEMO_STEPS.map((step) => {
            return (
              <div
                key={step.step}
                className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white border border-[#E2E8F0] font-mono text-xs font-bold text-[#635BFF] shadow-xs">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0F172A]">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between shrink-0 text-xs text-[#64748B]">
          <span>RevenueShield AI • Bounded Autonomous Recovery Engine</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
