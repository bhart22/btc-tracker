// Generates the Tip Jar QR codes as static PNGs.
//
// These used to be loaded at runtime from api.qrserver.com, which was (a) blocked by the
// app's own img-src CSP so they never rendered in production, (b) a third party that would
// have seen every tip address and could substitute its own QR, and (c) broken offline.
// The addresses are hardcoded constants that never change, so generating once is strictly
// better than fetching every time.
//
//   npm install && npm run qr
//
// If you change a tip address in app.html, re-run this and commit the new PNGs.
import QRCode from 'qrcode';
import { stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGES = join(dirname(fileURLToPath(import.meta.url)), '..', 'images');

// Keep in sync with the TIP_TARGETS list in app.html
const TARGETS = [
  { out: 'tip-lightning.png', uri: 'lightning:thekidhitman@strike.me' },
  { out: 'tip-onchain.png',   uri: 'bitcoin:bc1qm0gqys4dkusan8y96c4j4gf05uep648eykq6a43mcwndg56dwvnsmavm5u' },
];

for (const { out, uri } of TARGETS) {
  const path = join(IMAGES, out);
  await QRCode.toFile(path, uri, {
    type: 'png',
    width: 240,           // 120 px rendered at 2x
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000ff', light: '#ffffffff' }, // fixed colours: QR contrast must not follow the theme
  });
  const { size } = await stat(path);
  console.log(`${out.padEnd(22)} ${(size / 1024).toFixed(1).padStart(6)} KB   ${uri}`);
}
