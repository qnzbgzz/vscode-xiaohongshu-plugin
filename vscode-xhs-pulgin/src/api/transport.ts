import type { ExtensionError } from '../domain/errors';
import { RequestScheduler } from './requestScheduler';

export interface TransportRequest {
  method: 'GET' | 'POST';
  url: string;
  headers?: Readonly<Record<string, string>>;
  body?: string;
  readOnly: boolean;
}

export interface TransportOptions {
  scheduler: RequestScheduler;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const TIMEOUT_REASON = Symbol('transport_timeout');
const INTERNAL_ERROR = Symbol('internal_transport_error');

type InternalExtensionError = ExtensionError & {
  readonly [INTERNAL_ERROR]: true;
};

function extensionError(
  code: ExtensionError['code'],
  message: string,
  retryable: boolean,
  action?: ExtensionError['action']
): InternalExtensionError {
  const error = action === undefined
    ? { code, message, retryable }
    : { code, message, retryable, action };
  Object.defineProperty(error, INTERNAL_ERROR, { value: true });
  return error as InternalExtensionError;
}

function cancelledError(): ExtensionError {
  return extensionError('cancelled', '请求已取消', false);
}

function apiError(retryable: boolean): ExtensionError {
  return extensionError('api_error', '请求失败，请稍后重试', retryable, 'retry');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInternalExtensionError(error: unknown): error is InternalExtensionError {
  if (!isRecord(error)) return false;
  return (error as unknown as InternalExtensionError)[INTERNAL_ERROR] === true;
}

async function cancelUnusedBody(response: Response, signal: AbortSignal): Promise<void> {
  if (!response.body || response.bodyUsed) return;
  if (signal.aborted) throw signal.reason;
  let onAbort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    await Promise.race([
      response.body.cancel().catch(() => undefined),
      aborted
    ]);
  } catch {
    if (signal.aborted) throw signal.reason;
    // The classified status error remains authoritative and contains no body data.
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export class Transport {
  private readonly scheduler: RequestScheduler;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: TransportOptions) {
    this.scheduler = options.scheduler;
    this.fetcher = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error('Invalid request timeout');
    }
  }

  request<T>(request: TransportRequest, signal?: AbortSignal): Promise<T> {
    return this.scheduler.schedule(
      (scheduledSignal) => this.perform<T>(request, scheduledSignal),
      signal
    );
  }

  private async perform<T>(request: TransportRequest, signal: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const onScheduledAbort = (): void => controller.abort(cancelledError());
    signal.addEventListener('abort', onScheduledAbort, { once: true });
    const timer = setTimeout(() => controller.abort(TIMEOUT_REASON), this.timeoutMs);
    try {
      const response = await this.fetcher(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });

      if (response.status === 461 || response.status === 471) {
        await cancelUnusedBody(response, controller.signal);
        throw extensionError(
          'verification_required',
          '需要在浏览器完成验证后重试',
          false,
          'verify'
        );
      }
      if (response.status === 429 || response.status >= 500) {
        await cancelUnusedBody(response, controller.signal);
        throw apiError(request.readOnly);
      }
      if (!response.ok) {
        await cancelUnusedBody(response, controller.signal);
        throw apiError(false);
      }

      const text = await response.text();
      if (!text) return undefined as T;

      let value: unknown;
      try {
        value = JSON.parse(text) as unknown;
      } catch {
        throw extensionError(
          'contract_error',
          '当前内容暂时无法解析',
          false,
          'retry'
        );
      }

      if (!isRecord(value)) {
        throw extensionError(
          'contract_error',
          '当前内容暂时无法解析',
          false,
          'retry'
        );
      }
      if (value.success === true) {
        return (Object.hasOwn(value, 'data') ? value.data : value.success) as T;
      }

      switch (value.code) {
        case 300012:
          throw extensionError(
            'ip_blocked',
            '当前网络访问受限，请稍后重试或更换网络',
            false,
            'wait'
          );
        case 300015:
          throw extensionError(
            'signature_error',
            '请求签名校验失败，请稍后重试',
            false,
            'retry'
          );
        case -100:
          throw extensionError(
            'session_expired',
            '登录已失效，请重新连接账号',
            false,
            'login'
          );
        default:
          throw apiError(false);
      }
    } catch (error) {
      if (signal.aborted) throw cancelledError();
      if (controller.signal.reason === TIMEOUT_REASON) {
        throw extensionError(
          'timeout',
          '请求超时，请稍后重试',
          request.readOnly,
          'retry'
        );
      }
      if (isInternalExtensionError(error)) throw error;
      throw extensionError(
        'offline',
        '网络连接不可用，请检查网络后重试',
        request.readOnly,
        'retry'
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onScheduledAbort);
    }
  }
}
