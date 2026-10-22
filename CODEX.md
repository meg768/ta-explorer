# CODEX

This file is the version-controlled source of truth for project context.

## Purpose

`ta-explorer` is a standalone CLI laboratory for discovering and normalizing
data exposed by Tennis Abstract. It must not depend on Vitel, `atp-tennis`, or
MariaDB. Stable discoveries may later be deliberately transferred into the
backend-owned contract in `atp-tennis`.

Tennis Abstract is treated as the source of truth for current tournament draws,
results, upcoming matchups, and forecasts. The CLI may understand TA HTML;
production clients must not.

## Runtime

- Node.js 20 or newer
- ESM
- `yargs` for commands and options
- `dotenv` for local configuration
- `cheerio` for HTML fragments and tables
- native `fetch` for HTTP
- native Node test runner

## Current commands

- `ta current` discovers current ATP tournaments.
- `ta inspect <url>` inventories page primitives without assuming a schema.
- `ta tournament <name-or-url>` parses the main draw, current forecast,
  upcoming matches, and completed matches.
- `ta rankings` parses TA's weekly official ATP ranking and returns the top 100
  by default. Each row retains rank, name, country, birthdate, TA player id,
  and source URL; `--top N` changes the requested count.
- `ta report list` inventories a curated ATP-singles-only report catalog;
  `ta report show <name>` normalizes a report into tables.
- `ta player <action> <name-or-id>` returns profile metadata and named views.
  `ta player export <player> --all --json` is the complete player export.
- Add `--json` to any data command for normalized machine-readable output.

## Design rules

- Keep fetching, parsing, and terminal presentation separate.
- Default output is optimized for a human at a terminal; `--json` is the stable
  composition boundary for scripts.
- Parser tests use local HTML fixtures and must not require network access.
- Live smoke tests are useful but remain separate from the deterministic suite.
- Preserve raw TA meaning. Do not silently relabel rounds or probabilities.
- Prefer explicit parser failures or missing values over invented data.

## Changelog

- 2026-07-22: Added generic report and player-fragment parsers plus `reports`,
  `report`, and `player` commands. The curated surface covers ATP rankings/Elo,
  demographics, milestones, surface speed, leaderboards, Match Charting,
  head-to-heads, forecasts, and player-specific results and statistics while
  excluding WTA, doubles, and Challenger-only sections.

- 2026-07-22: Added `ta rankings`, using TA's simple official ATP rankings
  table at `/reports/atpRankings.html`. The command defaults to 100 players,
  supports `--top N` and `--json`, and includes the page's last-update date.

- 2026-07-22: Created the Node/ESM CLI with `yargs`, `dotenv`, and `cheerio`.
  Added `current`, `inspect`, and `tournament`, human and JSON output, local
  fixtures, and parser/CLI tests. Live verification found Kitzbuhel and Estoril;
  Kitzbuhel parsed as a 28-player draw with 16 current forecasts, eight upcoming
  matches, and 24 completed matches.
