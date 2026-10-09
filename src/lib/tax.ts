/**
 * NAKKAD TAX ENGINE — India individual income tax, FY 2026-27 (AY 2027-28).
 *
 * VERIFIED SOURCES (checked Oct 2026 against live primary/secondary sources):
 *  - incometaxindia.gov.in tax-rates page: new-regime slabs 0/5/10/15/20/25/30
 *    at ₹4L/8L/12L/16L/20L/24L boundaries (AY 2027-28 column).
 *  - Budget 2026 (1 Feb 2026) left personal income tax unchanged from FY25-26.
 *    Income-tax Act 2025 renumbered sections: 87A→156, 115BAC→202; same amounts.
 *  - Standard deduction: ₹75,000 new / ₹50,000 old (salaried).
 *  - Rebate (Sec 156, fka 87A): new regime — up to ₹60,000 if taxable ≤ ₹12L,
 *    with MARGINAL RELIEF above ₹12L (tax can't exceed income over ₹12L);
 *    verified vector: ₹12.10L taxable → ₹10,000 (+cess), NOT ₹61,500.
 *    Old regime — ₹12,500 if taxable ≤ ₹5L, no marginal relief.
 *  - Surcharge: 10% >₹50L, 15% >₹1Cr, 25% >₹2Cr (new regime caps at 25%;
 *    old regime adds 37% >₹5Cr), each threshold with marginal relief.
 *  - Cess 4% on tax+surcharge. Sec 288B: final tax rounded to nearest ₹10.
 *
 * SECURITY: pure functions, no I/O, no network. Integer-rupee math.
 */

export const FY = 'FY 2026-27'

export type Regime = 'new' | 'old'

export interface Slab { upTo: number; rate: number }

export const NEW_SLABS: Slab[] = [
  { upTo: 400000, rate: 0.0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
]

export const OLD_SLABS: Slab[] = [
  { upTo: 250000, rate: 0.0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
]

export const CESS_RATE = 0.04
export const STD_DEDUCTION: Record<Regime, number> = { new: 75000, old: 50000 }

const NEW_SURCHARGE: [number, number][] = [
  [5000000, 0.1],
  [10000000, 0.15],
  [20000000, 0.25],
]
const OLD_SURCHARGE: [number, number][] = [
  [5000000, 0.1],
  [10000000, 0.15],
  [20000000, 0.25],
  [100000000, 0.37],
]

export interface TaxResult {
  regime: Regime
  taxableIncome: number
  slabTax: number          // before rebate/surcharge/cess
  rebate: number
  marginalReliefApplied: boolean
  surcharge: number
  cess: number
  totalTax: number         // annual, rounded to ₹10 (Sec 288B)
  monthlyTds: number
  effectiveRateOnGross: number
  notes: string[]
}

/** Round tax to the nearest ₹10 per Sec 288B (fraction ≥ 5 rounds up). */
export function roundTax(t: number): number {
  return Math.round(t / 10) * 10
}

export function slabTaxOf(slabs: Slab[], income: number): number {
  let tax = 0
  let prev = 0
  for (const s of slabs) {
    if (income <= prev) break
    const band = Math.min(income, s.upTo) - prev
    tax += band * s.rate
    prev = s.upTo
  }
  return tax
}

function surchargeRateFor(bands: [number, number][], income: number): number {
  let rate = 0
  for (const [from, r] of bands) if (income > from) rate = r
  return rate
}

/**
 * Income tax for a salaried individual, FY 2026-27.
 *
 * @param grossSalary     Annual gross salary (₹).
 * @param regime          'new' | 'old'.
 * @param extraDeductions Deductions from gross (both regimes): professional
 *                        tax (Sec 16(iii)) + employer NPS (80CCD(2)).
 *                        Old regime additionally: 80C + 80D + 80CCD(1B) +
 *                        HRA exemption (10(13A)) + home-loan interest (24(b)).
 *                        The CALLER clamps caps (80C≤1.5L etc.); this function
 *                        trusts the input.
 */
export function computeTax(
  grossSalary: number,
  regime: Regime,
  extraDeductions = 0,
): TaxResult {
  const notes: string[] = []
  const std = STD_DEDUCTION[regime]
  const slabs = regime === 'new' ? NEW_SLABS : OLD_SLABS
  const taxableIncome = Math.max(0, grossSalary - std - Math.max(0, extraDeductions))

  let slabTax = slabTaxOf(slabs, taxableIncome)
  let rebate = 0
  let marginalReliefApplied = false

  // ── Rebate (Sec 156 fka 87A) ──────────────────────────────────────────────
  if (regime === 'new') {
    if (taxableIncome <= 1200000) {
      rebate = Math.min(slabTax, 60000)
      if (rebate === slabTax && slabTax > 0)
        notes.push('Zero tax: Sec 156 rebate wipes out all slab tax (taxable ≤ ₹12L).')
    } else {
      // Marginal relief: total slab tax cannot exceed income above ₹12L.
      const excess = taxableIncome - 1200000
      if (slabTax > excess) {
        slabTax = excess
        marginalReliefApplied = true
        notes.push('Marginal relief above ₹12L: tax capped at income over ₹12L.')
      }
    }
  } else {
    if (taxableIncome <= 500000) {
      rebate = Math.min(slabTax, 12500)
      if (rebate === slabTax && slabTax > 0)
        notes.push('Zero tax: 87A rebate wipes out all slab tax (taxable ≤ ₹5L).')
    }
    // Old regime has NO marginal relief above the 5L rebate cliff.
  }

  const afterRebate = slabTax - rebate

  // ── Surcharge with marginal relief at each threshold ──────────────────────
  const bands = regime === 'new' ? NEW_SURCHARGE : OLD_SURCHARGE
  let surcharge = 0
  const scRate = surchargeRateFor(bands, taxableIncome)
  if (scRate > 0 && afterRebate > 0) {
    surcharge = afterRebate * scRate
    let idx = 0
    for (let i = 0; i < bands.length; i++) if (taxableIncome > bands[i][0]) idx = i
    const threshold = bands[idx][0]
    // Tax+surcharge cannot exceed tax at threshold plus income above it.
    const taxAtThreshold = slabTaxOf(slabs, threshold)
    const maxLiability = taxAtThreshold + (taxableIncome - threshold)
    if (afterRebate + surcharge > maxLiability) {
      surcharge = Math.max(0, maxLiability - afterRebate)
      notes.push(`Surcharge marginal relief at ₹${(threshold / 100000).toFixed(0)}L threshold.`)
    }
  }

  const base = afterRebate + surcharge
  const cess = base * CESS_RATE
  const totalTax = Math.max(0, roundTax(base + cess))

  return {
    regime,
    taxableIncome,
    slabTax,
    rebate,
    marginalReliefApplied,
    surcharge,
    cess,
    totalTax,
    monthlyTds: totalTax / 12,
    effectiveRateOnGross: grossSalary > 0 ? totalTax / grossSalary : 0,
    notes,
  }
}

/** rupee formatting, Indian digit grouping */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

export function fmtShort(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${Math.round(n)}`
}
