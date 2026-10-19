import type { SecretStorage } from 'vscode';

import { assertUsableCookies } from './cookieParser';

const COOKIE_SECRET_KEY = 'reader.xhs.cookies.v1';

export class CookieStore {
  constructor(private readonly secrets: SecretStorage) {}

  async load(): Promise<Record<string, string> | undefined> {
    const value = await this.secrets.get(COOKIE_SECRET_KEY);
    if (value === undefined) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error('invalid_cookie_store');
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Object.values(parsed).every((cookie) => typeof cookie === 'string')
    ) {
      throw new Error('invalid_cookie_store');
    }

    const cookies = parsed as Record<string, string>;
    assertUsableCookies(cookies);
    return cookies;
  }

  async save(cookies: Record<string, string>): Promise<void> {
    assertUsableCookies(cookies);

    const normalizedCookies = Object.fromEntries(
      Object.entries(cookies).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    );
    await this.secrets.store(
      COOKIE_SECRET_KEY,
      JSON.stringify(normalizedCookies)
    );
  }

  async clear(): Promise<void> {
    await this.secrets.delete(COOKIE_SECRET_KEY);
  }
}
