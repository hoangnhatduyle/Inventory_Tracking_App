#!/usr/bin/env node
/**
 * Stop hook: frustration signal detection.
 *
 * Fires after each Claude response. Scans the last N user messages in the
 * session transcript for frustration patterns ("still broken", "not what I
 * asked", "wtf", etc.). If detected, writes a short-lived signal file to the
 * OS temp dir. The companion hook pre-frustration-warn.js reads this signal
 * before the next tool call and emits an advisory to steer Claude toward a
 * different approach.
 *
 * Design principles:
 * - Never blocks — always exits 0
 * - Uses sync file I/O to stay compatible with run() direct-require path
 * - Signal file is scoped to the current session via CLAUDE_SESSION_ID
 *
 * Cross-platform (Windows, macOS, Linux)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SCAN_LAST_N = 5;

const FRUSTRATION_PATTERNS = [
  /\b(wtf|wth)\b/i,
  /\bstill (broken|wrong|not working|failing|the same)\b/i,
  /\bnot what i (asked|wanted|said|meant)\b/i,
  /\b(no[,.]?\s*)?(that'?s?|this is) (still )?wrong\b/i,
  /\bkeeps? (doing|happening|breaking|failing)\b/i,
  /\b(again|still)\b.{0,40}\b(same|error|issue|problem)\b/i,
  /\byou('re| are) not (understanding|getting it|listening)\b/i,
  /\bi (already|just) (said|told you|mentioned)\b/i,
  /\bwhy (is it|does it|won't it|doesn't it) (still|keep)\b/i,
];

function getSignalPath() {
  const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
  return path.join(os.tmpdir(), `ecc-frustration-${sessionId}.json`);
}

function extractUserMessages(transcriptPath) {
  const content = fs.readFileSync(transcriptPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);
  const messages = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' || entry.role === 'user') {
        const text = typeof entry.content === 'string'
          ? entry.content
          : JSON.stringify(entry.content);
        messages.push(text);
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

function isFrustrated(messages) {
  return messages.some(msg => FRUSTRATION_PATTERNS.some(p => p.test(msg)));
}

function run(inputOrRaw) {
  let input;

  try {
    const raw = typeof inputOrRaw === 'string' ? inputOrRaw : JSON.stringify(inputOrRaw ?? {});
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return { exitCode: 0 };
  }

  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { exitCode: 0 };
  }

  try {
    const allMessages = extractUserMessages(transcriptPath);
    const recentMessages = allMessages.slice(-SCAN_LAST_N);

    if (isFrustrated(recentMessages)) {
      const signalPath = getSignalPath();
      fs.writeFileSync(signalPath, JSON.stringify({
        detectedAt: Date.now(),
        sessionId: process.env.CLAUDE_SESSION_ID || 'unknown',
      }), 'utf8');
    }
  } catch {
    // Silent — never interfere with session end
  }

  return { exitCode: 0 };
}

module.exports = { run, FRUSTRATION_PATTERNS, getSignalPath };

if (require.main === module) {
  const MAX_STDIN = 1024 * 1024;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(raw);
    process.exit(Number.isInteger(result.exitCode) ? result.exitCode : 0);
  });
}
