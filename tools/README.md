# tools/claude_usage_push.py

Reads local Claude Code transcripts (`~/.claude/projects/**/*.jsonl`), sums
today's (local date) token usage per assistant message, prices it, and POSTs
a small JSON payload to a Puck device at `http://<host>:<port>/claude`.
Stdlib only, no dependencies.

Deduplicates by assistant message id (transcripts can repeat entries).

## Usage

```bash
# Preview today's usage without sending anything
python3 tools/claude_usage_push.py --dry-run --once

# Run the built-in price/logic check (no network, no transcript reads)
python3 tools/claude_usage_push.py --selftest

# Push once to a specific host
python3 tools/claude_usage_push.py --host 192.168.1.50 --port 8080 --once

# Loop forever, posting every 30s (host defaults to $PUCK_HOST or puck.local)
python3 tools/claude_usage_push.py --interval 30
```

Payload shape: `{"usd": <float>, "in": <int>, "out": <int>, "window_pct": <int>, "ts": <unix seconds>}`.
`in` is `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` summed; `out` is `output_tokens`.

## Price table (USD per 1M tokens: input / output)

| Model prefix        | Input | Output |
|----------------------|-------|--------|
| claude-fable-5-1, claude-fable-5 | 10 | 50 |
| claude-opus-5, claude-opus-4-8, claude-opus-4-7, claude-opus-4-6 | 5 | 25 |
| claude-sonnet-5      | 2     | 10     |
| claude-sonnet-4-6    | 3     | 15     |
| claude-haiku-4-5     | 1     | 5      |
| unknown model        | 5     | 25 (+ warning on stderr) |

Cache read = 10% of the model's input rate. Cache write (cache creation) = 125% of the input rate.
Matching is by longest-prefix against the model id in the transcript (which carries a date suffix, e.g. `claude-opus-5-20260115`).

**These rates are what the user supplied for this task, not fetched from a pricing page — unverified.**
Check them against Anthropic's current pricing before relying on them for real billing decisions.

`window_pct` (5-hour rate-limit window utilization) **cannot be computed from local transcripts** —
there is no field in the JSONL that reports it. The script always sends `-1` unless you pass
`--window-pct N` yourself.

## Alternative for org-wide numbers (not implemented here)

For **organization-wide** usage (not just this machine's local sessions), Anthropic exposes
the **Usage & Cost Admin API**: `GET /v1/organizations/usage_report/messages`. It requires an
Admin API key (`sk-ant-admin...`) and is plain HTTP (no SDK helper for this endpoint as of
this writing). It reports usage across the whole organization, not one developer's local
Claude Code sessions — a materially different number than what this script sums.

The exact query parameters and response shape were **not verified here** (no admin key was
available to test against the live endpoint). Don't assume the shape without checking
Anthropic's Admin API docs first.
