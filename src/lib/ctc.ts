/**
 * NAKKAD CTC ENGINE — decodes an annual CTC into monthly in-hand pay.
 *
 * VERIFIED RULES (Oct 2026):
 *  - Employee EPF: 12% of basic+DA (statutory wage ceiling ₹15,000/mo; many
 *    IT employers instead contribute on FULL basic — both modes supported).
 *  - Employer EPF: 12% (of which EPS 8.33% capped at ₹15,000 wage = ₹1,249.50,
 *    rest to EPF) + EDLI 0.5% + admin 0.5% (admin+EDLI usually NOT in CTC).
 *  - ESI: if gross wages ≤ ₹21,000/mo → employee 0.75% + employer 3.25%.
 *  - Gratuity provision: 4.81% of basic (Payment of Gratuity Act).
 *  - Professional tax: state slabs (verified; Gujarat flat ₹200/mo above
 *    ₹12,000/mo since 24 May 2022 — old 4-slab tables online are dead).
 *  - Employer NPS (80CCD(2), ≤10% of basic): deductible in BOTH regimes.
 *
 * SECURITY: pure functions. No PII. Nothing leaves the device.
 */

import { computeTax, type Regime, type TaxResult } from './tax'

// ─── Professional tax (₹/month; gross monthly salary basis) ──────────────────

export type PTState =
  | 'GJ' | 'MH' | 'KA' | 'WB' | 'TN' | 'TS' | 'AP' | 'MP' | 'KL' | 'PB'
  | 'DL' | 'HR' | 'UP' | 'RJ' | 'NONE'

const PT_TABLES: Record<Exclude<PTState, 'MH'>, (monthlyGross: number) => number> = {
  // Gujarat: nil ≤ 12,000; flat ₹200 above (₹2,400/yr — no Feb top-up).
  GJ: (m) => (m > 12000 ? 200 : 0),
  // Karnataka: nil ≤ ₹24,999; ₹200 (₹300 in Feb → annual ₹2,500; modelled flat 208).
  KA: (m) => (m > 24999 ? 208 : 0),
  WB: (m) => (m > 10000 ? 200 : 0),
  TN: (m) => (m > 3500 ? 208 : 0),          // ₹1,250/half-yr above ₹21,000/half-yr
  TS: (m) => (m > 15000 ? 200 : 0),
  AP: (m) => (m > 15000 ? 200 : 0),
  MP: (m) => (m > 18750 ? 208 : 0),
  KL: () => 208,           // ₹1,250/half-yr
  PB: () => 0,             // dev-tax via employer, modelled nil
  DL: () => 0, HR: () => 0, UP: () => 0, RJ: () => 0, NONE: () => 0,
}

/** Maharashtra: nil ≤ 7,500 (₹25,000 for women); ₹200 (₹300 Feb) above. */
export function professionalTax(state: PTState, monthlyGross: number, female: boolean): number {
  if (state === 'MH') {
    const threshold = female ? 25000 : 7500
    return monthlyGross > threshold ? 208 : 0 // 200×11 + 300 = 2,500/yr → 208/mo avg
  }
  return PT_TABLES[state as Exclude<PTState, 'MH'>](monthlyGross)
}

// ─── CTC inputs ──────────────────────────────────────────────────────────────

export interface CtcInput {
  annualCtc: number
  basicPct: number          // basic as % of CTC (default 40)
  hraPctOfBasic: number     // HRA as % of basic (40 non-metro / 50 metro typical)
  variablePct: number       // variable/bonus as % of CTC (default 0)
  pfMode: 'full' | 'statutory'  // EPF on full basic vs ₹15k wage ceiling
  gratuityInCtc: boolean    // employer gratuity provision inside CTC
  pfInCtc: boolean          // employer EPF inside CTC (usually true)
  employerNpsPctOfBasic: number // 0 unless corporate NPS plan
  state: PTState
  female: boolean
  metro: boolean            // metro → 50% HRA exemption basis (old regime)
  // old-regime deduction inputs (caller clamps caps)
  old: {
    deductions80C: number   // ≤ 150000
    deductions80D: number
    nps80CCD1B: number      // ≤ 50000
    hraExemption: number    // computed u/s 10(13A) — see hraExemptionOf()
    homeLoanInterest: number // ≤ 200000 u/s 24(b)
  }
}

