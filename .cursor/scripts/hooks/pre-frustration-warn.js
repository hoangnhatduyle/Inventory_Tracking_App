#!/usr/bin/env node
/**
 * PreToolUse hook: frustration warning.
 *
 * Companion to stop-frustration-detect.js. Before every tool call, checks
 * whether the frustration signal file is present and fresh (< 5 min). If so,
 * emits a stern advisory to stderr — visible to Claude as a hook warning —
 * then deletes the signal (one warning per detected frustration).
 *
 * The advisory asks Claude to pause, re-read the original request, and try a
 * fundamentally different approach before proceeding with the tool.
 *
 * Design principles:
 * - Never blocks tool execution (exit code 0 always)
 * - Always passes rawInput through as stdout
 * - Signal is consumed after first warning (prevents spam)
 * - TTL prevents stale signals from surfacing in later sessions
 *
 * Cross-platform (Windows, macOS, Linux)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SIGNAL_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSignalPath() {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
  return path.join(os.tmpdir(), `ecc-frustration-${sessionId}.json`);
}

const ADVISORY = [
  '[ECC Frustration Detected] Recent messages indicate the current approach is not working.',
  'Before using this tool, consider:',
  '  1. Re-read the original request from scratch — do not assume you understand it',
  '  2. Explicitly state what you are abandoning and why',
  '  3. Try a fundamentally different strategy',
  '  4. Ask for clarification if the requirement is still unclear',
].join('\n');

function run(inputOrRaw) {
  let rawInput;

  try {
    rawInput = typeof inputOrRaw === 'string' ? inputOrRaw : JSON.stringify(inputOrRaw ?? {});
  } catch {
    rawInput = '';
  }

  const signalPath = getSignalPath();

  if (!fs.existsSync(signalPath)) {
    return { exitCode: 0, stdout: rawInput };
  }

  try {
    const signal = JSON.parse(fs.readFileSync(signalPath, 'utf8'));
    const age = Date.now() - (signal.detectedAt || 0);

    // Always remove the signal file (stale or fresh) to avoid accumulation
    try { fs.unlinkSync(signalPath); } catch { /* ignore */ }

    if (age > SIGNAL_TTL_MS) {
      // Stale signal — discard silently
      return { exitCode: 0, stdout: rawInput };
    }

    return { exitCode: 0, stdout: rawInput, stderr: ADVISORY };
  } catch {
    // If signal file is malformed, remove and continue
    try { fs.unlinkSync(signalPath); } catch { /* ignore */ }
    return { exitCode: 0, stdout: rawInput };
  }
}

module.exports = { run, getSignalPath, SIGNAL_TTL_MS };

if (require.main === module) {
  const MAX_STDIN = 1024 * 1024;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    if (result.stderr) process.stderr.write(`${result.stderr}\n`);
    process.stdout.write(typeof result.stdout === 'string' ? result.stdout : raw);
    process.exit(Number.isInteger(result.exitCode) ? result.exitCode : 0);
  });
}
