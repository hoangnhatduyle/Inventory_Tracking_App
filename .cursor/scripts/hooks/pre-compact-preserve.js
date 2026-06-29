#!/usr/bin/env node
/**
 * PreCompact hook: essential state preservation before context compaction.
 *
 * Fires just before Claude Code compacts the context window. Reads the most
 * recently modified session transcript, extracts the essential task state
 * (last user goal, recently modified files, last error), and writes a
 * compact-state.md snapshot to the ECC sessions directory.
 *
 * The session-start.js hook reads this snapshot (if < 1 hour old) and
 * injects it as additionalContext — ensuring that after compaction, Claude
 * has a crisp summary of what was happening.
 *
 * Design principles:
 * - Never blocks compaction (exit code 0 always)
 * - Silent on all errors — compaction must not be interrupted
 * - Reads the most recently modified .jsonl transcript across all projects
 *
 * Cross-platform (Windows, macOS, Linux)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getClaudeDir, getSessionsDir, ensureDir, getDateTimeString } = require('../lib/utils');

const COMPACT_STATE_FILE = 'compact-state.md';

function run(_inputOrRaw) {
  try {
    const transcriptPath = findActiveTranscript();
    if (!transcriptPath) return { exitCode: 0 };

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const state = extractEssentialState(content);

    const sessionsDir = getSessionsDir();
    ensureDir(sessionsDir);

    const markdown = formatCompactState(state);
    fs.writeFileSync(path.join(sessionsDir, COMPACT_STATE_FILE), markdown, 'utf8');
  } catch {
    // Never block compaction
  }

  return { exitCode: 0 };
}

function extractEssentialState(transcriptContent) {
  const lines = transcriptContent.split('\n').filter(Boolean);
  const entries = lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);

  // Last user message = current goal
  const userEntries = entries.filter(e => e.type === 'user' || e.role === 'user');
  const lastGoal = userEntries.length > 0 ? userEntries[userEntries.length - 1] : null;

  // Modified files from Write/Edit/MultiEdit tool calls
  const modifiedFiles = [...new Set(
    entries
      .filter(e => e.tool_name === 'Write' || e.tool_name === 'Edit' || e.tool_name === 'MultiEdit')
      .flatMap(e => {
        if (e.tool_input?.file_path) return [e.tool_input.file_path];
        if (Array.isArray(e.tool_input?.edits)) return e.tool_input.edits.map(ed => ed.file_path).filter(Boolean);
        return [];
      })
  )];

  // Last tool output containing error signals
  const errorEntries = entries.filter(
    e => e.tool_output?.output && /error|exception|failed|traceback/i.test(e.tool_output.output)
  );
  const lastError = errorEntries.length > 0 ? errorEntries[errorEntries.length - 1] : null;

  return { lastGoal, modifiedFiles, lastError };
}

function formatCompactState(state) {
  const goalText = state.lastGoal
    ? String(typeof state.lastGoal.content === 'string'
        ? state.lastGoal.content
        : JSON.stringify(state.lastGoal.content)).slice(0, 500)
    : null;

  const errorText = state.lastError
    ? String(state.lastError.tool_output.output).slice(0, 400)
    : null;

  return [
    '# Compact State Snapshot',
    `*Saved before context compaction at ${getDateTimeString()}*`,
    '',
    '## Current Objective',
    goalText ? `> ${goalText}` : '_Not captured_',
    '',
    '## Modified Files',
    state.modifiedFiles.length > 0
      ? state.modifiedFiles.map(f => `- ${f}`).join('\n')
      : '_None tracked_',
    '',
    '## Last Error (if any)',
    errorText ? `\`\`\`\n${errorText}\n\`\`\`` : '_No recent errors_',
  ].join('\n');
}

function findActiveTranscript() {
  const claudeDir = getClaudeDir();
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  let newest = null;
  let newestTime = 0;

  for (const proj of fs.readdirSync(projectsDir)) {
    const projDir = path.join(projectsDir, proj);
    try {
      if (!fs.statSync(projDir).isDirectory()) continue;
    } catch {
      continue;
    }

    for (const file of fs.readdirSync(projDir)) {
      if (!file.endsWith('.jsonl')) continue;
      const fp = path.join(projDir, file);
      try {
        const mtime = fs.statSync(fp).mtimeMs;
        if (mtime > newestTime) {
          newestTime = mtime;
          newest = fp;
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return newest;
}

module.exports = { run, extractEssentialState, formatCompactState, findActiveTranscript, COMPACT_STATE_FILE };

if (require.main === module) {
  const MAX_STDIN = 1024 * 1024;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(raw || '{}');
    process.exit(Number.isInteger(result.exitCode) ? result.exitCode : 0);
  });
}
