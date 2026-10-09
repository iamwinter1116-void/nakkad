# Nakkad — CTC ke andar ka nakkad 💸

**Decode any Indian job offer into real monthly in-hand pay. Compare offers. Catch fake-offer scams. 100% offline. ₹0 to build, ₹0 to run.**

> *Nakkad* (Hindi): hard cash. Because "₹12 LPA" means nothing until you know what hits your bank account every month.

## Why this exists

Every Indian fresher learns the CTC shock on their first payslip: the ₹12L offer is ₹88k/month in-hand, not ₹1L. Meanwhile, placement season is drowning in fake offer letters — UP Police busted a racket that duped **250+ job-seekers** with forged Infosys-class letters demanding "registration fees" (2026); the April 2025 Kanpur operation milked **1.2 lakh victims**. Nobody has combined *accurate* take-home math with *scam detection* in one free offline tool.

## What it does

| Tab | What you get |
|---|---|
| **Decode** | CTC → monthly in-hand, full breakdown (basic/HRA/special/PF/PT/tax), best-regime auto-optimiser, 5-year projection |
| **Compare** | Two offers side-by-side, monthly + annual delta, retirals weighting |
| **Scam Shield** | Paste any offer text (WhatsApp/email/letter) → 14-rule fraud scan: advance-fee demands, OTP asks, Telegram task scams, lookalike emails, fake govt recruitment |

**Privacy:** everything runs on-device. No analytics, no network calls after load, no account. The offer text you paste into Scam Shield never leaves your phone.

## The engines (all unit-tested, 33 tests)

- **Tax engine — FY 2026-27** (AY 2027-28): new-regime slabs (0/5/10/15/20/25/30 at ₹4/8/12/16/20/24L), ₹75k standard deduction, Sec 156 (fka 87A) rebate with the ₹12L cliff + **marginal relief** (₹12.10L taxable → ₹10,400, not ₹61,500), surcharge 10/15/25% with per-threshold marginal relief, 4% cess, Sec 288B ₹10 rounding. Old regime with 80C/80D/80CCD(1B)/HRA/24(b) for comparison.
- **CTC engine:** EPF both modes (full basic / ₹15k statutory cap), EPS split (8.33% capped ₹1,249.50), gratuity 4.81%, ESI (0.75%/3.25% under ₹21k gross), state professional tax — including the **Gujarat flat ₹200 above ₹12k/mo** rule (most calculators online still show the pre-2022 slabs; verified against the Gujarat PT Act amendment).
- **Scam engine:** 14 weighted rules distilled from I4C/state cyber-police documented patterns + NCS guidance. Pure regex/heuristics, zero network.

## Run it

```bash
npm install
npm test        # 33 tests
npm run dev     # local
npm run build   # production PWA
```

**Live:** https://iamwinter1116-void.github.io/nakkad/

## Install as an app (₹0, both platforms)

- **Android:** Chrome → open the live URL → ⋮ → *Add to Home screen*. Installs as a real app (service worker + manifest).
- **iOS:** Safari → Share → *Add to Home Screen*. Same. No App Store, no $99 developer account.

An installable Android APK (TWA, signed in CI) is built by GitHub Actions on every release — grab it from the repo's Actions artifacts.

## Monetization (all ₹0-cost rails)

1. UPI tip jar (in-app QR)
2. "Offer Season Playbook" — premium PDF (negotiation scripts, red-flag letter gallery) via Gumroad (free to list)
3. Campus ambassador programme → placement cells use the Scam Shield in their offer-verification workshops

## Disclaimer

Estimates for salaried individuals under FY 2026-27 rules; your offer letter and payslip govern. Scam Shield is a risk lens, not legal advice — verify every offer via the employer's official channels; report fraud to **1930** / **cybercrime.gov.in**.

## License

MIT