export const DEFAULT_CTC_INPUT = (annualCtc: number): CtcInput => ({
  annualCtc,
  basicPct: 40,
  hraPctOfBasic: 40,
  variablePct: 0,
  pfMode: 'full',
  gratuityInCtc: true,
  pfInCtc: true,
  employerNpsPctOfBasic: 0,
  state: 'GJ',
  female: false,
  metro: true,
  old: { deductions80C: 0, deductions80D: 0, nps80CCD1B: 0, hraExemption: 0, homeLoanInterest: 0 },
})

/**
 * HRA exemption u/s 10(13A) — LEAST of:
 *   (a) actual HRA received,
 *   (b) rent paid − 10% of salary (basic+DA),
 *   (c) 50% of basic (metro) / 40% (non-metro).
 * Old regime only.
 */
export function hraExemptionOf(
  hraReceived: number, rentPaid: number, basicPlusDa: number, metro: boolean,
): number {
  const a = hraReceived
  const b = Math.max(0, rentPaid - 0.1 * basicPlusDa)
  const c = (metro ? 0.5 : 0.4) * basicPlusDa
  return Math.max(0, Math.min(a, b, c))
}

export interface CtcBreakdown {
  annual: {
    ctc: number
    basic: number
    hra: number
    special: number
    variable: number
    gross: number                 // basic + hra + special (fixed cash)
    employerPf: number
    employerEsi: number
    gratuity: number
    employerNps: number
    employeePf: number
    employeeEsi: number
    professionalTax: number
    esiApplicable: boolean
    valid: boolean
  }
  monthly: {
    gross: number
    inHandBest: number
    inHandFixed: number           // in-hand excluding variable pay
    tds: number                   // best-regime monthly TDS
  }
  tax: {
    best: TaxResult
    newRegime: TaxResult
    oldRegime: TaxResult
    bestRegime: Regime
    regimeSaving: number          // |new − old| annual
  }
  warnings: string[]
}

/**
 * Decode CTC → full breakdown + in-hand. Computes BOTH tax regimes and
 * returns the better one (regime auto-optimisation).
 */
