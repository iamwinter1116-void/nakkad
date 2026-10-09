import { describe, it, expect } from 'vitest'
import { decodeCtc, DEFAULT_CTC_INPUT, projectCtc, compareOffers, professionalTax, hraExemptionOf } from '../ctc'

describe('professional tax (verified state rules)', () => {
  it('Gujarat: nil ≤ ₹12k/mo, flat ₹200 above (post-May-2022 rule)', () => {
    expect(professionalTax('GJ', 11999, false)).toBe(0)
    expect(professionalTax('GJ', 12000, false)).toBe(0)   // "above ₹12,000"
    expect(professionalTax('GJ', 12001, false)).toBe(200)
    expect(professionalGross('GJ', 40000)).toBe(2400)
  })
  it('Maharashtra: women exempt up to ₹25k/mo', () => {
    expect(professionalTax('MH', 20000, true)).toBe(0)
    expect(professionalTax('MH', 20000, false)).toBe(208)
  })
  it('Delhi/UP: no PT', () => {
    expect(professionalTax('DL', 100000, false)).toBe(0)
  })
})

function professionalGross(state: 'GJ', m: number) { return professionalTax(state, m, false) * 12 }

describe('HRA exemption u/s 10(13A)', () => {
  it('least of actual HRA, rent−10% basic, 50/40% basic', () => {
    // HRA 240k, rent 300k, basic 600k, metro
    expect(hraExemptionOf(240000, 300000, 600000, true)).toBe(240000)
    // rent low: 300000 - 60000 = 240k? no wait 10% of 600k = 60k → b=240k → min(240k,240k,300k)=240k
    expect(hraExemptionOf(240000, 200000, 600000, true)).toBe(140000) // b = 140k
    // non-metro caps at 40%
    expect(hraExemptionOf(300000, 400000, 600000, false)).toBe(240000) // c = 240k
  })
})

describe('decodeCtc — full pipeline', () => {
  const base = DEFAULT_CTC_INPUT(1200000)

  it('typical ₹12L CTC → ~79-84% take-home, both regimes computed', () => {
    const b = decodeCtc(base)
    expect(b.annual.valid).toBe(true)
    expect(b.tax.newRegime.totalTax).toBe(0) // 12L CTC < 12.75L salary → zero tax
    expect(b.monthly.inHandFixed).toBeGreaterThan(70000)
    expect(b.monthly.inHandFixed).toBeLessThan(90000)
    // employer PF 12% of basic(40% = 480k) = 57.6k
    expect(b.annual.employerPf).toBe(57600)
    expect(b.annual.gratuity).toBeCloseTo(0.0481 * 480000, 0)
  })

  it('₹12L CTC: employee PF 12% of full basic deducted from in-hand', () => {
    const b = decodeCtc(base)
    expect(b.annual.employeePf).toBe(57600)
  })

  it('pfMode=statutory caps PF wage at ₹1.8L/yr', () => bothPF(base))

  function bothPF(input: ReturnType<typeof DEFAULT_CTC_INPUT>) {
    const full = decodeCtc(input)
    const stat = decodeCtc({ ...input, pfMode: 'statutory' })
    expect(stat.annual.employeePf).toBe(21600) // 12% of 180k
    expect(stat.monthly.inHandFixed).toBeGreaterThan(full.monthly.inHandFixed)
  }

  it('ESI applies below ₹21k/mo gross', () => {
    // ₹2.4L CTC → gross ~2.4L → 20k/mo ≤ 21k
    const b = decodeCtc(DEFAULT_CTC_INPUT(240000))
    expect(b.annual.esiApplicable).toBe(true)
    expect(b.annual.employeeEsi).toBeCloseTo(0.0075 * b.annual.gross, 0)
  })

  it('old regime beats new when deductions are large', () => {
    const input = { ...DEFAULT_CTC_INPUT(1800000), old: { deductions80C: 150000, deductions80D: 25000, nps80CCD1B: 50000, hraExemption: 190000, homeLoanInterest: 200000 } }
    const b = decodeCtc(input)
    expect(b.tax.bestRegime).toBe('old')
    expect(b.tax.oldRegime.totalTax).toBeLessThan(b.tax.newRegime.totalTax)
  })

  it('regime optimiser picks ₹0 tax when eligible', () => {
    const b = decodeCtc(DEFAULT_CTC_INPUT(1000000))
    expect(b.tax.best.totalTax).toBe(0)
    expect(b.tax.bestRegime).toBe('new')
  })
})

describe('projection + comparison', () => {
  it('5-year projection with 10% hike grows monotonically', () => {
    const p = projectCtc(DEFAULT_CTC_INPUT(1200000), 5, 10)
    expect(p).toHaveLength(5)
    expect(p[4].ctc).toBeCloseTo(1200000 * 1.1 ** 4, 0)
    for (let i = 1; i < 0 + 5; i++) {
      expect(p[i].ctc).toBeGreaterThan(p[i - 1].ctc)
    }
  })
})

describe('compareOffers', () => {
  it('picks the better monthly in-hand', () => {
    const a = decodeCtc(DEFAULT_CTC_INPUT(1200000))
    const b = decodeCtc({ ...DEFAULT_CTC_INPUT(1400000), basicPct: 50 })
    const c = compareOffers(a, b)
    expect(c.winner).toBe('B')
    expect(c.monthlyDelta).toBeLessThan(0)
  })
})
