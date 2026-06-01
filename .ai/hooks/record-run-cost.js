#!/usr/bin/env node
/**
 * Agent-OS run-cost recorder (AGENTS.md rule 10).
 *
 * Wired as a SessionEnd + SubagentStop hook in .claude/settings.json. On each
 * agent run end it reads that run's transcript, sums the token usage and
 * measures the wall-clock span, and appends ONE JSON line to
 * `.ai/agent-runs.jsonl` — the authoritative, comparable per-run cost trail.
 *
 * Token figures come straight from the transcript's per-message `usage`
 * accounting (input / output / cache-read / cache-creation), so they are real,
 * not estimated. Duration is the span between the first and last transcript
 * timestamps.
 *
 * Contract: a hook must never break the session. Every failure path exits 0 and
 * writes nothing. Reads the hook payload as JSON on stdin:
 *   { session_id, transcript_path, cwd, hook_event_name, reason? }
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// .ai/agent-runs.jsonl, resolved from this script's location (robust regardless
// of the process cwd the hook runs in).
const LOG_PATH = path.join(__dirname, "..", "agent-runs.jsonl");

function readStdin() {
    try {
        return fs.readFileSync(0, "utf8");
    } catch {
        return "";
    }
}

function fmtDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function main() {
    let input;
    try {
        input = JSON.parse(readStdin() || "{}");
    } catch {
        process.exit(0);
    }

    const transcriptPath = input.transcript_path;
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        process.exit(0);
    }

    let lines;
    try {
        lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
    } catch {
        process.exit(0);
    }

    const tokens = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
    let assistantMessages = 0;
    let model;
    let firstTs;
    let lastTs;

    for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }

        if (entry.timestamp) {
            if (firstTs === undefined) firstTs = entry.timestamp;
            lastTs = entry.timestamp;
        }

        const usage = entry.message && entry.message.usage;
        if (usage) {
            assistantMessages += 1;
            tokens.input += usage.input_tokens || 0;
            tokens.output += usage.output_tokens || 0;
            tokens.cache_read += usage.cache_read_input_tokens || 0;
            tokens.cache_creation += usage.cache_creation_input_tokens || 0;
            if (entry.message.model) model = entry.message.model;
        }
    }

    const total = tokens.input + tokens.output + tokens.cache_read + tokens.cache_creation;

    let durationS;
    if (firstTs && lastTs) {
        const ms = Date.parse(lastTs) - Date.parse(firstTs);
        if (Number.isFinite(ms)) durationS = ms / 1000;
    }

    const record = {
        ts: new Date().toISOString(),
        event: input.hook_event_name || null,
        session_id: input.session_id || null,
        model: model || null,
        messages: assistantMessages,
        tokens: { ...tokens, total },
        duration_s: durationS !== undefined ? Math.round(durationS) : null,
        duration: durationS !== undefined ? fmtDuration(durationS) : null,
        cwd: input.cwd || null
    };

    try {
        fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n");
    } catch {
        // Never fail the session over a logging write.
    }

    process.exit(0);
}

main();
