// Notes are loaded client-side from the file API. Disable SSR so SvelteKit
// does not attempt to render the page on the server (where the Docker FS
// API is available but the client-side fetch calls would target the wrong host).
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const ssr = false;
export const prerender = false;

function encodePathForUrl(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export const load: PageLoad = async ({ fetch, params }) => {
  const rawPath = (params.path ?? "").replace(/^\/+|\/+$/g, "");

  // Root path: the page's onMount will redirect to the active workspace.
  if (!rawPath) {
    return {};
  }

  if (rawPath.endsWith(".md")) {
    const noteRes = await fetch(`/api/notes/${encodePathForUrl(rawPath)}`);
    if (noteRes.status === 400) {
      throw error(400, "Invalid note path");
    }
    if (noteRes.status === 404) {
      throw error(404, "Note not found");
    }
    if (!noteRes.ok) {
      throw error(500, "Failed to validate note path");
    }
    return {};
  }

  const treeRes = await fetch(
    `/api/notes/tree?base=${encodeURIComponent(rawPath)}`,
  );
  if (treeRes.status === 400) {
    throw error(400, "Invalid folder path");
  }
  if (treeRes.status === 404) {
    throw error(404, "Folder not found");
  }
  if (!treeRes.ok) {
    throw error(500, "Failed to validate folder path");
  }

  return {};
};
