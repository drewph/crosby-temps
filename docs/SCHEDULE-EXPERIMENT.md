# Schedule experiment (27–30 October 2026)

## Goal

Decide whether earlier cron probes make yesterday's frozen snapshot reliably
available for a morning crochet, without freezing values that later change.
The outcome is **one** implementation, not a menu.

## Setup

- Probes: **00:15, 02:15, 04:15, 06:15 UTC** (01:15, 03:15, 05:15, 07:15 BST).
- Four days: **27, 28, 29, 30 October**.
- Each run records 1 January → yesterday and only adds missing dates.
- Review after the 30 October probes have reported — evening of 30 October,
  or morning of 31 October if the last probe was delayed.
- If the branch merges after 26 October, use the first four full days instead.

## What to collect

For each of the four days:

1. **Scheduler**: actual start time of each probe and its delay versus the
   scheduled minute. Note cancellations and failures.
2. **First commit**: when `github-actions[bot]` committed
   `Update temperature snapshot` that day, and which probe first produced it.
3. **Availability**: was yesterday's snapshot available by **07:00 UTC
   (08:00 BST)**? Use the bot commit time, not the probe's scheduled time.
4. **Revisions**: compare the frozen values for 26–29 October with the current
   archive API. Record any change that crosses a 2 °C band.
5. **Noise**: runs and deploys per day.

## How to collect

```sh
# Schedule runs: number, created_at, conclusion
curl -s "https://api.github.com/repos/drewph/crosby-temps/actions/runs?event=schedule&per_page=100"

# Bot commits and their timestamps
curl -s "https://api.github.com/repos/drewph/crosby-temps/commits?per_page=30"

# Steps for a specific run (snapshot, commit, deploy, smoke test)
curl -s "https://api.github.com/repos/drewph/crosby-temps/actions/runs/<id>/jobs"

# Frozen values
curl -s "https://drewph.github.io/crosby-temps/data/2026.json"

# Current archive values for the same dates
curl -s "https://archive-api.open-meteo.com/v1/archive?latitude=54.18031473227185&longitude=-4.54729408020627&timezone=Europe%2FLondon&daily=temperature_2m_max,temperature_2m_min&cell_selection=nearest&start_date=2026-10-26&end_date=2026-10-29"
```

## Decision rule — pick exactly one

### S: Scheduling wins

Choose **S** only if all three are true:

- yesterday was frozen by **07:00 UTC** on **at least 3 of 4 days**;
- no experiment-day value changed band when compared with the API at review;
- at most one probe was cancelled or failed per day.

**Implement S:** keep only the earliest probe that reliably delivers the value
(drop redundant slots), and switch List and Calendar to the **frozen snapshot**
for covered dates. No provisional tail. Year stays frozen.

### P: Provisional wins

Choose **P** for anything else: the data is not available early, early runs
freeze values that later change, or the schedule is too unreliable.

**Implement P:** revert to a single **06:15 UTC** cron, and show the frozen
snapshot for covered dates plus a clearly marked **provisional live tail** for
missing days. Add a “Run workflow now” link to the Actions page. Year stays
frozen-only.

**Do not ship a hybrid.** If the result is genuinely inconclusive — for
example, too few probe runs because GitHub dropped them — extend the
experiment by two days and decide again.

## Limitation

Four days only catches revisions visible by the review. ERA5 finalisation can
take about five days, so a later revision is still possible. If the snapshot
must be final, prefer **P** or a later cron over **S**.

## Review checklist

- [ ] Pull the scheduled-run table and compute delays.
- [ ] Identify the first bot commit each day; record time and probe.
- [ ] Count days frozen by 07:00 UTC.
- [ ] Compare snapshot vs API; count band-level changes.
- [ ] Apply the rule: S or P.
- [ ] Write the result in `docs/HANDOVER.md`; remove the losing schedule or probes.
- [ ] Implement the chosen branch as one PR with tests and screenshots.
