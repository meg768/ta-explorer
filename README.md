# ta-explorer

CLI for exploring data available from Tennis Abstract.

The command structure is built with `yargs`, and configuration is loaded with
`dotenv`.

## Setup

```bash
npm install
npm link
```

The package exposes the command `ta`:

```bash
ta --help
ta --version
ta current
ta inspect https://www.tennisabstract.com/current/2026ATPKitzbuhel.html
ta tournament list
ta tournament show Kitzbuhel --json
ta rankings
ta rankings --top 25
ta rankings --json
ta report list
ta report show elo --limit 25
ta player show JannikSinner
ta player h2h Sinner --json
ta player export "Jannik Sinner" --all --json
```

Configuration is loaded from `.env` through `dotenv`. Available variables are
documented in `.env.example`.

## Commands

- `ta current` lists current ATP tournaments discovered on the TA home page.
- `ta inspect <url>` inventories JavaScript variables, tables, player links,
  tournament links, and response size without assuming a page schema.
- `ta tournament list` lists current ATP events; `tournament show <name-or-url>`
  parses the main draw, current round and title
  probabilities, upcoming matches, and completed matches.
- `ta rankings` shows TA's weekly official ATP ranking. It returns the top 100
  by default; use `--top N` to select another count.
- `ta report list` lists the curated ATP singles reports understood by the CLI.
- `ta report show <name>` fetches a report such as Elo and surface ratings, ranking
  milestones, country/age/handedness lists, surface speed,
  Match Charting data, head-to-head matrices, and forecasts. `--limit 0` keeps
  every row.
- `ta player <action> <name-or-id>` supports `show`, `results`, `seasons`,
  `surfaces`, `events`, `rankings`, `h2h`, `performance`, `charting`, and
  `export`. `ta player export Sinner --all --json` is the broad player export.
  Full names and TA ids are accepted; an unambiguous surname such as `Sinner`
  or prefix such as `sinne` is resolved against the current ATP ranking before
  the historical index. Ambiguous searches return candidate names.

The catalog intentionally excludes WTA, doubles, and Challenger-only data.

All commands support human-readable output by default. Add `--json` to a
command when its normalized result should be piped to another tool.

The earlier short forms remain accepted for compatibility, but help and
documentation use the `resource action target` form.
