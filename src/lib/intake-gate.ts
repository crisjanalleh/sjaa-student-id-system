// Bounds CPU/memory-heavy work (image processing) during submission bursts so the
// server queues briefly and then sheds load with a retryable 503 instead of thrashing.
const MAX_ACTIVE = Math.max(1, Number(process.env.INTAKE_CONCURRENCY) || 4);
const MAX_QUEUE = Math.max(1, Number(process.env.INTAKE_QUEUE) || 250);
const MAX_WAIT_MS = 25_000;

export class IntakeBusyError extends Error {
  constructor() {
    super("The system is receiving many submissions right now.");
  }
}

type Waiter = { wake: () => void; cancelled: boolean };
const state = globalThis as typeof globalThis & { __sjaaIntake?: { active: number; queue: Waiter[] } };
const gate = (state.__sjaaIntake ??= { active: 0, queue: [] });

function release() {
  gate.active--;
  while (gate.queue.length) {
    const next = gate.queue.shift()!;
    if (next.cancelled) continue;
    gate.active++;
    next.wake();
    return;
  }
}

export async function withIntakeSlot<T>(work: () => Promise<T>): Promise<T> {
  if (gate.active >= MAX_ACTIVE) {
    if (gate.queue.length >= MAX_QUEUE) throw new IntakeBusyError();
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { cancelled: false, wake: () => { clearTimeout(timer); resolve(); } };
      const timer = setTimeout(() => {
        waiter.cancelled = true;
        reject(new IntakeBusyError());
      }, MAX_WAIT_MS);
      gate.queue.push(waiter);
    });
  } else {
    gate.active++;
  }
  try {
    return await work();
  } finally {
    release();
  }
}
