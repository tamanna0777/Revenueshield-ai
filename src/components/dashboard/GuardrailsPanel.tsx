import React from 'react';
import { PolicyConfig } from '../../types.ts';
import { formatInr } from '../../utils/format.ts';
import {
  AlertOctagon,
  Sliders,
  X,
  Lock,
  Info,
  ShieldCheck,
  Clock,
  Ban,
  Check,
} from 'lucide-react';

interface GuardrailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: PolicyConfig;
  killSwitchEnabled: boolean;
  onUpdateConfig: (newConfig: Partial<PolicyConfig>) => void;
  onToggleKillSwitch: (enabled: boolean) => void;
  casePolicyCounts?: {
    allowed: number;
    requireApproval: number;
    blocked: number;
    total: number;
  };
}

export const GuardrailsPanel: React.FC<GuardrailsPanelProps> = ({
  isOpen,
  onClose,
  config,
  killSwitchEnabled,
  onUpdateConfig,
  onToggleKillSwitch,
  casePolicyCounts = { allowed: 0, requireApproval: 0, blocked: 0, total: 0 },
}) => {
  if (!isOpen) return null;

  const blockedChannels = config.blockedChannels || ['SMS'];
  const maxDiscountRate = config.maxDiscountRate ?? 10;
  const quietHoursStart = config.quietHoursStart ?? '22:00';
  const quietHoursEnd = config.quietHoursEnd ?? '08:00';

  const toggleChannel = (channel: string) => {
    const next = blockedChannels.includes(channel)
      ? blockedChannels.filter((c) => c !== channel)
      : [...blockedChannels, channel];
    onUpdateConfig({ blockedChannels: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        id="financial-guardrails-panel"
        className="relative h-full w-full max-w-[560px] bg-white p-6 shadow-2xl overflow-y-auto border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200 text-[#0F172A] flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635BFF]/10 text-[#635BFF]">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-[#0F172A]">
                  Guardrails & Policy Engine
                </h2>
                <p className="text-xs text-[#64748B]">
                  Administrative safety boundaries, approval ceilings & kill switches
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close guardrails panel"
              className="rounded-lg p-2 text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Real-time Status Badge */}
          <div className="mt-4 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">Policy Queue Status:</span>
              <span className="font-semibold text-[#0F172A] font-mono">
                {casePolicyCounts.total} cases
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-[#10B981] font-semibold">{casePolicyCounts.allowed} Allowed</span>
              <span className="text-slate-300">•</span>
              <span className="text-amber-600 font-semibold">{casePolicyCounts.requireApproval} Pending</span>
              <span className="text-slate-300">•</span>
              <span className="text-[#EF4444] font-semibold">{casePolicyCounts.blocked} Blocked</span>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {/* 1. DANGER ZONE AT TOP: EMERGENCY STOP KILL SWITCH */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#EF4444] mb-2 flex items-center gap-1.5">
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>1. Danger Zone — Emergency Stop</span>
              </div>

              <div
                className={`rounded-xl border-2 p-4 transition-all ${
                  killSwitchEnabled
                    ? 'border-[#EF4444] bg-rose-50 shadow-md ring-2 ring-rose-200'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0F172A]">
                        Global Kill Switch
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                          killSwitchEnabled
                            ? 'bg-[#EF4444] text-white animate-pulse'
                            : 'bg-slate-200 text-[#64748B]'
                        }`}
                      >
                        {killSwitchEnabled ? 'ENGAGED — ALL OPERATIONS HALTED' : 'STANDBY (ACTIVE)'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      Instant hard cut: halts all automated recovery webhooks, payment links, and scheduled retries.
                    </p>
                  </div>

                  <button
                    id="kill-switch-toggle-btn"
                    onClick={() => onToggleKillSwitch(!killSwitchEnabled)}
                    className={`ml-4 shrink-0 rounded-lg px-4 py-2.5 text-xs font-bold tracking-wide transition-all shadow-xs ${
                      killSwitchEnabled
                        ? 'bg-[#EF4444] text-white hover:bg-rose-700 ring-2 ring-rose-400'
                        : 'bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {killSwitchEnabled ? 'RESET KILL SWITCH' : 'EMERGENCY STOP'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. OPERATIONAL POLICIES: THRESHOLD CONTROLS & APPROVAL LIMITS */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                2. Operational Policies & Threshold Controls
              </div>

              <div className="space-y-3">
                {/* Max Retry Attempts */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      Max Retry Attempts per Subscription
                    </span>
                    <span className="font-mono font-bold text-[#635BFF]">
                      {config.maxAutomatedAttempts ?? config.maxRetryAttemptsPerCase ?? 3} attempts
                    </span>
                  </div>
                  <input
                    id="input-max-attempts"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={config.maxAutomatedAttempts ?? config.maxRetryAttemptsPerCase ?? 3}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateConfig({
                        maxAutomatedAttempts: val,
                        maxRetryAttemptsPerCase: val,
                        maxInterventionAttempts: val,
                      });
                    }}
                    className="mt-2.5 w-full accent-[#635BFF] cursor-pointer"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#64748B]">
                    <span>1 attempt</span>
                    <span>3 (recommended)</span>
                    <span>5 attempts</span>
                  </div>
                </div>

                {/* Minimum Recovery Probability */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      Minimum Recovery Probability
                    </span>
                    <span className="font-mono font-bold text-[#635BFF]">
                      {((config.minimumRecoveryProbability ?? config.minRecoveryProbability ?? 0.15) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    id="input-min-prob"
                    type="range"
                    min={0.05}
                    max={0.5}
                    step={0.05}
                    value={config.minimumRecoveryProbability ?? config.minRecoveryProbability ?? 0.15}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateConfig({
                        minimumRecoveryProbability: val,
                        minRecoveryProbability: val,
                      });
                    }}
                    className="mt-2.5 w-full accent-[#635BFF] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Suppresses attempts on lower-confidence cases to protect cardholder goodwill.
                  </p>
                </div>

                {/* Maximum Risk Score Ceiling */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      Max Risk Score for Autonomous Recovery
                    </span>
                    <span className="font-mono font-bold text-[#635BFF]">
                      &lt; {config.maxRiskScoreForAutonomousRecovery ?? 85}
                    </span>
                  </div>
                  <input
                    id="input-max-risk-score"
                    type="range"
                    min={50}
                    max={95}
                    step={5}
                    value={config.maxRiskScoreForAutonomousRecovery ?? 85}
                    onChange={(e) =>
                      onUpdateConfig({
                        maxRiskScoreForAutonomousRecovery: Number(e.target.value),
                      })
                    }
                    className="mt-2.5 w-full accent-[#635BFF] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Delinquencies with higher customer risk scores require manual operator approval.
                  </p>
                </div>

                {/* Max Discount Rate */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      Max Discount Rate on Recovery Offers
                    </span>
                    <span className="font-mono font-bold text-[#635BFF]">
                      {maxDiscountRate}%
                    </span>
                  </div>
                  <input
                    id="input-max-discount"
                    type="range"
                    min={0}
                    max={25}
                    step={5}
                    value={maxDiscountRate}
                    onChange={(e) =>
                      onUpdateConfig({ maxDiscountRate: Number(e.target.value) })
                    }
                    className="mt-2.5 w-full accent-[#635BFF] cursor-pointer"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-[#64748B]">
                    <span>0% (No discounts)</span>
                    <span>10% (Default)</span>
                    <span>25% (Max allowable)</span>
                  </div>
                </div>

                {/* Autonomous vs Manual Approval Threshold */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      Autonomous Recovery Ceiling
                    </span>
                    <span className="font-mono font-bold text-[#635BFF]">
                      {formatInr(config.approvalAmountThresholdInr ?? config.highValueThresholdInr ?? 50000)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Invoices above this amount require human operator sign-off before executing.
                  </p>
                  <input
                    id="input-approval-threshold"
                    type="range"
                    min={5000}
                    max={100000}
                    step={5000}
                    value={config.approvalAmountThresholdInr ?? config.highValueThresholdInr ?? 50000}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onUpdateConfig({
                        approvalAmountThresholdInr: val,
                        manualApprovalThresholdInr: val,
                        highValueThresholdInr: val,
                      });
                    }}
                    className="mt-2.5 w-full accent-[#635BFF] cursor-pointer"
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[11px] text-[#64748B]">Presets:</span>
                    <button
                      onClick={() =>
                        onUpdateConfig({
                          approvalAmountThresholdInr: 15000,
                          manualApprovalThresholdInr: 15000,
                          highValueThresholdInr: 15000,
                        })
                      }
                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs font-mono text-[#0F172A]"
                    >
                      ₹15k
                    </button>
                    <button
                      onClick={() =>
                        onUpdateConfig({
                          approvalAmountThresholdInr: 30000,
                          manualApprovalThresholdInr: 30000,
                          highValueThresholdInr: 30000,
                        })
                      }
                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs font-mono text-[#0F172A]"
                    >
                      ₹30k
                    </button>
                    <button
                      onClick={() =>
                        onUpdateConfig({
                          approvalAmountThresholdInr: 50000,
                          manualApprovalThresholdInr: 50000,
                          highValueThresholdInr: 50000,
                        })
                      }
                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs font-mono text-[#0F172A]"
                    >
                      ₹50k (Default)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ENTERPRISE SETTINGS: BLOCKED CHANNELS & QUIET HOURS */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                3. Enterprise Settings
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-4">
                {/* Blocked Channels */}
                <div>
                  <div className="text-xs font-semibold text-[#0F172A] mb-2">
                    Blocked Outbound Channels
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['SMS', 'WhatsApp', 'Email', 'Phone Call', 'In-App Banner'].map(
                      (channel) => {
                        const isBlocked = blockedChannels.includes(channel);
                        return (
                          <label
                            key={channel}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              isBlocked
                                ? 'border-[#EF4444]/40 bg-rose-50/50 text-[#EF4444]'
                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBlocked}
                              onChange={() => toggleChannel(channel)}
                              className="h-3.5 w-3.5 accent-[#EF4444] rounded"
                            />
                            <span className="font-medium">{channel}</span>
                            {isBlocked && <span className="text-[10px] ml-auto">Blocked</span>}
                          </label>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Quiet Hours */}
                <div className="pt-3 border-t border-[#E2E8F0]">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] mb-2">
                    <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                    <span>Quiet Hours (Customer Timezone)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] text-[#64748B] block mb-1">
                        Do Not Disturb Start
                      </label>
                      <input
                        type="time"
                        value={quietHoursStart}
                        onChange={(e) => onUpdateConfig({ quietHoursStart: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:border-[#635BFF] focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] text-[#64748B] block mb-1">
                        Resume Allowed Operations
                      </label>
                      <input
                        type="time"
                        value={quietHoursEnd}
                        onChange={(e) => onUpdateConfig({ quietHoursEnd: e.target.value })}
                        className="w-full h-8 px-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] focus:border-[#635BFF] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <span className="text-xs text-[#64748B]">
            Zero-Secrets Segregation • HMAC-Verified
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0F172A] px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

