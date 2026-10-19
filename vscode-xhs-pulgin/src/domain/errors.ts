export type ErrorCode =
  | 'not_authenticated' | 'session_expired' | 'verification_required'
  | 'ip_blocked' | 'signature_error' | 'offline' | 'timeout'
  | 'contract_error' | 'api_error' | 'cancelled';

export interface ExtensionError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  action?: 'login' | 'verify' | 'retry' | 'wait';
}

export function toExtensionError(error: unknown): ExtensionError {
  void error;

  return {
    code: 'api_error',
    message: '请求失败，请稍后重试',
    retryable: false,
    action: 'retry'
  };
}
