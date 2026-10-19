export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isAllowedXhsImageUrl(value: string): boolean {
  if (/^data:image\/(?:avif|webp|png|jpeg|gif);base64,[a-z0-9+/=]+$/i.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname === 'xhscdn.com' || url.hostname.endsWith('.xhscdn.com') ||
      url.hostname === 'xiaohongshu.com' || url.hostname.endsWith('.xiaohongshu.com')
    );
  } catch {
    return false;
  }
}

export function isAllowedXhsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'xiaohongshu.com' ||
        url.hostname.endsWith('.xiaohongshu.com'))
    );
  } catch {
    return false;
  }
}
