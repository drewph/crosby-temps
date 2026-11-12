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

- [x] Pull the scheduled-run table and compute delays.
- [x] Identify the first bot commit each day; record time and probe.
- [x] Count days frozen by 07:00 UTC.
- [x] Compare snapshot vs API; count band-level changes.
- [x] Apply the rule: S or P.
- [x] Write the result in `docs/HANDOVER.md`; remove the losing schedule or probes.
- [x] Implement the chosen branch as one PR with tests and screenshots.

## Outcome (reviewed 12 November 2026)

Decision: **P — provisional tail.**

| Date | Probe starts (UTC) | First bot commit | Delay vs 00:15 slot | Frozen by 07:00 UTC |
|---|---|---|---|---|
| 27 Oct | 05:10, 07:44, 09:47, 12:11 | 05:10 | +4h55 | yes |
| 28 Oct | 05:46, 08:22, 10:32, 12:54 | 05:46 | +5h31 | yes |
| 29 Oct | 05:52, 08:24, 10:51, 13:00 | 05:52 | +5h37 | yes |
| 30 Oct | 05:53, 08:33, 10:50, 12:55 | 05:53 | +5h38 | yes |

- **Scheduler:** 4/4 days frozen before 07:00 UTC, and all 16 runs succeeded with no
  cancellations, so the two scheduler conditions for **S** were met.
- **Revisions at review:** the four values frozen during the window (26–29 Oct)
  matched the archive exactly, so **S** also passed the band check on the day.
- **Revisions since:** 30 Oct min 10.9 → 10.4 and 1 Nov min 6.9 → 6.3. Both moved one
  band, i.e. the inner square changes colour. Across 25 Oct–11 Nov (18 days frozen
  within a day of the date) 2/18 ≈ 11% of days changed colour. ERA5 finalisation did
  this, and it was invisible on 30–31 October as the limitation predicted.
- **Availability drift:** from 31 Oct to 12 Nov only 10/13 days were frozen by 07:00
  UTC — 9 Nov at 09:40 (the first run failed in the snapshot step), 10 Nov at 07:23 and
  12 Nov at 07:16. The 00:15 probe landed anywhere between 05:10 and 07:16, so the
  slot does not guarantee the 08:00 BST target.
- **Noise:** four workflow runs and four deploys per day, against one baseline.

**Why P:** the goal was morning availability *without* freezing values that later
change. **S** could not promise the second half, and the 11% colour churn is visible
to a crocheter who has already worked the row. **P** keeps one canonical freeze and
makes the wait explicit.

Implemented: single 06:15 UTC cron; List and Calendar show the frozen snapshot plus a
provisional live tail; every provisional day is labelled in the list, the calendar and
the day sheet; a “Run workflow now” link appears in the provisional notice and the
footer; Year stays frozen-only.
