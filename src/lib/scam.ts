/**
 * NAKKAD SCAM SHIELD — advance-fee & fake offer detection.
 *
 * Basis: I4C / state cyber-police documented patterns (UP Police fake
 * placement rackets Apr 2025, Lucknow raid 2026), NCS guidance (employers
 * never charge candidates), advance-fee job fraud typology (registration /
 * training / verification / "background check" / uniform / equipment fees),
 * WhatsApp-Telegram task scams, lookalike email domains.
 *
 * Heuristic, ON-DEVICE text analysis. No network, no telemetry — the user's
 * offer text never leaves the phone. This is a RISK LENS, not legal advice.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Rule {
  id: string
  severity: Severity
  title: string
  why: string
  weight: number
  test: (t: string) => boolean
}

const has = (t: string, re: RegExp) => re.test(t)

// Free-email providers — recruiters never hire from gmail.
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|rediffmail|protonmail|icloud|yandex|live|gmx)\./i

// Fee words with amounts nearby.
const FEE_WORDS =
  /(registration|processing|onboarding|verification|background\s*check|training|uniform|equipment|security\s*deposit|document|courier|gate\s*pass|medical|bond\s*fee|refundable)\s*(fee|charges?|amount|deposit|payment)/i

const PAY_MENTION = /\b(upi|gpay|phonepe|paytm|qr\s*code|neft|imps|crypto|usdt|bitcoin|wallet)\b/i
const MONEY = /₹\s?[\d,]+|\brs\.?\s?[\d,]+|\binr\s?[\d,]+/i
const URGENT = /(limited\s+(seats|slots)|expires?\s+(today|in\s*\d+|within)|last\s+\d+\s+(seats|hours|days)|offer\s+valid\s+(today|till|until)|hurry|immediately\s+confirm|confirm\s+now|first\s+come)/i
const WHATSAPP_ONLY = /(whatsapp\s+us|contact\s+(us\s+)?on\s+whatsapp|dm\s+me\s+on\s+whatsapp|ping\s+me\s+on\s+whatsapp|join.*telegram|telegram\s+(group|channel|link|id))/i
const OTP = /\b(otp|one[-\s]?time\s+(password|code)|pin\s+verification|share\s+your\s+otp)\b/i
const KYC_DOCS_EARLY = /(aadhaar|pan\s+card?|bank\s+(account|details|passbook)|kyc)\b.*(before|prior\s+to|for)\s+(joining|verification|offer|onboarding)/i
const NO_INTERVIEW = /(no\s+interview|required|walk[-\s]?in\s+selection|direct\s+selection|selected\s+without|no\s+experience\s+required)/i
const EASY_TASK = /(like\s+(youtube\s+)?videos?|rate\s+(products?|apps?|businesses?)|follow\s+(accounts?|profiles?|pages?)|google\s+reviews?|subscribe\s+and\s+earn|watch\s+ads?\s+and\s+earn|task[-\s]based|premium\s+tasks?)/i
const LUDICROUS_DAY = /(₹|rs\.?|inr)\s?([\d,]{4,})\s*(\/|-|per\s*)\s*(day|daily)/i
const LUDICROUS_RATE = /(₹|rs\.?|inr)\s?([\d,]{3,})\s*(\/|-|per\s*)\s*(hour|hr)/i
const GOV_LOOKALIKE = /\b(isro|drdo|railway|indian\s+army|bsf|crpf|npci|sebi|rbi|sbi\s+recruitment|government\s+of\s+india)\b/i
const PERSONAL_NUMBER_HR = /hr\s+(from|team)|recruiter|talent\s+acquisition/i

function dayPay(t: string): number | null {
  const m = t.match(LUDICROUS_DAY)
  if (!m) return null
  const n = parseInt(m[2].replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}
function hourPay(t: string): number | null {
  const m = t.match(LUDICROUS_RATE)
  if (!m) return null
  const n = parseInt(m[2].replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}

export const RULES: Rule[] = [
  {
    id: 'fee-request', severity: 'critical', weight: 30,
    title: 'Money demanded from you',
    why: 'Legitimate employers NEVER charge candidates — registration, "background check", training, uniform or equipment fees are the #1 advance-fee fraud pattern (I4C).',
    test: (t) => has(t, FEE_WORDS),
  },
  {
    id: 'fee-amount', severity: 'critical', weight: 25,
    title: 'A specific amount to pay',
    why: 'Fee demands come with a number and a UPI/QR/wallet target. Payment to a person or "agent" = advance-fee fraud.',
    test: (t) => has(t, PAY_MENTION) && has(t, MONEY) && has(t, FEE_WORDS),
  },
  {
    id: 'otp-request', severity: 'critical', weight: 50,
    title: 'Asks for OTP / PIN',
    why: 'No employer ever needs your OTP. This is direct financial fraud — money leaves your account.',
    test: (t) => has(t, OTP),
  },
  {
    id: 'whatsapp-telegram', severity: 'high', weight: 18,
    title: 'Hiring via WhatsApp/Telegram only',
    why: 'Real recruiters use official email/LinkedIn. WhatsApp-first hiring and Telegram "task groups" are the documented task-scam channel.',
    test: (t) => has(t, WHATSAPP_ONLY),
  },
  {
    id: 'urgency', severity: 'high', weight: 12,
    title: 'Manufactured urgency',
    why: '"Offer expires today / limited seats" pressure is engineered to stop you verifying. Real offers give days, not hours.',
    test: (t) => has(t, URGENT),
  },
  {
    id: 'kyc-early', severity: 'high', weight: 15,
    title: 'Aadhaar/PAN/bank details before official offer',
    why: 'Collecting KYC docs over chat before a signed offer is identity-theft setup.',
    test: (t) => has(t, KYC_DOCS_EARLY),
  },
  {
    id: 'no-interview', severity: 'high', weight: 14,
    title: 'Selected without a real interview',
    why: 'Instant selection with no screening = fake process. Real hiring has interviews and documentation.',
    test: (t) => has(t, NO_INTERVIEW),
  },
  {
    id: 'task-scam', severity: 'critical', weight: 26,
    title: 'Paid-per-task work (likes, reviews, follows)',
    why: 'Task-based "jobs" pay small real amounts first, then demand deposits to "unlock premium tasks". Documented nationwide scam.',
    test: (t) => has(t, EASY_TASK),
  },
  {
    id: 'ludicrous-pay', severity: 'high', weight: 16,
    title: 'Unrealistic pay for the work',
    why: '₹2,000+/day for liking videos or ₹800+/hour data entry is bait pay.',
    test: (t) => { const d = dayPay(t); const h = hourPay(t); return (d !== null && d >= 1500) || (h !== null && h >= 400) },
  },
  {
    id: 'gov-impersonation', severity: 'high', weight: 18,
    title: 'Government body impersonation',
    why: 'ISRO/DRDO/Railways/Army recruitment scams collect "verification fees". Genuine govt recruitment is gazette-notified and never via WhatsApp.',
    test: (t) => has(t, GOV_LOOKALIKE) && has(t, FEE_WORDS),
  },
  {
    id: 'free-mail', severity: 'high', weight: 15,
    title: 'Recruiter on free email (gmail/yahoo/…)',
    why: 'Corporate HR writes from the company domain. hr.tcs123@gmail.com is a lookalike scam address.',
    test: (t) => has(t, FREE_MAIL),
  },
  {
    id: 'unverified-personal-hr', severity: 'medium', weight: 8,
    title: 'Self-declared HR from personal contact',
    why: 'Verify the recruiter via the company\u2019s official careers page independently — never via the number in the message.',
    test: (t) => has(t, PERSONAL_NUMBER_HR) && !has(t, /@[a-z0-9.-]+\.(com|in|org|co|net|edu|gov)/i),
  },
  {
    id: 'bonus-incentive-bait', severity: 'medium', weight: 6,
    title: 'High joining bonus / incentive bait',
    why: 'Very large "joining bonus" promises are used to justify later "processing deductions".',
    test: (t) => /(joining\s+bonus|sign[-\s]?on\s+bonus)\s+of\s*(₹|rs\.?|inr)?\s*[\d,]{5,}/i.test(t),
  },
]

export interface ScamVerdict {
  score: number            // 0–100 risk
  band: 'safe' | 'caution' | 'suspicious' | 'scam'
  hits: { rule: Rule; matched: boolean }[]
  summary: string
  actions: string[]
}

const BANDS: [number, ScamVerdict['band']][] = [
  [45, 'scam'], [25, 'suspicious'], [8, 'caution'], [0, 'safe'],
]

export function scanOfferText(text: string): ScamVerdict {
  const t = (text || '').toLowerCase()
  const hits = RULES.map((rule) => ({ rule, matched: rule.test(t) }))
  const matched = hits.filter((h) => h.matched)
  const raw = matched.reduce((s, h) => s + h.rule.weight, 0)
  const score = Math.min(100, raw)

  const band = BANDS.find(([floor]) => score >= floor)![1]

  const criticals = matched.filter((m) => m.rule.severity === 'critical')
  let summary: string
  if (band === 'scam')
    summary = `High fraud risk (${score}/100). ${criticals.length ? `Critical: ${criticals.map((c) => c.rule.title.toLowerCase()).join(', ')}. ` : ''}Do NOT pay, do NOT share documents, report to 1930 / cybercrime.gov.in.`
  else if (band === 'suspicious')
    summary = `Suspicious (${score}/100): ${matched.length} scam marker${matched.length > 1 ? 's' : ''} found. Verify the employer independently before proceeding.`
  else if (band === 'caution')
    summary = `Some risk markers (${score}/100). No hard fraud signal — still verify via the company\u2019s official channels.`
  else
    summary = `No known scam markers in this text (${score}/100). Still standard practice: verify the recruiter and offer on the company\u2019s official site.`

  const actions = [
    'Verify the offer on the company\u2019s official careers/contact page — never via links or numbers in the message.',
    'Legitimate employers never ask for money at any stage of hiring. If asked, it is a scam — full stop.',
    'Never share Aadhaar, PAN, bank details or OTP before a signed offer letter from a verified domain.',
    'Victim of fraud already? Call 1930 immediately and file at cybercrime.gov.in (keep the letter + payment trail).',
  ]

  return { score, band, hits, summary, actions }
}
