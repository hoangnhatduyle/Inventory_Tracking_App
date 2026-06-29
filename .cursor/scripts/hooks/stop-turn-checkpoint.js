#!/usr/bin/env node
/**
 * Stop hook: turn-based compression checkpoint.
 *
 * Fires after each Claude response. Counts user message turns in the session
 * transcript. At milestone turn counts (every ECC_TURN_MILESTONE, default: 10),
 * writes a mid-session checkpoint file to the sessions directory and emits a
 * visible advisory via stderr suggesting /compact if approaching context limits.
 *
 * Proactively preserves session state before the context window gets stressed.
 * Companion to pre-compact-preserve.js which fires reactively when compaction
 * actually occurs.
 *
 * Design principles:
 * - Never blocks — always exits 0
 * - Async-safe: sync I/O only
 * - Milestone detection is exact (turn % MILESTONE === 0, turn > 0)
 * - Checkpoint is overwritten at each milestone (not accumulated)
 *
 * Cross-platform (Windows, macOS, Linux)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getSessionsDir, ensureDir, getDateTimeString } = require('../lib/utils');

const MILESTONE_EVERY = parseInt(process.env.ECC_TURN_MILESTONE || '10', 10);
const CHECKPOINT_FILE = 'turn-checkpoint.md';

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
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const userTurns = (content.match(/"type"\s*:\s*"user"/g) || []).length;

    if (userTurns > 0 && userTurns % MILESTONE_EVERY === 0) {
      saveCheckpoint(content, userTurns);

      const msg = [
        `[ECC Turn Checkpoint] ${userTurns} conversation turns reached.`,
        `Checkpoint saved. If switching tasks or approaching context limit,`,
        `run /compact to preserve this state efficiently.`,
      ].join(' ');

      return { exitCode: 0, stderr: msg };
    }
  } catch {
    // Silent — never interfere with session end
  }

  return { exitCode: 0 };
}

function saveCheckpoint(transcriptContent, turnCount) {
  const lines = transcriptContent.split('\n').filter(Boolean);
  const entries = lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  const userMessages = entries
    .filter(e => e.type === 'user' || e.role === 'user')
    .map(e => (typeof e.content === 'string' ? e.content : JSON.stringify(e.content)).slice(0, 200))
    .filter(Boolean);

  const modifiedFiles = [...new Set(
    entries
      .filter(e => e.tool_name === 'Write' || e.tool_name === 'Edit' || e.tool_name === 'MultiEdit')
      .flatMap(e => {
        if (e.tool_input?.file_path) return [e.tool_input.file_path];
        if (Array.isArray(e.tool_input?.edits)) return e.tool_input.edits.map(ed => ed.file_path).filter(Boolean);
        return [];
      })
  )];

  const checkpoint = [
    `# Turn Checkpoint — Turn ${turnCount}`,
    `*Saved at ${getDateTimeString()}*`,
    '',
    '## Session Goals (last 5 user messages)',
    userMessages.slice(-5).map((m, i) => `${i + 1}. ${m}`).join('\n') || '_None captured_',
    '',
    '## Modified Files',
    modifiedFiles.length > 0 ? modifiedFiles.map(f => `- ${f}`).join('\n') : '_None_',
  ].join('\n');

  const sessionsDir = getSessionsDir();
  ensureDir(sessionsDir);
  fs.writeFileSync(path.join(sessionsDir, CHECKPOINT_FILE), checkpoint, 'utf8');
}

module.exports = { run, MILESTONE_EVERY, CHECKPOINT_FILE };

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
    process.stdout.write(raw);
    process.exit(Number.isInteger(result.exitCode) ? result.exitCode : 0);
  });
}
