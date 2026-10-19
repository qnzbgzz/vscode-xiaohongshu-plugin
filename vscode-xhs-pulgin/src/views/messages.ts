export interface LoginMessage {
  type: 'requestManualCookieInput';
}

export interface DetailMessage {
  type: 'loadReplies';
  commentId: string;
}

export function parseWebviewMessage(
  value: unknown
): LoginMessage | DetailMessage | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const message = value as Record<string, unknown>;

  switch (message.type) {
    case 'requestManualCookieInput':
      return Object.keys(message).length === 1
        ? { type: 'requestManualCookieInput' }
        : undefined;
    case 'loadReplies':
      return typeof message.commentId === 'string'
        ? { type: 'loadReplies', commentId: message.commentId }
        : undefined;
    default:
      return undefined;
  }
}
