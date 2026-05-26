/**
 * Reactive notification store using Svelte 5 runes.
 * Usage: import { notifications } from '$lib/notifications.svelte';
 *        notifications.add('success', 'Pushed!');
 */

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  expiresAt: number | null;
  sticky: boolean;
}

type NotificationOptions = {
  durationMs?: number;
  sticky?: boolean;
};

const DURATION_MS = 4000;
const WARNING_DURATION_MS = 6000;
const MAX_VISIBLE = 3;

let _items = $state<Notification[]>([]);
let _counter = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function clearTimer(id: number): void {
  const timer = timers.get(id);
  if (!timer) {
    return;
  }
  clearTimeout(timer);
  timers.delete(id);
}

function removeById(id: number): void {
  _items = _items.filter((item) => item.id !== id);
  clearTimer(id);
}

function scheduleAutoDismiss(id: number, durationMs: number): void {
  clearTimer(id);
  const timer = setTimeout(() => {
    removeById(id);
  }, durationMs);
  timers.set(id, timer);
}

function pickOverflowDropIndex(items: Notification[]): number {
  const nonErrorIndex = items.findIndex((item) => item.type !== "error");
  if (nonErrorIndex >= 0) {
    return nonErrorIndex;
  }

  const nonStickyIndex = items.findIndex((item) => !item.sticky);
  if (nonStickyIndex >= 0) {
    return nonStickyIndex;
  }

  return 0;
}

export const notifications = {
  get items(): Notification[] {
    return _items;
  },

  add(
    type: NotificationType,
    message: string,
    options: NotificationOptions = {},
  ): void {
    const id = ++_counter;
    const sticky = options.sticky ?? type === "error";
    const durationMs =
      options.durationMs ??
      (type === "warning" ? WARNING_DURATION_MS : DURATION_MS);
    const expiresAt = sticky ? null : Date.now() + durationMs;
    const nextNotification: Notification = {
      id,
      type,
      message,
      expiresAt,
      sticky,
    };

    let nextItems = [..._items, nextNotification];
    while (nextItems.length > MAX_VISIBLE) {
      const dropIndex = pickOverflowDropIndex(nextItems);
      const dropped = nextItems[dropIndex];
      clearTimer(dropped.id);
      nextItems = nextItems.filter((_, index) => index !== dropIndex);
    }

    _items = nextItems;
    if (!sticky) {
      scheduleAutoDismiss(id, durationMs);
    }
  },

  dismiss(id: number): void {
    removeById(id);
  },
};
