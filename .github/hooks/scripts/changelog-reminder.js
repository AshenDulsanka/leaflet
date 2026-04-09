#!/usr/bin/env node
// Runs after every tool use. If a source file was edited, reminds the agent to update CHANGELOG.md.
let raw = '';
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(chunk) { raw += chunk; });
process.stdin.on('end', function() {
  try {
    const input = JSON.parse(raw);
    const toolName = input.toolName || '';
    const editTools = ['replace_string_in_file', 'multi_replace_string_in_file', 'create_file'];

    if (editTools.includes(toolName)) {
      const filePath = (input.toolInput && input.toolInput.filePath) || '';
      const inSrc = /[\/\\]src[\/\\]/.test(filePath);
      const isChangelog = filePath.includes('CHANGELOG');

      if (inSrc && !isChangelog) {
        process.stdout.write(JSON.stringify({
          systemMessage:
            'Source file modified. Add an entry to CHANGELOG.md under [Unreleased] before finishing this task.'
        }));
        return;
      }
    }
  } catch (_) { /* invalid or missing stdin — output empty object below */ }
  process.stdout.write('{}');
});
