// XYS/XYW algorithms ported from Cloxl/xhshow 0.2.0 (MIT).
import { createCipheriv } from 'node:crypto';
import { APP_ID, HEX_KEY, X3_ALPHABET } from './config';
import { customBase64, md5, rotateLeft, uint } from './encoding';
import { SigningSession } from './session';

function customHash(input: Buffer): Buffer {
  const length = input.length;
  let [s0, s1, s2, s3] = [1831565813 ^ length, 461845907 ^ (length << 8), 2246822507 ^ (length << 16), 3266489909 ^ (length << 24)];
  for (let i = 0; i < length; i += 8) {
    const v0 = input.readUInt32LE(i), v1 = input.readUInt32LE(i + 4);
    s0 = rotateLeft(((s0 + v0) >>> 0) ^ s2, 7);
    s1 = rotateLeft(((v0 ^ s1) + s3) >>> 0, 11);
    s2 = rotateLeft(((s2 + v1) >>> 0) ^ s0, 13);
    s3 = rotateLeft(((s3 ^ v1) + s1) >>> 0, 17);
  }
  const t0 = s0 ^ length, t1 = s1 ^ t0, t2 = (s2 + t1) >>> 0, t3 = s3 ^ t2;
  const r0 = rotateLeft(t0, 9), r1 = rotateLeft(t1, 13), r2 = rotateLeft(t2, 17), r3 = rotateLeft(t3, 19);
  s0 = (r0 + r2) >>> 0;
  s1 = r1 ^ r3;
  s2 = (r2 + s0) >>> 0;
  s3 = r3 ^ s1;
  return Buffer.concat([s0, s1, s2, s3].map(value => uint(value, 4, 'LE')));
}

function padded(text: string, length: number): Buffer {
  const output = Buffer.alloc(length);
  Buffer.from(text).copy(output, 0, 0, length);
  return output;
}

export function signXs(content: string, uri: string, method: 'GET' | 'POST', a1: string, timestampMs: number, session: SigningSession): string {
  const state = session.advance();
  const seed = session.integer(0, 0xffffffff), seedByte = seed & 0xff;
  const time = uint(timestampMs, 8, 'LE');
  const digest = md5(content);
  const envTable = [115, 248, 83, 102, 103, 201, 181, 131, 99, 94, 4, 68, 250, 132, 21];
  const envChecks = [0, 1, 18, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0];
  const payload = Buffer.concat([
    Buffer.from([121, 104, 96, 41]), uint(seed, 4, 'LE'), time,
    uint(state.pageLoadTimestamp, 8, 'LE'), uint(state.sequenceValue, 4, 'LE'), uint(state.windowPropsLength, 4, 'LE'),
    // Upstream session uses Python len(str), i.e. code points rather than UTF-16 units.
    uint(Array.from(content).length, 4, 'LE'),
    Buffer.from(digest.subarray(0, 8).map(byte => byte ^ seedByte)),
    Buffer.from([52]), padded(a1, 52), Buffer.from([10]), padded(APP_ID, 10),
    Buffer.from([1, seedByte ^ envTable[0], ...envTable.slice(1).map((byte, index) => byte ^ envChecks[index + 1])]),
    Buffer.from([2, 97, 51, 16]),
    Buffer.from(customHash(Buffer.concat([time, method === 'GET' ? digest : md5(uri)])).map(byte => byte ^ seedByte))
  ]);
  const transformed = payload.map((byte, index) => byte ^ (HEX_KEY[index] ?? 0)).subarray(0, 144);
  return 'XYS_' + customBase64(JSON.stringify({ x0: '4.3.5', x1: APP_ID, x2: 'Windows', x3: 'mns0301_' + customBase64(transformed, X3_ALPHABET), x4: 'object' }));
}

export function signXyw(content: string, a1: string, timestampMs: number): string {
  const digest = md5('url=' + content).toString('hex');
  const message = `x1=${digest};x2=0|0|0|1|0|0|1|0|0|0|1|0|0|0|0|1|0|0|1;x3=${a1};x4=${timestampMs};`;
  const cipher = createCipheriv('aes-128-cbc', Buffer.from('7cc4adla5ay0701v'), Buffer.from('4uzjr7mbsibcaldp'));
  const payload = Buffer.concat([cipher.update(Buffer.from(message).toString('base64')), cipher.final()]).toString('hex');
  return 'XYW_' + Buffer.from(JSON.stringify({ signSvn: '56', signType: 'x2', appId: APP_ID, signVersion: '1', payload })).toString('base64');
}
