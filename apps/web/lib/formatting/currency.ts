/**
 * Currency formatting for Somnia testnet (STT payment token, 6 decimals in smallest unit).
 */

import { PAYMENT_DECIMALS, PAYMENT_SYMBOL } from '@/config/currency'

const DIVISOR = 10 ** PAYMENT_DECIMALS

function formatSttAmount(amount: number, fixedDecimals?: number): string {
  if (fixedDecimals !== undefined) {
    return `${amount.toFixed(fixedDecimals)} ${PAYMENT_SYMBOL}`
  }
  if (amount === 0) return `0 ${PAYMENT_SYMBOL}`
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M ${PAYMENT_SYMBOL}`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K ${PAYMENT_SYMBOL}`
  }
  if (amount < 0.01) return `${amount.toFixed(6)} ${PAYMENT_SYMBOL}`
  if (amount < 1) return `${amount.toFixed(4)} ${PAYMENT_SYMBOL}`
  return `${amount.toFixed(2)} ${PAYMENT_SYMBOL}`
}

/**
 * Format amount in smallest unit (e.g. 1_000_000 = 1 STT with 6 decimals).
 */
export function formatCurrency(amountInSmallestUnit: number): string {
  return formatSttAmount(amountInSmallestUnit / DIVISOR)
}

export function formatEarnings(amountInSmallestUnit: number): string {
  return formatCurrency(amountInSmallestUnit)
}

export function formatPrice(
  amountInSmallestUnit: number,
  decimals?: number
): string {
  const amount = amountInSmallestUnit / DIVISOR
  if (decimals !== undefined) {
    return `${amount.toFixed(decimals)} ${PAYMENT_SYMBOL}`
  }
  return formatCurrency(amountInSmallestUnit)
}

export function formatPriceForDisplay(priceInSmallestUnit: number): string {
  return (priceInSmallestUnit / DIVISOR).toString()
}

export function formatSuccessRate(successful: number, total: number): string {
  if (total === 0) return '0%'
  const rate = (successful / total) * 100
  return `${rate.toFixed(1)}%`
}

export function formatCompact(value: number, decimals: number = 1): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`
  }
  return value.toString()
}
