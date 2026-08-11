import {
  TimerApplicationV1,
  type TimerPrincipalV1,
  type TimerScopeV1,
} from "./timer-application.v1.js";

const DEFAULT_POLL_INTERVAL_MS_V1 = 1_000;
const MIN_POLL_INTERVAL_MS_V1 = 100;
const MAX_POLL_INTERVAL_MS_V1 = 60_000;
const MAX_DISPATCHES_PER_SCOPE_V1 = 100;

function assertPollIntervalV1(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < MIN_POLL_INTERVAL_MS_V1 ||
    value > MAX_POLL_INTERVAL_MS_V1
  ) {
    throw new Error("PAI_TIMER_POLL_INTERVAL_MS must be an integer between 100 and 60000");
  }
  return value;
}

export function timerPollIntervalFromEnvV1(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const value = env.PAI_TIMER_POLL_INTERVAL_MS;
  return assertPollIntervalV1(
    value === undefined ? DEFAULT_POLL_INTERVAL_MS_V1 : Number(value),
  );
}

export interface TimerDispatchWorkerOptionsV1 {
  readonly timer: TimerApplicationV1;
  readonly poll_interval_ms?: number;
  readonly worker_id?: string;
  readonly checkpoint_id?: string;
  readonly now?: () => Date;
}

/**
 * The owner-local timer dispatcher. It discovers due owner scopes, turns due
 * schedules into occurrences, claims them with the existing CAS fence, then
 * hands them to the existing Trigger Processor integration. It deliberately
 * has no HTTP surface and therefore never accepts an untrusted cross-scope
 * worker request.
 */
export class TimerDispatchWorkerV1 {
  readonly #timer: TimerApplicationV1;
  readonly #pollIntervalMs: number;
  readonly #workerId: string;
  readonly #checkpointId: string;
  readonly #now: () => Date;
  #timerHandle: ReturnType<typeof setTimeout> | undefined;
  #active: Promise<void> | undefined;
  #closed = false;
  #started = false;

  public constructor(options: TimerDispatchWorkerOptionsV1) {
    this.#timer = options.timer;
    this.#pollIntervalMs = assertPollIntervalV1(
      options.poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS_V1,
    );
    this.#workerId = options.worker_id ?? "timer-dispatcher";
    this.#checkpointId = options.checkpoint_id ?? "automatic";
    this.#now = options.now ?? (() => new Date());
  }

  public start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#schedule(0);
  }

  public async close(): Promise<void> {
    this.#closed = true;
    if (this.#timerHandle !== undefined) clearTimeout(this.#timerHandle);
    await this.#active;
  }

  public async runOnce(): Promise<void> {
    const now = this.#now();
    const globalPrincipal = Object.freeze({
      caller: "timer_trigger_app" as const,
      capabilities: Object.freeze([
        "timer.worker.scan",
        "timer.worker.dispatch",
      ]),
    });
    const scopes = await this.#timer.discoverRunnableScopes(globalPrincipal, now);
    for (const scope of scopes) {
      await this.#runScope(scope, now);
    }
  }

  #schedule(delayMs: number): void {
    if (this.#closed) return;
    this.#timerHandle = setTimeout(() => {
      this.#active = this.runOnce()
        .catch(() => undefined)
        .finally(() => {
          this.#active = undefined;
          this.#schedule(this.#pollIntervalMs);
        });
    }, delayMs);
    this.#timerHandle.unref?.();
  }

  async #runScope(scope: TimerScopeV1, now: Date): Promise<void> {
    const principal: TimerPrincipalV1 = Object.freeze({
      caller: "timer_trigger_app",
      capabilities: Object.freeze([
        "timer.worker.scan",
        "timer.worker.dispatch",
      ]),
      scope,
    });
    await this.#timer.scanDue(principal, {
      scope,
      worker_id: this.#workerId,
      checkpoint_id: this.#checkpointId,
      now: now.toISOString(),
      limit: MAX_DISPATCHES_PER_SCOPE_V1,
    });
    for (let dispatched = 0; dispatched < MAX_DISPATCHES_PER_SCOPE_V1; dispatched += 1) {
      const claim = await this.#timer.claimNextRunnableOccurrence(principal, {
        worker_id: this.#workerId,
        now: now.toISOString(),
      });
      if (claim === null) return;
      try {
        await this.#timer.dispatchOccurrence(principal, {
          scope,
          occurrence_id: claim.occurrence.id,
          expected_occurrence_version: claim.occurrence_version,
          dispatch_generation: claim.dispatch_generation,
          claim_token: claim.claim_token,
          trace_id: `timer-dispatch:${claim.occurrence.id}:${claim.dispatch_generation}`,
          now: now.toISOString(),
        });
      } catch {
        // The exact claim remains fenced. Its lease / retry policy decides the
        // next durable attempt, so a worker pass must not manufacture a second
        // submission after an unknown downstream result.
        return;
      }
    }
  }
}
