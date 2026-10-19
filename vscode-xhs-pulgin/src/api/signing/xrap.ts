// RAP TLV/cipher protocol ported from Cloxl/xhshow 0.2.0 (MIT).
import { gzip } from 'pako';
import { serializePostBody, type RequestData, uint, xxh32 } from './encoding';
import { RAP_ENV, RAP_ROUND_KEYS, RAP_SBOX, RAP_TRACE } from './rapConstants';
import { SigningSession } from './session';

const lastKey = Buffer.concat([0xf396b44f, 0x1b6e3d87, 0x8e94c95c, 0x1e6ce62f].map(value => uint(value, 4)));
const tables = Array.from({ length: 4 }, () => new Uint32Array(256));
for (let index = 0; index < 256; index++) {
  const s = RAP_SBOX[index], a = ((s << 1) ^ ((s & 128) ? 0x11b : 0)) & 255, d = a ^ s;
  tables[0][index] = ((a << 24) | (s << 16) | (s << 8) | d) >>> 0;
  tables[1][index] = ((d << 24) | (a << 16) | (s << 8) | s) >>> 0;
  tables[2][index] = ((s << 24) | (d << 16) | (a << 8) | s) >>> 0;
  tables[3][index] = ((s << 24) | (s << 16) | (d << 8) | a) >>> 0;
}

function encryptBlock(block: Buffer): Buffer {
  const padded = Buffer.alloc(16);
  block.copy(padded);
  let state = RAP_ROUND_KEYS[0].map((key, index) => padded.readUInt32BE(index * 4) ^ key);
  for (let round = 1; round < 10; round++) {
    state = state.map((_, index) => (
      tables[0][state[index] >>> 24] ^ tables[1][(state[(index + 1) & 3] >>> 16) & 255] ^
      tables[2][(state[(index + 2) & 3] >>> 8) & 255] ^ tables[3][state[(index + 3) & 3] & 255] ^ RAP_ROUND_KEYS[round][index]
    ) >>> 0);
  }
  const output = Buffer.alloc(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) output[4 * row + col] = RAP_SBOX[(state[(row + col) & 3] >>> (24 - 8 * col)) & 255] ^ lastKey[4 * row + col];
  }
  return output;
}

function field(tag: number, value: number | Buffer, size = 4): Buffer {
  return Buffer.concat([uint(tag, 2), Buffer.isBuffer(value) ? Buffer.concat([uint(value.length, 4), value]) : uint(value, size)]);
}

function buildBody(api: string, data: RequestData, timestampMs: number, session: SigningSession): Buffer {
  const innerKey = Buffer.from(session.ascii(16));
  const mask = session.integer(1, 255), nonce = session.integer(0, 0xffffffff);
  const fields = [field(1000, timestampMs, 8), field(1001, nonce), field(1002, innerKey), field(1003, xxh32(Buffer.from(api + serializePostBody(data))))];
  for (const tag of [...Array.from({ length: 15 }, (_, i) => 1051 + i), 1070, 1066, 1067, 1068, 1069]) fields.push(field(tag, 0, 1));
  fields.push(field(1100, 0));
  for (let tag = 1071; tag <= 1073; tag++) fields.push(field(tag, 0, 1));
  fields.push(field(1075, 0x564), field(1076, 0x2c), field(1077, Math.max(0, timestampMs - 0x434), 8), field(1078, RAP_TRACE),
    field(1082, 0), field(1084, 0), field(1085, 0), field(1086, 100), field(1087, Math.max(0, timestampMs - 0x2d7), 8), field(1088, RAP_ENV),
    field(1090, 0), field(1097, 0), field(1092, 0x566), field(1094, 0x519), field(1095, Math.max(0, timestampMs - 0x218c), 8),
    field(1093, 0), field(1096, 0, 1), field(1091, Buffer.from([0, 0, 255, 255])));
  for (let tag = 1151; tag <= 1156; tag++) fields.push(field(tag, 0, 1));
  return Buffer.from(Buffer.concat(fields).map((byte, index) => index < 16 ? byte : byte ^ mask));
}

export function signRap(uri: string, data: RequestData, timestampMs: number, session: SigningSession): string {
  const raw = buildBody('//edith.xiaohongshu.com' + uri, data, timestampMs, session);
  // pako's zlib 1.2.x-compatible output matches the pinned Python oracle byte-for-byte.
  const compressed = Buffer.from(gzip(raw, {
    level: 6,
    header: { time: Math.floor(timestampMs / 1000), os: 3 }
  }));
  const encryptionKey = Buffer.from(session.ascii(16));
  const salt = Buffer.from(session.ascii(session.integer(4, 6)));
  const xored = Buffer.from(compressed.map((byte, index) => byte ^ encryptionKey[index % 16]));
  const blocks: Buffer[] = [];
  for (let offset = 0; offset < xored.length; offset += 16) blocks.push(encryptBlock(xored.subarray(offset, offset + 16)));
  const cipherBody = Buffer.concat([...blocks, uint(compressed.length, 4)]);
  const content = Buffer.concat([salt, encryptBlock(encryptionKey), uint(16, 4), cipherBody]);
  const header = Buffer.concat([Buffer.from([7, 36, 1, salt.length]), uint(1, 4), uint(20, 4), uint(cipherBody.length, 4),
    uint(xxh32(content), 4), uint(10300, 4), uint(session.integer(60, 240), 4), Buffer.alloc(8)]);
  return Buffer.concat([header, content]).toString('base64');
}
