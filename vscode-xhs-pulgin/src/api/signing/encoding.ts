// Encoding/hash primitives adapted from Cloxl/xhshow 0.2.0 (MIT).
import { createHash } from 'node:crypto';
import { CUSTOM_ALPHABET, STANDARD_ALPHABET } from './config';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
export type GetParamValue = JsonScalar | JsonScalar[];
export type GetParams = Record<string, GetParamValue>;
export type RequestData = JsonObject;
export const md5 = (value: string): Buffer => createHash('md5').update(value).digest();
export const rotateLeft = (value: number, shift: number): number => ((value << shift) | (value >>> (32 - shift))) >>> 0;

export function customBase64(data: string | Uint8Array, alphabet = CUSTOM_ALPHABET): string {
  return Buffer.from(data).toString('base64').replace(/[A-Za-z0-9+/]/g, char => alphabet[STANDARD_ALPHABET.indexOf(char)]);
}

export function normalizeUri(uri: string): string {
  const trimmed = uri.trim();
  // Preserve escaped path bytes and Unicode, like Python urlparse().path.
  const path = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*|^\/\/[^/]*/i, '').split(/[?#]/, 1)[0];
  if (!path.startsWith('/') || path === '/') throw new Error('Invalid request URI');
  return path;
}

function invalidRequestData(): never {
  throw new Error('Invalid request data');
}

function validateNumber(value: number): void {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) invalidRequestData();
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataValue(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) invalidRequestData();
  return descriptor.value;
}

function arrayLength(value: unknown[]): number {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (!descriptor || !('value' in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0) invalidRequestData();
  const length = descriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== length + 1 || !keys.includes('length')) invalidRequestData();
  return length;
}

function copyJsonValue(value: unknown, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    validateNumber(value);
    return value;
  }
  if (typeof value !== 'object' || !isPlainObject(value) && !Array.isArray(value)) invalidRequestData();
  if (ancestors.has(value)) invalidRequestData();
  ancestors.add(value);
  let copy: JsonValue;
  if (Array.isArray(value)) {
    const length = arrayLength(value);
    const items: JsonValue[] = [];
    for (let index = 0; index < length; index++) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) invalidRequestData();
      items.push(copyJsonValue(ownDataValue(value, String(index)), ancestors));
    }
    copy = items;
  } else {
    const keys = Object.keys(value);
    if (Reflect.ownKeys(value).length !== keys.length) invalidRequestData();
    const object = Object.create(null) as JsonObject;
    for (const key of keys) Object.defineProperty(object, key, {
      value: copyJsonValue(ownDataValue(value, key), ancestors),
      enumerable: true,
      configurable: true,
      writable: true
    });
    copy = object;
  }
  ancestors.delete(value);
  return copy;
}

function copyPostBody(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) invalidRequestData();
  return copyJsonValue(value, new Set<object>()) as JsonObject;
}

export function validatePostBody(value: unknown): asserts value is JsonObject {
  copyPostBody(value);
}

