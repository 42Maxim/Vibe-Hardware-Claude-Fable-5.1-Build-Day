#!/usr/bin/env python3
"""Sum today's local Claude Code token usage from ~/.claude/projects/**/*.jsonl,
price it, and POST a small JSON payload to a Puck device. Stdlib only.
Payload: {"usd": float, "in": int, "out": int, "window_pct": int, "ts": int}
"""
import argparse, glob, json, os, sys, time, urllib.request
from datetime import datetime

# USD per 1M tokens: (input, output). Longest-prefix match against model ids.
# ponytail: these rates are as supplied by the user, not fetched from a
# pricing page -- see tools/README.md. Update here if pricing changes.
PRICES = {
    "claude-fable-5-1": (10, 50),
    "claude-fable-5": (10, 50),
    "claude-opus-5": (5, 25),
    "claude-opus-4-8": (5, 25),
    "claude-opus-4-7": (5, 25),
    "claude-opus-4-6": (5, 25),
    "claude-sonnet-5": (2, 10),
    "claude-sonnet-4-6": (3, 15),
    "claude-haiku-4-5": (1, 5),
}
UNKNOWN_PRICE = (5, 25)
CACHE_READ_FRAC = 0.10
CACHE_WRITE_FRAC = 1.25

def price_for_model(model):
    """Longest-prefix match; model ids carry date suffixes like -20260115."""
    best = max((k for k in PRICES if model.startswith(k)), key=len, default=None)
    if best is None:
        print(f"warning: unknown model '{model}', pricing as opus-tier", file=sys.stderr)
        return UNKNOWN_PRICE
    return PRICES[best]

def cost_usd(model, input_tokens, output_tokens, cache_read, cache_creation):
    in_rate, out_rate = price_for_model(model)
    return (
        input_tokens * in_rate
        + output_tokens * out_rate
        + cache_read * in_rate * CACHE_READ_FRAC
        + cache_creation * in_rate * CACHE_WRITE_FRAC
    ) / 1_000_000

def today_usage():
    """Return (usd, input_tokens_total, output_tokens_total) for today (local date)."""
    local_today = datetime.now().astimezone().date()
    seen_ids, total_usd, total_in, total_out, dups = set(), 0.0, 0, 0, 0

    for path in glob.glob(os.path.expanduser("~/.claude/projects/**/*.jsonl"), recursive=True):
        try:
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = obj.get("message", {})
                    usage = msg.get("usage")
                    ts = obj.get("timestamp")
                    if obj.get("type") != "assistant" or not usage or not ts:
                        continue
                    try:
                        # Transcript timestamps look like "2026-09-16T12:34:56.789Z" (UTC).
                        when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except ValueError:
                        continue
                    if when.astimezone().date() != local_today:
                        continue
                    mid = msg.get("id")
                    if mid:
                        if mid in seen_ids:
                            dups += 1
                            continue
                        seen_ids.add(mid)
                    inp = usage.get("input_tokens", 0)
                    out = usage.get("output_tokens", 0)
                    cread = usage.get("cache_read_input_tokens", 0)
                    ccreate = usage.get("cache_creation_input_tokens", 0)
                    total_usd += cost_usd(msg.get("model", ""), inp, out, cread, ccreate)
                    total_in += inp + cread + ccreate
                    total_out += out
        except OSError:
            continue

    if dups:
        print(f"note: skipped {dups} duplicate message id(s)", file=sys.stderr)
    return total_usd, total_in, total_out

def build_payload(window_pct):
    usd, tin, tout = today_usage()
    return {"usd": round(usd, 4), "in": tin, "out": tout, "window_pct": window_pct, "ts": int(time.time())}

def post_payload(host, port, payload):
    req = urllib.request.Request(
        f"http://{host}:{port}/claude",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status

def selftest():
    assert abs(cost_usd("claude-opus-5-20260115", 1_000_000, 0, 0, 0) - 5.00) < 1e-9  # 1M input
    assert abs(cost_usd("claude-opus-5", 0, 1_000_000, 0, 0) - 25.00) < 1e-9  # 1M output
    assert abs(cost_usd("claude-opus-5", 0, 0, 1_000_000, 0) - 0.50) < 1e-9  # 1M cache-read (10%)
    assert abs(cost_usd("claude-opus-5", 0, 0, 0, 1_000_000) - 6.25) < 1e-9  # 1M cache-write (125%)
    assert price_for_model("claude-sonnet-4-6-20260101") == (3, 15)  # longest-prefix match
    assert price_for_model("claude-sonnet-5-20260101") == (2, 10)
    assert price_for_model("claude-mystery-9000") == UNKNOWN_PRICE  # unknown -> opus-tier
    print("selftest OK")

def main():
    ap = argparse.ArgumentParser(description="Push today's local Claude Code usage to a Puck device.")
    ap.add_argument("--host", default=os.environ.get("PUCK_HOST", "puck.local"))
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--interval", type=int, default=60)
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--window-pct", type=int, default=-1)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    while True:
        payload = build_payload(args.window_pct)
        if args.dry_run:
            print(json.dumps(payload))
        else:
            try:
                status = post_payload(args.host, args.port, payload)
                print(f"posted to {args.host}:{args.port} -> {status}: {json.dumps(payload)}")
            except OSError as e:
                # ponytail: no backoff/retry queue -- just log and keep looping on --interval.
                print(f"post failed: {e}", file=sys.stderr)
        if args.once:
            break
        time.sleep(args.interval)

if __name__ == "__main__":
    main()
