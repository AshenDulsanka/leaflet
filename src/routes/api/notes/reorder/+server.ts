/**
 * PATCH /api/notes/reorder
 * Persists note sort order into SQLite.
 */

import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getDb } from '$lib/server/database';

interface ReorderItem {
	path: string;
	sort_order: number;
}

// Security: reject traversal patterns, null bytes, oversized paths, and absolute paths before any DB write.
function isValidPath(p: unknown): boolean {
	if (typeof p !== 'string' || p.trim().length === 0) return false;
	if (p.includes('\0')) return false;
	if (p.length > 512) return false;
	if (p.includes('..')) return false;
	if (p.startsWith('/') || p.startsWith('\\')) return false;
	return true;
}

function isValidItem(item: unknown): item is ReorderItem {
	if (typeof item !== 'object' || item === null) return false;
	const candidate = item as Record<string, unknown>;
	return isValidPath(candidate.path) && Number.isFinite(candidate.sort_order as number);
}

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const body: unknown = await request.json();

		if (typeof body !== 'object' || body === null || !Array.isArray((body as Record<string, unknown>).items)) {
			error(400, { message: 'Invalid items' });
		}

		const { items } = body as { items: unknown[] };

		const MAX_REORDER_ITEMS = 2000;
		if (!Array.isArray(items) || items.length > MAX_REORDER_ITEMS) {
			error(400, { message: 'Invalid items' });
		}

		if (!items.every(isValidItem)) {
			error(400, { message: 'Invalid items' });
		}

		const validItems = items as ReorderItem[];

		const db = getDb();
		const stmt = db.prepare('INSERT OR REPLACE INTO note_sort_order (note_path, sort_order) VALUES (?, ?)');
		const upsertAll = db.transaction((rows: ReorderItem[]) => {
			for (const row of rows) {
				stmt.run(row.path, row.sort_order);
			}
		});
		upsertAll(validItems);

		return json({ success: true });
	} catch (err) {
		// Re-throw HttpErrors (e.g. the 400 validation errors above) so they are
		// not swallowed and incorrectly replaced with a 500 response.
		if (isHttpError(err)) throw err;
		console.error('Failed to save sort order:', err);
		error(500, { message: 'Failed to save sort order' });
	}
};
