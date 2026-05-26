/**
 * Client-side image upload helpers for the editor.
 * Uses an explicit allowlist to prevent non-image types (e.g. SVG with JS)
 * from being sent to the server, even though the server also validates.
 */

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Returns true only for the four image types the server accepts. */
export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_TYPES.has(mimeType);
}

/**
 * Upload a File to /api/screenshots and call onInsert with the resulting
 * markdown image snippet. Silently returns if the type is not allowed.
 */
export async function uploadAndInsert(
  file: File,
  workspaceId: string | null,
  onInsert: (text: string) => void,
  onUploaded?: () => void,
): Promise<void> {
  if (!isAllowedImageType(file.type)) return;
  const rawExt = file.type.split("/")[1] ?? "png";
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const formData = new FormData();
  formData.append("image", file, `screenshot.${ext}`);
  if (workspaceId) formData.append("workspace_id", workspaceId);
  try {
    const res = await fetch("/api/screenshots", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return;
    const { url } = (await res.json()) as { url: string };
    onInsert(`![screenshot](${url})`);
    onUploaded?.();
  } catch {
    console.error("Failed to upload screenshot");
  }
}
