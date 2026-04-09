/**
 * Reactive notification store using Svelte 5 runes.
 * Usage: import { notifications } from '$lib/notifications.svelte';
 *        notifications.add('success', 'Pushed!');
 */

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  expiresAt: number;
}

const DURATION_MS = 4000;
const MAX_VISIBLE = 3;

let _items = $state<Notification[]>([]);
let _counter = 0;

export const notifications = {
  get items(): Notification[] {
    return _items;
  },

  add(type: NotificationType, message: string): void {
    const id = ++_counter;
    const expiresAt = Date.now() + DURATION_MS;
    // Keep only the most recent MAX_VISIBLE - 1 items, then append the new one
    _items = [..._items.slice(-(MAX_VISIBLE - 1)), { id, type, message, expiresAt }];
    setTimeout(() => {
      _items = _items.filter((n) => n.id !== id);
    }, DURATION_MS);
  },

  dismiss(id: number): void {
    _items = _items.filter((n) => n.id !== id);
  },
};
