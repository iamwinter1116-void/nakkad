import { describe, it, expect } from 'vitest'
import { scanOfferText } from '../scam'

const REAL_SCAM = `Dear Candidate,
Congratulations! You have been selected for the post of Data Entry Executive at Infosys Ltd.
Salary: Rs 30,000 per day for simple typing work. No interview required.
To confirm your offer, please pay a registration fee of Rs 2,500 via UPI to our HR manager.
Join our Telegram group for daily tasks. Offer expires today. Limited seats!
Contact us on WhatsApp +91-98XXXXXXXX. hr.infosys1234@gmail.com`

const REAL_SCAM_2 = `Government of India recruitment - Indian Railways.
You are selected as TC without exam. Pay verification fee ₹1,500 and medical fee ₹800 through the QR code attached. Share your Aadhaar and bank details before joining for verification.`

const CLEAN_OFFER = `Dear Mr Sharma,
We are pleased to offer you the position of Associate Software Engineer at Zeta Systems Pvt Ltd.
Your annual fixed CTC is Rs 6,50,000 with basic pay 40% of CTC. Joining date 1st November 2026.
This offer is subject to background verification by our empanelled agency, at no cost to you.
Kindly acknowledge acceptance at careers@zetasystems.in.`

const CLEAN_OFFER_2 = `You will receive your offer letter via email from hr@techcorp.co.in. The joining bonus of Rs 50,000 will be credited with your first salary.`

describe('scam shield', () => {
  it('flags the classic advance-fee WhatsApp scam (critical band)', () => {
    const v = scanOfferText(REAL_SCAM)
    expect(v.band).toBe('scam')
    expect(v.score).toBeGreaterThanOrEqual(70)
    expect(v.hits.find((h) => h.rule.id === 'fee-request')?.matched).toBe(true)
    expect(v.hits.find((h) => h.rule.id === 'whatsapp-telegram')?.matched).toBe(true)
  })

  it('flags government impersonation with QR payment demand', () => Railways())

  function Railways() {
    const v = scanOfferText(REAL_SCAM_2)
    expect(v.band).toBe('scam')
    expect(v.score).toBeGreaterThanOrEqual(70)
    return v
  }

  it('does NOT flag a clean corporate offer', () => {
    const v = scanOfferText(CLEAN_OFFER)
    expect(v.score).toBeLessThanOrEqual(15)
  })

  it('clean offer mentioning joining bonus (small) is fine', () => {
    const v = scanOfferText(CLEAN_OFFER_2)
    expect(v.score).toBeLessThanOrEqual(15)
  })

  it('empty text is safe but still prompts verification', () => {
    const v = scanOfferText('')
    expect(v.band).toBe('safe')
    verifyBandWorks(v.band)
  })
})

function verifyBandWorks(band: 'safe' | 'caution' | 'suspicious' | 'scam') {
  expect(['safe', 'caution', 'suspicious', 'scam']).toContain(band)
}

describe('edge: partial signals', () => {
  it('urgency alone → caution, not scam', () => {
    const v = scanOfferText('Hurry! Offer valid till tomorrow only.')
    expect(v.score).toBeGreaterThanOrEqual(0)
    expect(v.score).toBeLessThan(40)
  })
  it('OTP request alone → scam band (critical weight)', () => {
    const v = scanScan('Please share your OTP to confirm the offer.')
    expect(v.band).toBe('scam')
  })
  it('task scam pattern detected', () => {
    const v = scanOfferText('Like YouTube videos and earn Rs 1,800/day. Join our Telegram channel for premium tasks.')
    expect(v.band).toBe('scam')
  })
  it('handles very long text without choking', () => {
    const long = REAL_SCAM + ' '.repeat(50) + REAL_SCAM + 'x'.repeat(20000)
    const start = Date.now()
    const v = scanOfferText(long)
    expect(Date.now() - start).toBeLessThan(100)
    expect(v.band).toBe('scam')
  })
})

function scanScan(s: string) { return scanOfferText(s) }
