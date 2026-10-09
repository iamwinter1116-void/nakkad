/**
 * UPI QR generator — battle-tested `qrcode` lib (MIT), scannable by UPI apps.
 * Usage: node scripts/make-qr.mjs [upiId] [name]
 */
import QRCode from 'qrcode'
import { resolve } from 'node:path'

const UPI_ID = process.argv[2] || 'nakkad-app@upi'
const NAME = process.argv[3] || 'Nakkad'
const payload = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(NAME)}&cu=INR`
console.log('UPI deep link:', payload)

await QRCode.toFile(resolve('public/qr.png'), payload, {
  errorCorrectionLevel: 'M',
  margin: 4,
  scale: 8,
  color: { dark: '#052e1c', light: '#ffffff' },
})
console.log('wrote public/qr.png')
