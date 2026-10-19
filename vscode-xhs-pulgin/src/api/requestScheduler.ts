import type { ExtensionError } from '../domain/errors';

export interface Clock {
  now(): number;
}

export interface Sleeper {
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}

export interface RandomSource {
  next(): number;
}

export interface RequestSchedulerOptions {
  clock?: Clock;
  sleeper?: Sleeper;
  random?: RandomSource;
}

type Operation<T> = (signal: AbortSignal) => Promise<T>;

interface QueueEntry {
  readonly controller: AbortController;
  readonly run: () => Promise<void>;
  readonly reject: (error: ExtensionError) => void;
  readonly removeExternalAbortListener: () => void;
  settled: boolean;
}

interface PauseWaiter {
  readonly onAbort: () => void;
  readonly resolve: () => void;
  readonly signal: AbortSignal;
}

const DEFAULT_MINIMUM_INTERVAL_MS = 1_000;
const DEFAULT_MAX_ATTEMPTS = 3;

function cancelledError(): ExtensionError {
  return {
    code: 'cancelled',
    message: '请求已取消',
    retryable: false
  };
}

function isExtensionError(error: unknown): error is ExtensionError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Partial<ExtensionError>;
  return typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.retryable === 'boolean';
}

class SystemSleeper implements Sleeper {
  sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(cancelledError());
        return;
      }

      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, milliseconds);
      const onAbort = (): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(cancelledError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export class RequestScheduler {
  private readonly clock: Clock;
  private readonly sleeper: Sleeper;
  private readonly random: RandomSource;
  private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS;
  private readonly queue: QueueEntry[] = [];
  private active: QueueEntry | undefined;
  private draining = false;
  private minimumIntervalMs = DEFAULT_MINIMUM_INTERVAL_MS;
  private lastStartedAt: number | undefined;
  private paused = false;
  private readonly pauseWaiters = new Set<PauseWaiter>();

  constructor(options: RequestSchedulerOptions = {}) {
    this.clock = options.clock ?? { now: () => Date.now() };
    this.sleeper = options.sleeper ?? new SystemSleeper();
    this.random = options.random ?? { next: () => Math.random() };
  }

  schedule<T>(operation: Operation<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(cancelledError());

    return new Promise<T>((resolve, reject) => {
      const controller = new AbortController();
      const onExternalAbort = (): void => this.cancelEntry(entry);
      const removeExternalAbortListener = (): void => {
        signal?.removeEventListener('abort', onExternalAbort);
      };

      const entry: QueueEntry = {
        controller,
        settled: false,
        removeExternalAbortListener,
        reject,
        run: async () => {
          try {
            const value = await this.executeWithRetry(operation, controller.signal);
            if (!entry.settled) {
              entry.settled = true;
              resolve(value);
            }
          } catch (error) {
            if (!entry.settled) {
              entry.settled = true;
              reject(controller.signal.aborted ? cancelledError() : error);
            }
          }
        }
      };

      signal?.addEventListener('abort', onExternalAbort, { once: true });
      this.queue.push(entry);
      void this.drain();
    });
  }

  suspend(): void {
    this.minimumIntervalMs = Math.max(
      DEFAULT_MINIMUM_INTERVAL_MS * 2,
      this.minimumIntervalMs * 2
    );
  }

  resume(): void {
    this.paused = false;
    const waiters = [...this.pauseWaiters];
    this.pauseWaiters.clear();
    for (const waiter of waiters) {
      waiter.signal.removeEventListener('abort', waiter.onAbort);
      waiter.resolve();
    }
  }

  get pendingPauseWaiterCount(): number {
    return this.pauseWaiters.size;
  }

  cancelAll(): void {
    if (this.active) this.cancelEntry(this.active);
    for (const entry of this.queue) this.cancelEntry(entry);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    try {
      while (this.queue.length > 0) {
        const entry = this.queue.shift();
        if (!entry || entry.settled) {
          entry?.removeExternalAbortListener();
          continue;
        }

        this.active = entry;
        await entry.run();
        entry.removeExternalAbortListener();
        this.active = undefined;
      }
    } finally {
      this.active = undefined;
      this.draining = false;
      if (this.queue.some((entry) => !entry.settled)) void this.drain();
    }
  }

  private cancelEntry(entry: QueueEntry): void {
    if (entry.settled) return;
    const error = cancelledError();
    entry.settled = true;
    entry.controller.abort(error);
    entry.removeExternalAbortListener();
    entry.reject(error);
  }

  private async executeWithRetry<T>(operation: Operation<T>, signal: AbortSignal): Promise<T> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      await this.waitUntilResumed(signal);
      this.throwIfCancelled(signal);
      if (attempt > 1) await this.waitForRetry(attempt, signal);
      await this.waitForSpacing(signal);

      try {
        return await this.invoke(operation, signal);
      } catch (error) {
        this.throwIfCancelled(signal);
        if (isExtensionError(error) && error.code === 'verification_required') {
          this.suspend();
        }
        if (isExtensionError(error) && error.code === 'ip_blocked') {
          this.pause();
        }
        if (!isExtensionError(error) || !error.retryable || attempt === this.maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('unreachable');
  }

  private async waitForRetry(attempt: number, signal: AbortSignal): Promise<void> {
    const retryIndex = attempt - 2;
    const delay = (2 ** retryIndex) * 1_000 + this.nextRandom() * 1_000;
    await this.sleeper.sleep(delay, signal);
  }

  private async waitForSpacing(signal: AbortSignal): Promise<void> {
    if (this.lastStartedAt !== undefined) {
      const elapsed = Math.max(0, this.clock.now() - this.lastStartedAt);
      if (elapsed < this.minimumIntervalMs) {
        const delay = this.minimumIntervalMs - elapsed
          + this.truncatedGaussianJitter()
          + this.readingPause();
        await this.sleeper.sleep(delay, signal);
      }
    }

    this.throwIfCancelled(signal);
    this.lastStartedAt = this.clock.now();
  }

  private truncatedGaussianJitter(): number {
    const first = Math.max(Number.EPSILON, 1 - this.nextRandom());
    const second = this.nextRandom();
    const standardNormal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    return Math.min(750, Math.max(0, 300 + standardNormal * 150));
  }

  private readingPause(): number {
    if (this.nextRandom() >= 0.05) return 0;
    return 2_000 + this.nextRandom() * 3_000;
  }

  private nextRandom(): number {
    const value = this.random.next();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error('Invalid random source');
    }
    return value;
  }

  private async invoke<T>(operation: Operation<T>, signal: AbortSignal): Promise<T> {
    this.throwIfCancelled(signal);
    return operation(signal);
  }

  private throwIfCancelled(signal: AbortSignal): void {
    if (signal.aborted) throw cancelledError();
  }

  private pause(): void {
    this.paused = true;
  }

  private async waitUntilResumed(signal: AbortSignal): Promise<void> {
    if (!this.paused) return;
    if (signal.aborted) throw cancelledError();

    await new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        if (this.pauseWaiters.delete(waiter)) {
          signal.removeEventListener('abort', onAbort);
          reject(cancelledError());
        }
      };
      const waiter: PauseWaiter = { onAbort, resolve, signal };
      signal.addEventListener('abort', onAbort, { once: true });
      this.pauseWaiters.add(waiter);
    });
  }
}
