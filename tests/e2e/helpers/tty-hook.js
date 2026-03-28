// Hack to trick `prompts` into believing the piped node process is a TTY.
// This allows testing the CLI using standard pipe without needing heavy pseudo-terminal dependencies.

Object.defineProperty(process.stdin, 'isTTY', {
  value: true,
  writable: false,
});
Object.defineProperty(process.stdout, 'isTTY', {
  value: true,
  writable: false,
});

if (process.env.DEBUG_TTY_HOOK === '1') {
  console.log('[tty-hook applied]');
}
