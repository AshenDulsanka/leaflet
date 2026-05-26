/**
 * Funny commit messages for git sync operations.
 * Randomly selected when pushing changes.
 */
export const SYNC_MESSAGES: string[] = [
  "saving my notes before I forget everything",
  "ctrl+s but for real this time",
  "backing up before I break something",
  "future me will thank present me",
  "documenting my crimes against machines",
  "another day, another shell",
  "notes go brrr",
  "syncing before the coffee wears off",
  "proof that I actually did something today",
  "in case my laptop catches fire",
  "my notes, my precious",
  "checkpointing my pentesting journey",
  "git push --pray",
  "saving state like a good RPG player",
  "dear diary, I owned another box today",
  "commit and forget",
  "securing the loot before the reboot",
  "notes updated, sanity questionable",
  "because rm -rf is not a backup strategy",
  "syncing before entropy wins",
  "the pen is mightier than the sword, but git is mightier than both",
  "dropping notes like I drop shells",
  "checkpoint reached - no save scumming",
  "adding more evidence of my hacking",
  "my second brain needs backups too",
];

export function getRandomSyncMessage(): string {
  return SYNC_MESSAGES[Math.floor(Math.random() * SYNC_MESSAGES.length)];
}
