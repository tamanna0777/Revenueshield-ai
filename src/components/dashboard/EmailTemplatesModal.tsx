import React, { useState, useMemo } from 'react';
import {
  X,
  Mail,
  Smartphone,
  Monitor,
  Send,
  Copy,
  Check,
  Sparkles,
  Sliders,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  CustomerEmailTemplateType,
  CustomerEmailTemplateVariables,
  CUSTOMER_EMAIL_TEMPLATES,
  DEFAULT_TEMPLATE_VARIABLES,
  renderCustomerEmailHtml,
  renderCustomerEmailText,
} from '../../services/emailTemplates.ts';

interface EmailTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate?: CustomerEmailTemplateType;
}

export const EmailTemplatesModal: React.FC<EmailTemplatesModalProps> = ({
  isOpen,
  onClose,
  initialTemplate = 'smart_retry',
}) => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<CustomerEmailTemplateType>(initialTemplate);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [variables, setVariables] = useState<CustomerEmailTemplateVariables>({
    ...DEFAULT_TEMPLATE_VARIABLES,
  });

  const [testRecipient, setTestRecipient] = useState<string>('alex.morgan@company.com');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendFeedback, setSendFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [copiedType, setCopiedType] = useState<'html' | 'text' | null>(null);

  // Sync initial template when modal opens
  React.useEffect(() => {
    if (isOpen && initialTemplate) {
      setSelectedTemplate(initialTemplate);
    }
  }, [isOpen, initialTemplate]);

  const activeTemplateDef = CUSTOMER_EMAIL_TEMPLATES[selectedTemplate];

  // Rendered HTML & Text based on current variables
  const renderedHtml = useMemo(() => {
    return renderCustomerEmailHtml(selectedTemplate, variables);
  }, [selectedTemplate, variables]);

  const renderedText = useMemo(() => {
    return renderCustomerEmailText(selectedTemplate, variables);
  }, [selectedTemplate, variables]);

  if (!isOpen) return null;

  const handleCopy = async (type: 'html' | 'text') => {
    try {
      const content = type === 'html' ? renderedHtml : renderedText;
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // clipboard fallback
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient || !testRecipient.includes('@')) {
      setSendFeedback({
        type: 'error',
        message: 'Please provide a valid email address to send a test notification.',
      });
      return;
    }

    setIsSending(true);
    setSendFeedback(null);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipient,
          templateType: selectedTemplate,
          variables,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch email');
      }

      setSendFeedback({
        type: 'success',
        message: `Dispatched "${activeTemplateDef.name}" billing notification to ${testRecipient}.`,
      });
    } catch (err: any) {
      setSendFeedback({
        type: 'error',
        message: err?.message || 'Unable to send email. Check RESEND_API_KEY.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVariableChange = (
    key: keyof CustomerEmailTemplateVariables,
    val: string
  ) => {
    setVariables((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetVariables = () => {
    setVariables({ ...DEFAULT_TEMPLATE_VARIABLES });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#635BFF] flex items-center justify-center text-white shadow-xs">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Customer Email Templates
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  SaaS Customer Facing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Modern responsive billing notifications for end subscribers, free of internal telemetry or technical codes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              title="Close template manager"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Template Selector Navigation */}
        <div className="border-b border-slate-200 bg-white px-6 py-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <nav className="flex items-center gap-1.5 flex-wrap">
              {(
                Object.keys(
                  CUSTOMER_EMAIL_TEMPLATES
                ) as CustomerEmailTemplateType[]
              ).map((type) => {
                const def = CUSTOMER_EMAIL_TEMPLATES[type];
                const isSelected = selectedTemplate === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedTemplate(type);
                      setSendFeedback(null);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#635BFF] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{def.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Viewport & Action Toggles */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-slate-600">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'desktop'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                  title="Desktop View"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    viewMode === 'mobile'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'hover:text-slate-900'
                  }`}
                  title="Mobile View"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mobile</span>
                </button>
              </div>

              <button
                onClick={() => handleCopy('html')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Copy ready-to-use responsive HTML"
              >
                {copiedType === 'html' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">HTML Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copy HTML</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content Body: Left Preview, Right Variable Controls */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          
          {/* Main Email Preview Canvas (7 cols on desktop) */}
          <div className="lg:col-span-7 bg-slate-100/70 p-4 sm:p-6 overflow-y-auto flex flex-col items-center justify-start border-r border-slate-200">
            {/* Subject preview bar */}
            <div className="w-full max-w-[580px] bg-white rounded-lg px-4 py-2.5 mb-4 border border-slate-200 shadow-2xs flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Subject:
                </span>
                <span className="font-semibold text-slate-800 truncate">
                  {activeTemplateDef.subject}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                Button: <strong className="text-[#635BFF]">{activeTemplateDef.buttonText}</strong>
              </span>
            </div>

            {/* Email Container Frame */}
            <div
              className={`transition-all duration-200 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden ${
                viewMode === 'mobile' ? 'w-[375px]' : 'w-full max-w-[580px]'
              }`}
            >
              <div className="bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 flex items-center justify-between font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                  <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
                  <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                  <span className="ml-2 text-slate-400">
                    {viewMode === 'mobile' ? 'Mobile Client (375px)' : 'Responsive HTML Mailer'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">RevenueShield AI</span>
              </div>

              {/* Rendered HTML in sandbox iframe */}
              <iframe
                title="Customer Email Preview"
                srcDoc={renderedHtml}
                className="w-full border-0"
                style={{ height: '560px' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Right Configuration & Dispatch Panel (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-5">
              
              {/* Template Description */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    {activeTemplateDef.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Template: {selectedTemplate}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeTemplateDef.description}
                </p>
              </div>

              {/* Dynamic Variables Form */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-[#635BFF]" />
                    Dynamic Variables (Live Interpolation)
                  </label>
                  <button
                    onClick={handleResetVariables}
                    className="text-[11px] font-medium text-[#635BFF] hover:underline"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      {'{{customerName}}'}
                    </label>
                    <input
                      type="text"
                      value={variables.customerName}
                      onChange={(e) => handleVariableChange('customerName', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        {'{{amount}}'}
                      </label>
                      <input
                        type="text"
                        value={variables.amount}
                        onChange={(e) => handleVariableChange('amount', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        {'{{companyName}}'}
                      </label>
                      <input
                        type="text"
                        value={variables.companyName}
                        onChange={(e) => handleVariableChange('companyName', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                      />
                    </div>
                  </div>

                  {selectedTemplate === 'discount_offer' && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-purple-50/50 border border-purple-100 rounded-lg">
                      <div>
                        <label className="block text-[11px] font-medium text-purple-900 mb-1">
                          {'{{discountPercent}}'}
                        </label>
                        <input
                          type="text"
                          value={variables.discountPercent}
                          onChange={(e) => handleVariableChange('discountPercent', e.target.value)}
                          className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-purple-900 mb-1">
                          {'{{discountAmount}}'}
                        </label>
                        <input
                          type="text"
                          value={variables.discountAmount}
                          onChange={(e) => handleVariableChange('discountAmount', e.target.value)}
                          className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      {selectedTemplate === 'payment_link' || selectedTemplate === 'discount_offer'
                        ? '{{paymentLink}}'
                        : '{{billingPortalUrl}}'}
                    </label>
                    <input
                      type="text"
                      value={
                        selectedTemplate === 'payment_link' || selectedTemplate === 'discount_offer'
                          ? variables.paymentLink
                          : variables.billingPortalUrl
                      }
                      onChange={(e) =>
                        handleVariableChange(
                          selectedTemplate === 'payment_link' || selectedTemplate === 'discount_offer'
                            ? 'paymentLink'
                            : 'billingPortalUrl',
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 font-mono focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                    />
                  </div>
                </div>
              </div>

              {/* Live Test Dispatch */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Send Live Test Notification
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#635BFF] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
                  />
                  <button
                    onClick={handleSendTestEmail}
                    disabled={isSending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#635BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5349e0] transition-colors disabled:opacity-50 shadow-xs"
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>Send</span>
                  </button>
                </div>

                {sendFeedback && (
                  <div
                    className={`mt-2.5 rounded-lg p-2.5 text-xs flex items-start gap-2 ${
                      sendFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {sendFeedback.type === 'success' ? (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-snug">{sendFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notes */}
            <div className="pt-4 border-t border-slate-200 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Clean SaaS typography & responsive layout</span>
              <span>© RevenueShield AI</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
