// Session counters adapted from Cloxl/xhshow 0.2.0 (MIT).
import { randomBytes } from 'node:crypto';

export interface RandomSource { next(): number }
export interface SignState {
  pageLoadTimestamp: number;
  sequenceValue: number;
  windowPropsLength: number;
}
export interface SessionOptions {
  now?: () => number;
  random?: RandomSource;
  initialState?: SignState;
}

export class SigningSession {
  readonly now: () => number;
  private readonly random: RandomSource;
  private readonly state: SignState;

  constructor(options: SessionOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? { next: () => randomBytes(4).readUInt32BE() / 0x100000000 };
    this.state = options.initialState ? { ...options.initialState } : {
      pageLoadTimestamp: this.now(),
      sequenceValue: this.integer(15, 17),
      windowPropsLength: this.integer(1000, 2000)
    };
  }

  integer(min: number, max: number): number {
    const value = this.random.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid random source');
    return min + Math.floor(value * (max - min + 1));
  }

  ascii(length: number, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
    return Array.from({ length }, () => alphabet[this.integer(0, alphabet.length - 1)]).join('');
  }

  advance(): SignState {
    this.state.sequenceValue += this.integer(0, 1);
    this.state.windowPropsLength += this.integer(1, 10);
    return { ...this.state };
  }
}
