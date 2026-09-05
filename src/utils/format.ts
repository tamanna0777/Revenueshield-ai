/**
 * Formatting Utilities for RevenueShield AI
 * Provides standardized INR currency, percentage, and timestamp formatting.
 */

/**
 * Formats a number into Indian Rupee (INR) currency format.
 * Examples:
 * - formatInr(5360707) => "₹53,60,707"
 * - formatInr(1240000, true) => "₹12.4L"
 * - formatInr(12000000, true) => "₹1.20Cr"
 */
export function formatInr(amount: number, compact: boolean = false): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '₹0';
  }

  const safeAmount = Math.max(0, amount);

  if (compact) {
    if (safeAmount >= 10000000) {
      // Crores
      const cr = safeAmount / 10000000;
      return `₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)}Cr`;
    }
    if (safeAmount >= 100000) {
      // Lakhs
      const l = safeAmount / 100000;
      return `₹${l >= 10 ? l.toFixed(1) : l.toFixed(2)}L`;
    }
    if (safeAmount >= 1000) {
      // Thousands
      return `₹${(safeAmount / 1000).toFixed(1)}k`;
    }
    return `₹${Math.round(safeAmount).toLocaleString('en-IN')}`;
  }

  // Full Indian number formatting (lakhs/crores separators)
  return `₹${Math.round(safeAmount).toLocaleString('en-IN')}`;
}

/**
 * Formats a ratio or percentage number.
 * If value is <= 1.0, treats as fraction (0.42 -> "42.0%").
 * If value > 1.0, treats as already scaled percentage (42.0 -> "42.0%").
 */
export function formatPercentage(val: number, decimals: number = 1): string {
  if (val === undefined || val === null || Number.isNaN(val) || !Number.isFinite(val)) {
    return '0.0%';
  }
  const pct = val <= 1.0 && val > 0 ? val * 100 : val;
  return `${Math.max(0, pct).toFixed(decimals)}%`;
}

/**
 * Formats ISO date string into readable short date
 */
export function formatDate(isoDate: string): string {
  if (!isoDate) return 'N/A';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Formats ISO date string into readable short time
 */
export function formatTime(isoDate: string): string {
  if (!isoDate) return 'N/A';
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoDate;
  }
}
