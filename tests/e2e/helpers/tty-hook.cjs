// Loaded via --require before the CLI entry point.
// Makes prompts think stdin/stdout are a TTY even when spawned with piped stdio.
'use strict';

Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

// prompts uses setRawMode for password input. Pipes don't support it,
// so we provide a no-op to prevent crashes.
if (typeof process.stdin.setRawMode !== 'function') {
  process.stdin.setRawMode = function () { return process.stdin; };
}
