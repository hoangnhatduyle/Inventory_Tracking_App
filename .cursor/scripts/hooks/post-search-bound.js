#!/usr/bin/env node
/**
 * PostToolUse hook: bounded search results warning.
 *
 * When Glob or Grep returns more results than ECC_SEARCH_BOUND (default: 50),
 * emits a stderr advisory so Claude knows to refine the search. Large result
 * sets flood the context window with low-signal matches; this nudges toward
 * more precise queries without blocking the tool.
 *
 * Cross-platform (Windows, macOS, Linux)
 */

'use strict';

const BOUND = parseInt(process.env.ECC_SEARCH_BOUND || '50', 10);

function run(inputOrRaw) {
  let input;
  let rawInput;

  try {
    if (typeof inputOrRaw === 'string') {
      rawInput = inputOrRaw;
      input = inputOrRaw.trim() ? JSON.parse(inputOrRaw) : {};
    } else {
      input = inputOrRaw || {};
      rawInput = JSON.stringify(inputOrRaw ?? {});
    }
  } catch {
    return { exitCode: 0, stdout: typeof inputOrRaw === 'string' ? inputOrRaw : '' };
  }

  const output = input.tool_output?.output || '';
  const lines = output.split('\n').filter(Boolean);

  if (lines.length > BOUND) {
    const toolName = input.tool_name || 'Search';
    const warn = [
      `[ECC Search Bound] ${toolName} returned ${lines.length} results (limit: ${BOUND}).`,
      `Large result sets consume context window without adding signal.`,
      `Refine your search: add a path filter, use a stricter regex, or set head_limit explicitly.`,
    ].join(' ');

    return { exitCode: 0, stdout: rawInput, stderr: warn };
  }

  return { exitCode: 0, stdout: rawInput };
}

module.exports = { run };

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
