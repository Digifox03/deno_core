// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
const {
  op_async_barrier_create,
  op_async_barrier_await,
  op_async_yield,
  op_async_spin_on_state,
  op_stats_capture,
  op_stats_diff,
  op_stats_dump,
  op_stats_delete,
} = Deno
  .core
  .ensureFastOps();

export function barrierCreate(name: string, count: number) {
  op_async_barrier_create(name, count);
}

export function barrierAwait(name: string) {
  return op_async_barrier_await(name);
}

export async function asyncYield() {
  await op_async_yield();
}

// This function never returns.
export async function asyncSpin() {
  await op_async_spin_on_state();
}

let nextStats = 0;

export class Stats {
  constructor(public name: string) {
    op_stats_capture(this.name);
  }

  dump(): StatsCollection {
    return new StatsCollection(op_stats_dump(this.name).active);
  }

  [Symbol.dispose]() {
    op_stats_delete(this.name);
  }
}

export class StatsDiff {
  #appeared;
  #disappeared;

  // deno-lint-ignore no-explicit-any
  constructor(private diff: any) {
    this.#appeared = new StatsCollection(this.diff.appeared);
    this.#disappeared = new StatsCollection(this.diff.disappeared);
  }

  get empty(): boolean {
    return this.#appeared.empty && this.#disappeared.empty;
  }

  get appeared(): StatsCollection {
    return this.#appeared;
  }

  get disappeared(): StatsCollection {
    return this.#disappeared;
  }
}

// This contains an array of serialized RuntimeActivity structs.
export class StatsCollection {
  // deno-lint-ignore no-explicit-any
  constructor(private data: any[]) {
  }

  private countResourceActivity(type: string): number {
    let count = 0;
    for (const item of this.data) {
      if (type in item) {
        count++;
      }
    }
    return count;
  }

  countOps(): number {
    return this.countResourceActivity("AsyncOp");
  }

  countOpsWithTraces(): number {
    let count = 0;
    for (const item of this.data) {
      if ("AsyncOp" in item) {
        if (typeof item["AsyncOp"][2] === "string") {
          count++;
        }
      }
    }
    return count;
  }

  countResources(): number {
    return this.countResourceActivity("Resource");
  }

  countTimers(): number {
    return this.countResourceActivity("Timer") +
      this.countResourceActivity("Interval");
  }

  get rawData() {
    return this.data;
  }

  get empty(): boolean {
    return this.data.length == 0;
  }
}

export class StatsFactory {
  static capture(): Stats {
    return new Stats(`stats-${nextStats++}`);
  }

  static diff(before: Stats, after: Stats): StatsDiff {
    return new StatsDiff(op_stats_diff(before.name, after.name));
  }
}
