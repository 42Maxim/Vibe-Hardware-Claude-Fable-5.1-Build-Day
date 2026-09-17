# CLAUDE.md

Standing rules for this repo. They apply to every prompt; I won't repeat them.

## Edits

Make targeted edits; don't rewrite whole files.
Only change what I ask for. Report extras at the end instead of fixing them.

## Never guess

Verify dependency and tool versions against the lockfile or official source; never
guess. If unverifiable, say so.

Same rule for hardware: part numbers, prices, dimensions, pin counts and current
draws come from a supplier page or datasheet you actually opened. Where you can't
verify one, write "unverified" next to it. Don't fill the gap with something
plausible — a plausible number that's wrong is worse to me than a hole.

## Proof

Never hand me something with "this should work." Run it and show me the output.

## Autonomy

I'm not watching every step. Proceed on anything reversible; stop only for a real
decision.

Decide the defaults yourself rather than asking — materials, timings, palettes,
thresholds. Pick, state the choice in one line, move on. Every question you ask me
is ten minutes I don't get back.

If a requirement forces a bad compromise, flag it in one line and take the best
practical alternative. Don't stall waiting for me.

Give me a one-line update as you go and a short recap at the end.