export function decodeCtc(input: CtcInput): CtcBreakdown {
  const warnings: string[] = []
  const ctc = Math.max(0, input.annualCtc)

  const basic = (input.basicPct / 100) * ctc
  const hra = (input.hraPctOfBasic / 100) * basic
  const variable = (input.variablePct / 100) * ctc

  // EPF wage: full basic vs statutory ceiling (₹15,000/mo = ₹1,80,000/yr)
  const pfWage = input.pfMode === 'full' ? basic : Math.min(basic, 180000)
  const employerPf = input.pfInCtc ? 0.12 * pfWage : 0
  const employeePf = 0.12 * pfWage
  const gratuity = input.gratuityInCtc ? 0.0481 * basic : 0
  const employerNps = (input.employerNpsPctOfBasic / 100) * basic

  // Fixed gross = what's left of CTC after retirals + variable.
  const special = ctc - variable - employerPf - gratuity - employerNps - basic - hra
  if (special < 0) {
    warnings.push(
      'Structure invalid: basic% + retirals + variable exceed CTC. Lower basic% or variable%.',
    )
  }
  const gross = Math.max(0, basic + hra + special)

  // ESI: gross wages ≤ ₹21,000/mo
  const monthlyGross = gross / 12
  const esiApplicable = monthlyGross <= 21000 && monthlyGross > 0
  const employeeEsi = esiApplicable ? 0.0075 * gross : 0
  const employerEsi = esiApplicable ? 0.0325 * gross : 0

  const ptAnnual = professionalTax(input.state, monthlyGross, input.female) * 12

  // Taxable salary: gross − employer NPS (80CCD(2)) − PT (16(iii)).
  // Old regime extra: 80C (≤1.5L) + 80D + 80CCD1B (≤50k) + HRA exemption + 24(b) (≤2L).
  const commonDeductions = employerNps + ptAnnual
  const oldExtra =
    Math.min(input.old.deductions80C, 150000) +
    Math.max(0, input.old.deductions80D) +
    Math.min(input.old.nps80CCD1B, 50000) +
    Math.min(input.old.hraExemption, hra) +
    Math.min(input.old.homeLoanInterest, 200000)

  const newRegime = computeTax(gross, 'new', commonDeductions)
  const oldRegime = computeTax(gross, 'old', commonDeductions + oldExtra)

  const bestRegime: Regime = newRegime.totalTax <= oldRegime.totalTax ? 'new' : 'old'
  const best = bestRegime === 'new' ? newRegime : oldRegime

  const annualInHandFixed = gross - employeePf - employeeEsi - ptAnnual - best.totalTax
  const monthlyInHandFixed = annualInHandFixed / 12
  // Variable pay assumed fully paid out, taxed at same effective rate.
  const variableNet = variable * (1 - best.effectiveRateOnGross)

  if (esiApplicable) warnings.push('ESI applies (gross ≤ ₹21,000/mo): you get ESIC medical cover.')
  if (input.basicPct < 35 || input.basicPct > 50)
    warnings.push('Basic% outside the typical 35–50% band — check the offer letter.')
  if (input.variablePct > 20)
    warnings.push('Variable pay > 20% of CTC: monthly in-hand will swing hard on appraisal.')

  return {
    annual: {
      ctc, basic, hra, special: Math.max(0, special), variable, gross,
      employerPf, employerEsi, gratuity, employerNps,
      employeePf, employeeEsi, professionalTax: ptAnnual,
      esiApplicable, valid: special >= 0,
    },
    monthly: {
      gross: monthlyGross,
      inHandBest: monthlyInHandFixed + variableNet / 12,
      inHandFixed: monthlyInHandFixed,
      tds: best.monthlyTds,
    },
    tax: {
      best, newRegime, oldRegime,
      bestRegime,
      regimeSaving: Math.abs(newRegime.totalTax - oldRegime.totalTax),
    },
    warnings,
  }
}

/** N-year projection with an annual CTC hike. */
export function projectCtc(input: CtcInput, years: number, annualHikePct: number) {
  const out: { year: number; ctc: number; monthlyInHand: number; tax: number }[] = []
  let ctc = input.annualCtc
  for (let y = 1; y <= years; y++) {
    if (y > 1) ctc = ctc * (1 + annualHikePct / 100)
    const b = decodeCtc({ ...input, annualCtc: ctc })
    out.push({
      year: y,
      ctc,
      monthlyInHand: b.monthly.inHandBest,
      tax: b.tax.best.totalTax,
    })
  }
  return out
}

/** Two-offer comparison. Positive delta → offer A better monthly. */
export function compareOffers(a: CtcBreakdown, b: CtcBreakdown) {
  const delta = a.monthly.inHandBest - b.monthly.inHandBest
  const winner: 'A' | 'B' | 'tie' = delta > 1 ? 'A' : delta < -1 ? 'B' : 'tie'
  // Sanity signals: retirals weight & variable risk.
  const retiralsA = a.annual.employerPf + a.annual.gratuity + a.annual.employerNps
  const retiralsB = b.annual.employerPf + b.annual.gratuity + b.annual.employerNps
  return {
    monthlyDelta: delta,
    annualDelta: delta * 12,
    winner,
    retiralsDelta: retiralsA - retiralsB,
  }
}