function copyGetParams(value: unknown): GetParams {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) invalidRequestData();
  const keys = Object.keys(value);
  if (Reflect.ownKeys(value).length !== keys.length) invalidRequestData();
  const copy = Object.create(null) as GetParams;
  for (const key of keys) {
    const item = ownDataValue(value, key);
    const values = Array.isArray(item) ? item : [item];
    if (Array.isArray(item)) arrayLength(item);
    const scalars: JsonScalar[] = [];
    for (let index = 0; index < values.length; index++) {
      if (Array.isArray(item) && !Object.prototype.hasOwnProperty.call(item, index)) invalidRequestData();
      const scalar = Array.isArray(item) ? ownDataValue(item, String(index)) : values[index];
      if (typeof scalar === 'number') validateNumber(scalar);
      else if (scalar !== null && typeof scalar !== 'string' && typeof scalar !== 'boolean') invalidRequestData();
      scalars.push(scalar as JsonScalar);
    }
    Object.defineProperty(copy, key, {
      value: Array.isArray(item) ? scalars : scalars[0],
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return copy;
}

export function validateGetParams(value: unknown): asserts value is GetParams {
  copyGetParams(value);
}

function pythonString(value: JsonScalar): string {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  return String(value);
}

export function serializePostBody(data: JsonObject): string {
  return JSON.stringify(copyPostBody(data));
}

export function serializeGetParams(data: GetParams): string {
  return Object.entries(copyGetParams(data)).map(([key, value]) => {
    const text = Array.isArray(value) ? value.map(pythonString).join(',') : value === null ? '' : pythonString(value);
    const encoded = encodeURIComponent(text).replace(/[!'()*]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase()).replace(/%2C/g, ',');
    return `${key}=${encoded}`;
  }).join('&');
}

export function contentString(method: 'GET' | 'POST', uri: string, data?: GetParams | JsonObject | null): string {
  if (method === 'POST') return uri + serializePostBody((data ?? {}) as JsonObject);
  const params = (data ?? {}) as GetParams;
  const query = serializeGetParams(params);
  return query ? uri + '?' + query : uri;
}

export function uint(value: number | bigint, bytes: number, endian: 'LE' | 'BE' = 'BE'): Buffer {
  const buffer = Buffer.alloc(bytes);
  if (bytes === 8) {
    if (endian === 'LE') buffer.writeBigUInt64LE(BigInt(value));
    else buffer.writeBigUInt64BE(BigInt(value));
  } else if (endian === 'LE') buffer.writeUIntLE(Number(value) >>> 0, 0, bytes);
  else buffer.writeUIntBE(Number(value) >>> 0, 0, bytes);
  return buffer;
}

export function xxh32(buffer: Buffer): number {
  const p1 = 0x9e3779b1, p2 = 0x85ebca77, p3 = 0xc2b2ae3d, p4 = 0x27d4eb2f, p5 = 0x165667b1;
  let pos = 0, digest: number;
  if (buffer.length >= 16) {
    const acc = [(p1 + p2) >>> 0, p2, 0, -p1 >>> 0];
    while (pos <= buffer.length - 16) {
      for (let i = 0; i < 4; i++, pos += 4) acc[i] = Math.imul(rotateLeft((acc[i] + Math.imul(buffer.readUInt32LE(pos), p2)) >>> 0, 13), p1) >>> 0;
    }
    digest = (rotateLeft(acc[0], 1) + rotateLeft(acc[1], 7) + rotateLeft(acc[2], 12) + rotateLeft(acc[3], 18)) >>> 0;
  } else digest = p5;
  digest = (digest + buffer.length) >>> 0;
  while (pos + 4 <= buffer.length) {
    digest = Math.imul(rotateLeft((digest + Math.imul(buffer.readUInt32LE(pos), p3)) >>> 0, 17), p4) >>> 0;
    pos += 4;
  }
  while (pos < buffer.length) digest = Math.imul(rotateLeft((digest + Math.imul(buffer[pos++], p5)) >>> 0, 11), p1) >>> 0;
  digest = Math.imul(digest ^ (digest >>> 15), p2) >>> 0;
  digest = Math.imul(digest ^ (digest >>> 13), p3) >>> 0;
  return (digest ^ (digest >>> 16)) >>> 0;
}

export function shardingKey(userId: string): number {
  const data = Buffer.from(userId);
  let hash = 151488, pos = 0;
  const mix = (word: number): number => Math.imul(rotateLeft(Math.imul(word, 0xcc9e2d51), 15), 0x1b873593);
  while (pos + 4 <= data.length) {
    hash ^= mix(data.readUInt32LE(pos));
    hash = (Math.imul(rotateLeft(hash, 13), 5) + 0xe6546b64) | 0;
    pos += 4;
  }
  let tail = 0;
  for (let i = 0; pos + i < data.length; i++) tail |= data[pos + i] << (i * 8);
  if (pos < data.length) hash ^= mix(tail);
  hash ^= data.length;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) % 100 + 1;
}
