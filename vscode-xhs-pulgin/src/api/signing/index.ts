// Request signing facade adapted from Cloxl/xhshow 0.2.0 (MIT).
import { contentString, normalizeUri, type GetParams, type JsonObject, shardingKey } from './encoding';
import { SigningSession } from './session';
import { signXs, signXyw } from './xs';
import { signXsCommon } from './xsCommon';
import { signRap } from './xrap';

export { SigningSession } from './session';
export type { RandomSource } from './session';
export type { GetParams, GetParamValue, JsonObject, JsonScalar, JsonValue, RequestData } from './encoding';

export interface SignInput {
  method: 'GET' | 'POST';
  uri: string;
  cookies: Readonly<Record<string, string>>;
  params?: GetParams | null;
  body?: JsonObject | null;
  timestampMs?: number;
  signFormat?: 'xys' | 'xyw';
  userId?: string;
}

export interface SigningHeaders {
  'x-s': string;
  'x-s-common': string;
  'x-t': string;
  'x-b3-traceid': string;
  'x-xray-traceid': string;
  'x-mns': 'unload';
  'xy-direction': string;
  'x-rap-param'?: string;
}

export function signRequest(input: SignInput, session: SigningSession): SigningHeaders {
  const a1 = input.cookies.a1;
  if (typeof a1 !== 'string' || !a1.trim()) throw new Error('Missing a1 cookie');
  if (input.method !== 'GET' && input.method !== 'POST') throw new Error('Unsupported signing method');
  if ((input.method === 'GET' && input.body != null) || (input.method === 'POST' && input.params != null)) throw new Error('Mismatched request data');
  if (input.signFormat !== undefined && input.signFormat !== 'xys' && input.signFormat !== 'xyw') throw new Error('Unsupported signature format');
  const timestampMs = input.timestampMs ?? session.now();
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) throw new Error('Invalid signing timestamp');
  const uri = normalizeUri(input.uri);
  const data = input.method === 'GET' ? input.params ?? {} : input.body ?? {};
  const content = input.method === 'GET'
    ? contentString('GET', uri, data)
    : contentString('POST', uri, data);
  const xs = input.signFormat === 'xyw' ? signXyw(content, a1, timestampMs) : signXs(content, uri, input.method, a1, timestampMs, session);
  const common = signXsCommon(input.cookies, timestampMs, session);
  const hexAlphabet = 'abcdef0123456789';
  const b3 = session.ascii(16, hexAlphabet);
  const xray = ((BigInt(timestampMs) << 23n) | BigInt(session.integer(0, 8388607))).toString(16).padStart(16, '0') + session.ascii(16, hexAlphabet);
  const headers: SigningHeaders = { 'x-s': xs, 'x-s-common': common, 'x-t': String(timestampMs), 'x-b3-traceid': b3,
    'x-xray-traceid': xray, 'x-mns': 'unload', 'xy-direction': String(input.userId === undefined ? session.integer(10, 100) : shardingKey(input.userId)) };
  if (uri === '/api/sns/web/v1/feed' || uri === '/api/sns/web/v1/search/notes' || uri === '/api/sns/web/v1/homefeed') headers['x-rap-param'] = signRap(uri, data, timestampMs, session);
  return headers;
}
