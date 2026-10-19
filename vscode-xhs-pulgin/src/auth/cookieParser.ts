export function parseCookieHeader(value: string): Record<string, string> {
  value = value.trim().replace(/^cookie\s*:\s*/i, '');
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return Object.fromEntries(parsed.map((entry: unknown) => {
          if (!entry || typeof entry !== 'object' ||
              !('name' in entry) || typeof entry.name !== 'string' ||
              !('value' in entry) || typeof entry.value !== 'string') {
            throw new Error('invalid_cookie_json');
          }
          return [entry.name, entry.value];
        }));
      }
      if (parsed && typeof parsed === 'object' && Object.values(parsed).every(v => typeof v === 'string')) {
        return Object.fromEntries(Object.entries(parsed));
      }
    } catch { /* Do not include the supplied credentials in errors. */ }
    throw new Error('Cookie JSON 格式不正确，请粘贴完整请求头 Cookie 或浏览器导出的 Cookie 数组');
  }
  const cookies: Record<string, string> = {};

  for (const segment of value.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = segment.slice(0, separatorIndex).trim();
    if (!name) {
      continue;
    }

    cookies[name] = segment.slice(separatorIndex + 1).trim();
  }

  return cookies;
}

export function assertUsableCookies(
  cookies: Record<string, string>
): void {
  if (!cookies.a1) {
    throw new Error('missing_a1');
  }
}
