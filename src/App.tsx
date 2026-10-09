import { useMemo, useState } from 'react'
import { decodeCtc, DEFAULT_CTC_INPUT, projectCtc, compareOffers, type CtcInput, type PTState } from './lib/ctc'
import { scanOfferText } from './lib/scam'
import { fmt } from './lib/tax'

type Tab = 'decode' | 'compare' | 'shield' | 'support'

const STATES: { code: PTState; name: string }[] = [
  { code: 'GJ', name: 'Gujarat' }, { code: 'MH', name: 'Maharashtra' },
  { code: 'KA', name: 'Karnataka' }, { code: 'WB', name: 'West Bengal' },
  { code: 'TN', name: 'Tamil Nadu' }, { code: 'TS', name: 'Telangana' },
  { code: 'AP', name: 'Andhra Pradesh' }, { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'KL', name: 'Kerala' }, { code: 'DL', name: 'Delhi (no PT)' },
  { code: 'UP', name: 'UP (no PT)' }, { code: 'HR', name: 'Haryana (no PT)' },
  { code: 'NONE', name: 'Other / not applicable' },
]

function useOfferState(initial: number) {
  const [ctc, setCtc] = useState(String(initial))
  const [basicPct, setBasicPct] = useState('40')
  const [variablePct, setVariablePct] = useState('0')
  const [pfMode, setPfMode] = useState<'full' | 'statutory'>('full')
  const [state, setState] = useState<PTState>('GJ')

  const input: CtcInput | null = useMemo(() => {
    const c = parseFloat(ctc)
    if (!c || c < 1 || c > 100000) return null // c is in ₹ lakh
    return {
      ...DEFAULT_CTC_INPUT(Math.round(c * 100000)),
      basicPct: clamp(parseFloat(basicPct) || 40, 20, 60),
      variablePct: clamp(parseFloat(variablePct) || 0, 0, 40),
      pfMode,
      state,
    }
  }, [ctc, basicPct, variablePct, pfMode, state])

  return { ctc, setCtc, basicPct, setBasicPct, variablePct, setVariablePct, pfMode, setPfMode, state, setState, input }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function OfferFields({ o, p }: { o: ReturnType<typeof useOfferState>; p: string }) {
  return (
    <>
      <label htmlFor={`ctc-${p}`}>Annual CTC (₹ lakh)</label>
      <input id={`ctc-${p}`} type="number" inputMode="decimal" value={o.ctc} onChange={(e) => o.setCtc(e.target.value)} placeholder="12" min="1" />
      <div className="row">
        <div>
          <label htmlFor={`basic-${p}`}>Basic (% of CTC)</label>
          <input id={`basic-${p}`} type="number" inputMode="numeric" value={o.basicPct} onChange={(e) => o.setBasicPct(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`var-${p}`}>Variable (% of CTC)</label>
          <input id={`var-${p}`} type="number" inputMode="numeric" value={o.variablePct} onChange={(e) => o.setVariablePct(e.target.value)} />
        </div>
      </div>
      <label htmlFor={`pf-${p}`}>EPF basis</label>
      <select id={`pf-${p}`} value={o.pfMode} onChange={(e) => o.setPfMode(e.target.value as 'full' | 'statutory')}>
        <option value="full">Full basic (common in IT)</option>
        <option value="statutory">Statutory cap ₹15,000/mo</option>
      </select>
      <label htmlFor={`state-${p}`}>Work state (professional tax)</label>
      <select id={`state-${p}`} value={o.state} onChange={(e) => o.setState(e.target.value as PTState)}>
        {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
      </select>
    </>
  )
}

function Breakdown({ b }: { b: ReturnType<typeof decodeCtc> }) {
  const m = b.monthly
  return (
    <>
      <div className="card">
        <div className="hero-label">Monthly in-hand (fixed)</div>
        <div className="hero-num">₹{fmt(m.inHandFixed)}</div>
        <div className="hero-sub">
          Gross ₹{fmt(m.gross)}/mo · TDS ₹{fmt(m.tds)}/mo · {b.tax.bestRegime === 'new' ? 'New' : 'Old'} regime wins
          {b.tax.regimeSaving > 0 && <> (saves ₹{fmt(b.tax.regimeSaving)}/yr vs other)</>}
        </div>
      </div>
      <div className="card">
        <table>
          <tbody>
            <tr><td className="k">Basic (annual)</td><td>₹{fmt(b.annual.basic)}</td></tr>
            <tr><td className="k">HRA</td><td>₹{fmt(b.annual.hra)}</td></tr>
            <tr><td className="k">Special allowance</td><td>₹{fmt(b.annual.special)}</td></tr>
            <tr className="total-row"><td>Gross salary</td><td>₹{fmt(b.annual.gross)}</td></tr>
            <tr><td className="k">Employee EPF (12%)</td><td className="neg">− ₹{fmt(b.annual.employeePf)}</td></tr>
            <tr><td className="k">Professional tax</td><td className="neg">− ₹{fmt(b.annual.professionalTax)}</td></tr>
            {b.annual.esiApplicable && <tr><td className="k">ESI (0.75%)</td><td className="neg">− ₹{fmt(b.annual.employeeEsi)}</td></tr>}
            <tr><td className="k">Income tax (best regime)</td><td className="neg">− ₹{fmt(b.tax.best.totalTax)}</td></tr>
            <tr className="total-row"><td>Annual take-home (fixed)</td><td>₹{fmt(m.inHandFixed * 12)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <table>
          <tbody>
            <tr><td className="k">Employer EPF (in your CTC, not in hand)</td><td>₹{fmt(b.annual.employerPf)}</td></tr>
            <tr><td className="k">Gratuity provision</td><td>₹{fmt(b.annual.gratuity)}</td></tr>
            {b.annual.employerEsi > 0 && <tr><td className="k">Employer ESI</td><td>₹{fmt(b.annual.employerEsi)}</td></tr>}
          </tbody>
        </table>
        <p className="note">These look like "your money" in the CTC letter but never reach your bank account monthly.</p>
      </div>
      {b.tax.best.notes.map((n, i) => <div className="warnbox" key={i}>{n}</div>)}
      {b.warnings.map((w, i) => <div className="warnbox" key={i}>{w}</div>)}
    </>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('decode')
  const a = useOfferState(12)
  const b = useOfferState(14)
  const [scamText, setScamText] = useState('')

  const breakdownA = useMemo(() => (a.input ? decodeCtc(a.input) : null), [a.input])
  const breakdownB = useMemo(() => (b.input ? decodeCtc(b.input) : null), [b.input])
  const cmp = useMemo(
    () => (breakdownA && breakdownB ? compareOffers(breakdownA, breakdownB) : null),
    [breakdownA, breakdownB],
  )
  const projection = useMemo(
    () => (a.input ? projectCtc(a.input, 5, 10) : null),
    [a.input],
  )
  const scan = useMemo(() => (scamText.trim() ? scanOfferText(scamText) : null), [scamText])

  return (
    <div className="app">
      <header>
        <div className="logo" aria-hidden="true">₹</div>
        <div>
          <h1>Nakkad</h1>
          <p className="tagline">CTC ke andar ka nakkad · FY 2026-27 · 100% offline</p>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === 'decode'} onClick={() => setTab('decode')}>Decode</button>
        <button className="tab" role="tab" aria-selected={tab === 'compare'} onClick={() => setTab('compare')}>Compare</button>
        <button className="tab" role="tab" aria-selected={tab === 'shield'} onClick={() => setTab('shield')}>Scam Shield</button>
      </div>

      {tab === 'decode' && (
        <>
          <div className="card">
            <OfferFields o={a} p="a" />
          </div>
          {!a.input && <div className="card"><p className="hero-sub">Enter a CTC of at least ₹1 lakh to see the real picture.</p></div>}
          {breakdownA && <Breakdown b={breakdownA} />}
          {projection && (
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>5-year projection (10% annual hike)</h3>
              <table>
                <tbody>
                  {projection.map((p) => (
                    <tr key={p.year}>
                      <td className="k">Year {p.year}</td>
                      <td>₹{fmt(p.ctc)} CTC → ₹{fmt(p.monthlyInHand)}/mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">Years 2–5 apply today's FY 2026-27 slabs — future Budgets will shift them; treat as a trend, not a quote.</p>
            </div>
          )}
        </>
      )}

      {tab === 'compare' && (
        <>
          <div className="compare-grid">
            <div className={`card ${cmp?.winner === 'A' ? 'winner' : ''}`}>
              {cmp?.winner === 'A' && <span className="badge">Winner</span>}
              <strong>Offer A</strong>
              <OfferFields o={a} p="a" />
            </div>
            <div className={`card ${cmp?.winner === 'B' ? 'winner' : ''}`}>
              {cmp?.winner === 'B' && <span className="badge">Winner</span>}
              <strong>Offer B</strong>
              <OfferFields o={b} p="b" />
            </div>
          </div>
          {cmp && breakdownA && breakdownB && (
            <div className="card">
              <table>
                <tbody>
                  <tr><td className="k">A — monthly in-hand</td><td>₹{fmt(breakdownA.monthly.inHandBest)}</td></tr>
                  <tr><td className="k">B — monthly in-hand</td><td>₹{fmt(breakdownB.monthly.inHandBest)}</td></tr>
                  <tr className="total-row">
                    <td>Monthly difference</td>
                    <td className={cmp.monthlyDelta >= 0 ? 'pos' : 'neg'}>
                      {cmp.monthlyDelta >= 0 ? '+' : '−'} ₹{fmt(Math.abs(cmp.monthlyDelta))}
                    </td>
                  </tr>
                  <tr><td className="k">Annual difference</td><td>₹{fmt(Math.abs(cmp.annualDelta))}</td></tr>
                  <tr><td className="k">Retirals difference (A − B)</td><td className={cmp.retiralsDelta >= 0 ? 'pos' : 'neg'}>{cmp.retiralsDelta >= 0 ? '' : '− '}₹{fmt(Math.abs(cmp.retiralsDelta))}</td></tr>
                </tbody>
              </table>
              <p className="note">
                {cmp.winner === 'tie'
                  ? 'Dead heat on monthly cash — weigh the retirals (PF/gratuity) and variable-pay risk instead.'
                  : `Offer ${cmp.winner} puts more nakkad in your pocket every month. Check the retirals row before signing — a higher-CTC offer with a thin PF can still lose long-term.`}
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'shield' && (
        <>
          <div className="card">
            <label htmlFor="scam">Paste the offer message / letter text (WhatsApp, email, anything)</label>
            <textarea
              id="scam"
              value={scamText}
              onChange={(e) => setScamText(e.target.value)}
              placeholder="Dear Candidate, Congratulations! You have been selected…"
            />
            <p className="note">Runs entirely on your device — the text is never uploaded anywhere.</p>
          </div>
          {scan && (
            <>
              <div className={`verdict ${scan.band}`} role="status">
                <span className={`chip ${scan.band}`}>{scan.score}/100 · {scan.band.toUpperCase()}</span>
                <p>{scan.summary}</p>
              </div>
              {scan.hits.filter((h) => h.matched).length > 0 && (
                <div className="card">
                  {scan.hits.filter((h) => h.matched).map(({ rule }) => (
                    <div key={rule.id} className={`flag ${rule.severity === 'critical' ? 'crit' : ''}`}>
                      <div className="t">🚩 {rule.title}</div>
                      <div className="w">{rule.why}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="card">
                <strong style={{ fontSize: '0.9rem' }}>Do this now</strong>
                <ul className="actions">
                  {scan.actions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'support' && (
        <>
          <div className="card">
            <strong style={{ fontSize: '1rem' }}>Keep Nakkad free for every fresher</strong>
            <p className="note" style={{ marginTop: '0.5rem' }}>
              Built at ₹0, runs at ₹0 — no ads, no tracking, no server. Your data never leaves this device.
              If Nakkad saved you from a bad offer (or a fake one), here's how to keep it alive:
            </p>
          </div>
          <div className="card">
            <strong>UPI tip jar</strong>
            <p className="note" style={{ marginTop: '0.5rem' }}>
              Scan with any UPI app. ₹21 funds a month of hosting (it's free, so honestly: funds chai), ₹199 pre-buys the Playbook.
            </p>
            <div style={{ display: 'grid', placeItems: 'center', padding: '1rem 0' }}>
              <img src="qr.png" alt="UPI QR code — scan to tip Nakkad" width="180" height="180"
                   style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
              <code style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>nakkad-app@upi</code>
            </div>
          </div>
          <div className="card">
            <strong>Offer Season Playbook — ₹199</strong>
            <p className="note" style={{ marginTop: '0.5rem' }}>
              Negotiation scripts, 12 annotated fake-offer letters, the bond/variable/relocation clause checklist.
              Updates every Budget. <em>Link goes live with the Gumroad listing.</em>
            </p>
          </div>
          <div className="card">
            <strong>Campus ambassador</strong>
            <p className="note" style={{ marginTop: '0.5rem' }}>
              Run a 20-minute offer-verification workshop with the Scam Shield tab in your college.
              You get the Playbook free + credit for every referral that tips.
            </p>
          </div>
        </>
      )}

      <footer>
        Estimates only — your payslip is the contract. Rates verified for FY 2026-27 ·
        Report fraud: 1930 / cybercrime.gov.in
        <br /><a href="#support" onClick={(e) => { e.preventDefault(); setTab('support') }}>Support Nakkad → keep it free</a>
      </footer>
    </div>
  )
}
