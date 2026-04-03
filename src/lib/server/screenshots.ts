import { promises as fs } from 'fs';
import { resolve, join } from 'path';

export function getScreenshotsDir(): string {
  const dir = process.env.SCREENSHOTS_DIR;
  if (!dir) throw new Error('SCREENSHOTS_DIR environment variable is not set');
  return resolve(dir);
}

export async function saveScreenshot(buffer: Buffer, extension: string): Promise<string> {
  const dir = getScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}.${extension}`;
  await fs.writeFile(join(dir, filename), buffer);
  return filename;
}
