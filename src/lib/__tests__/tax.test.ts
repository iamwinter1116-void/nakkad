import { describe, it, expect } from 'vitest'
import { computeTax, roundTax, slabTaxOf, NEW_SLABS } from '../tax'

describe('rounding (Sec 288B)', () => {
  it('rounds to nearest ₹10, ≥5 up', () => {
    expect(roundTax(614)).toBe(610)
    expect(roundTax(615)).toBe(620)
    expect(roundTax(0)).toBe(0)
  })
})

describe('new-regime slabs FY 2026-27', () => {
  it('computes slab tax at sample incomes', () => {
    // taxable 8L → 4L-8L band @5% = 20,000
    expect(slabTaxOf(NEW_SLABS, 800000)).toBe(20000)
    // taxable 12L → 20k + 4L@10% = 60,000
    expect(slabTaxOf(NEW_SLABS, 1200000)).toBe(60000)
    // taxable 16L → 60k + 15% of 4L = 60k+60k
    expect(slabTaxOf(NEW_SLABS, 1600000)).toBe(120000)
    // taxable 24L → 20k + 40k + 60k + 80k + 25% of 20-24L (100k) = 300,000
    expect(slabTaxOf(NEW_SLABS, 2400000)).toBe(300000)
  })
})

describe('rebate + marginal relief', () => {
  it('zero tax up to ₹12L taxable (₹12.75L salary)', () => {
    const r = computeTax(1275000, 'new')
    expect(r.totalTax).toBe(0)
  })
  it('₹12.75L salary is the zero-tax boundary (excess ₹1 → tax rounds to ₹0)', () => {
    const r = computeTax(1275001, 'new')
    expect(r.totalTax).toBe(0)
    // ₹1 over the boundary in taxable terms rounds away under 288B marginal relief
  })
  it('₹12,75,060 salary → marginal relief taxes the ₹60 excess only', () => {
    const r = computeTax(1275060, 'new')
    expect(r.totalTax).toBe(60) // 60 + 4% cess = 62.4 → ₹60
  })
  it('marginal relief: ₹12.10L taxable pays ₹10,000, not ₹61,500', () => {
    // salary = 12.10L taxable + 75k std = 12.85L gross
    const r = computeTax(1285000, 'new')
    // slab tax at 12.10L taxable = 60,000 (exactly at cliff? No: 12.10L → 60000 + 10% of 10k = 61,000)
    // marginal relief: tax ≤ income over 12L = 10,000 (+4% cess = 10,400 → 10,400? rounded 10,400)
    expect(r.marginalReliefApplied).toBe(true)
    expect(r.totalTax).toBe(10400)
  })
  it('old regime: zero tax up to ₹5.5L salary', () => {
    const r = computeTax(550000, 'old')
    expect(r.totalTax).toBe(0)
  })
  it('old regime ₹6L salary (no deductions) pays 5% of 3L = ₹12,500... actually 2.5L-5L@5% + 5-6L@20%', () => {
    const r = computeTax(600000, 'old')
    // taxable 550k: 12,500 (2.5-5L@5%) + 20% of 50k = 22,500
    expect(r.totalTax).toBe(23400)
  })
})

describe('surcharge + marginal relief', () => {
  it('10% surcharge above ₹50L taxable', () => {
    const r = computeTax(6000000, 'new') // taxable 59.25L
    expect(r.surcharge).toBeGreaterThan(0)
    expect(r.surcharge).toBeCloseTo(0.1 * r.slabTax, -1)
  })
  it('marginal relief kicks in just above ₹50L', () => incomeJustAbove(50))
  it('marginal relief works at ₹1Cr and ₹2Cr thresholds', () => {
    incomeJustAbove(100)
    incomeJustAbove(200)
  })
})

function incomeJustAbove(lakhThreshold: number) {
  const threshold = lakhThreshold * 100000
  // taxable = threshold + 10,000 → gross = taxable + 75k
  const r = computeTax(threshold + 10000 + 75000, 'new')
  const rawSlab = slabTaxOf(NEW_SLABS, threshold + 10000)
  const rawSC = 0.1 * rawSlab // threshold band rate (10% at 50L, 15% at 1Cr, 25% at 2Cr? adjust)
  // Marginal relief: tax+SC ≤ taxAtThreshold + excess
  const taxAtThreshold = slabTaxOf(THRESHOLD_SLABS, threshold)
  void rawSC
  const maxLiability = taxAtThreshold + 10000
  const totalRaw = r.slabTax + r.surcharge
  expect(totalRaw).toBeLessThanOrEqual(maxLiability + 5) // +cess rounding
  return r
}
const THRESHOLD_SLABS = NEW_SLABS

describe('effective rates sanity', () => {
  it('₹1Cr salary effective rate < 35%', () => {
    const r = computeTax(10000000, 'new')
    expect(r.effectiveRateOnGross).toBeLessThan(0.35)
  })
})
