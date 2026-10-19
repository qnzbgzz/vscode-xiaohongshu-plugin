// x-s-common / B1 fingerprint subset ported from Cloxl/xhshow 0.2.0 (MIT).
import { customBase64 } from './encoding';
import { SigningSession } from './session';

// ARC4 is unavailable in default OpenSSL 3 providers; this small byte implementation
// preserves the upstream protocol without enabling a legacy provider in VS Code.
function arc4(data: Buffer, key: Buffer): Buffer {
  const state = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + key[i % key.length]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
  }
  let i = 0;
  j = 0;
  return Buffer.from(data.map(byte => {
    i = (i + 1) & 255;
    j = (j + state[i]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
    return byte ^ state[(state[i] + state[j]) & 255];
  }));
}

function crc32Js(text: string): number {
  let value = 0xffffffff;
  for (const byte of Buffer.from(text, 'ascii')) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return -1 ^ value ^ 0xedb88320;
}

export function signXsCommon(cookies: Readonly<Record<string, string>>, timestampMs: number, session: SigningSession): string {
  // Upstream generates a large fingerprint but B1 selects only these fields.
  // Other cookies occur in x57, which is deliberately excluded from B1 by upstream.
  const fingerprint = {
    x33: '0', x34: '0', x35: '0', x36: String(session.integer(1, 20)),
    x37: '0|0|0|0|0|0|0|0|0|1|0|0|0|0|0|0|0|0|1|0|0|0|0|0',
    x38: '0|0|1|0|1|0|0|0|0|0|1|0|1|0|1|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0',
    x39: 0, x42: '3.4.4', x43: '742cc32c', x44: String(timestampMs),
    x45: '__SEC_CAV__1-1-1-1-1|__SEC_WSA__|', x46: 'false', x48: '', x49: '{list:[],type:}',
    x50: '', x51: '', x52: '', x82: '_0x17a2|_0x1954'
  };
  const encrypted = arc4(Buffer.from(JSON.stringify(fingerprint)), Buffer.from('xhswebmplfbt'));
  // Python decodes RC4 as Latin-1 then percent-encodes UTF-8 before collecting bytes.
  const b1 = customBase64(Buffer.from(encrypted.toString('latin1'), 'utf8'));
  return customBase64(JSON.stringify({ s0: 5, s1: '', x0: '1', x1: '4.3.5', x2: 'Windows', x3: 'xhs-pc-web',
    x4: '4.86.0', x5: cookies.a1, x6: '', x7: '', x8: b1, x9: crc32Js(b1), x10: 0, x11: 'normal' }));
}
