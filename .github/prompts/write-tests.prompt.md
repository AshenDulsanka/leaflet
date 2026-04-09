---
description: Write Vitest unit tests for the selected Leaflet server-side TypeScript code. Follows existing test patterns in src/lib/server/ — sets NOTES_DATA_DIR before imports, uses tmpdir() for isolation, and calls reloadDb() in afterEach. Targets notes.ts and database.ts.
---

Write Vitest unit tests for the following Leaflet server-side code.

## Setup Requirements

Always follow this pattern at the top of the test file:

```typescript
import { tmpdir } from 'os';
import { join } from 'path';

// Environment variables must be set BEFORE importing the modules that read them
const testDir = join(tmpdir(), `leaflet-test-${Date.now()}`);
process.env.NOTES_DATA_DIR = testDir;

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { reloadDb } from '$lib/server/database';

afterEach(() => {
  reloadDb();
});
```

## What to Write

For each exported function in the provided code, write tests covering:

1. **Happy path** — expected input produces expected output
2. **Edge case** — empty string, boundary values, missing optional fields
3. **Error case** — invalid input or missing resource raises the correct error or returns a safe value

## Specific Patterns

### notes.ts functions (file system operations)
```typescript
it('throws when path contains traversal sequence', async () => {
  await expect(createNote('../evil', 'note')).rejects.toThrow();
});
```

### database.ts functions
```typescript
it('returns the same singleton on repeated calls', () => {
  expect(getDb()).toBe(getDb());
});
it('returns a fresh instance after reloadDb()', () => {
  const first = getDb();
  reloadDb();
  expect(getDb()).not.toBe(first);
});
```

## Cleanup

At the end of the file, add:
```typescript
import { rm } from 'fs/promises';

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});
```

## Output

Write the complete test file. Include all imports. Use descriptive test names that explain the behaviour being tested, not just the function name.
