# Recruitment Pipeline

A small recruitment workflow using Airtable as the operational source of truth and local PostgreSQL as a reporting copy. It tracks applications, stage changes, follow-ups, and hiring activity using synthetic data.

## What it does

- Creates one application per candidate–vacancy pair, only for an open vacancy.
- Starts each application at Applied and records its initial stage history.
- Allows defined stage transitions while preserving earlier history entries.
- Lists overdue follow-ups for active applications using the business date in `America/Guayaquil`.
- Copies Airtable records to PostgreSQL for three SQL reports: pipeline counts, overdue follow-ups, and hires in a date range.

Use the interactive command-line app to manage recruitment records. Airtable remains the source of truth; PostgreSQL is used for reporting.

## Data model

The six entities are Candidates, Vacancies, Recruiters, Recruitment Stages, Applications, and Stage History. Every application links one candidate, one vacancy, one current recruiter, and one current stage. Its stage history records each entry into a stage.

See [the data model](docs/data-model.md), [Airtable schema](docs/airtable-schema.md), and [sample data](docs/sample-data.md) for fields, relationships, rules, and example records.

## Requirements

This project was run with Node.js 24.17 and PostgreSQL 17. You also need access to an Airtable base configured according to `docs/airtable-schema.md` and an Airtable personal access token with the required read and write permissions for that base.

Install Node dependencies:

```bash
npm ci
```

Create a local `.env` file containing:

```dotenv
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TOKEN=your_personal_access_token
```

`.env` and `node_modules/` are ignored by Git. Do not commit credentials.

## Use the app

From the project directory, run:

```bash
npm start
```

Type a menu number and press Enter. The app lists records so you can select candidates, vacancies, recruiters, and applications by number; you do not need to look up Airtable record IDs.

For example, choose `10` to create an application. Select a candidate, an open vacancy, and a recruiter. At the final prompt, type **`YES`** and press Enter to save it. Any other response cancels the operation. Choose `1` afterward to verify that the application appears.

Use `11` to change an application's stage, `12` to set or clear a follow-up date, and `14` to show overdue follow-ups. Options `4`–`9` manage candidates, vacancies, and recruiters; `2` shows an application's stage history; `13` reassigns its recruiter. Choose `0` to exit.

Choose `15` to copy Airtable data to PostgreSQL, then `16` to run the SQL reports. Set up PostgreSQL as described below before using these options. If an application or stage write reports an uncertain result, choose `17` to retry it with the same labels.

## Set up PostgreSQL

Start your local PostgreSQL server and create the reporting database:

```bash
createdb recruitment_pipeline
psql -X -v ON_ERROR_STOP=1 -d recruitment_pipeline -f sql/schema.sql
```

If the database already exists, skip `createdb`. The schema file can be run again without recreating its tables.

The transfer uses the database name `recruitment_pipeline` and the PostgreSQL socket at `/tmp` by default. Set `PGDATABASE` or `PGHOST` in your environment if your local setup differs.

## Check and transfer data

Type-check the TypeScript files:

```bash
npx tsc -p .
```

Copy the current Airtable records to PostgreSQL:

```bash
node --env-file=.env src/sync-airtable-to-postgres.mts
```

The transfer reads all Airtable pages, then writes the six tables in dependency order inside one PostgreSQL transaction. It uses Airtable record IDs as keys and updates matching rows on repeat runs. If a database write fails, the transaction rolls back.

Run the same transfer command again to verify a repeat run. The original documented sample has 4 candidates, 3 vacancies, 2 recruiters, 6 stages, 5 applications, and 10 history entries. Counts will increase as you create records through the app.

## Run reports

```bash
psql -X -P pager=off -v ON_ERROR_STOP=1 -d recruitment_pipeline -f sql/reports.sql
```

The reports show:

1. Current application counts by vacancy and stage.
2. Overdue active applications, with candidate, vacancy, recruiter, follow-up date, and calendar days overdue.
3. Applications entering Hired during September 2026.

For the sample data on **2026-09-29** in `America/Guayaquil`, Data Analyst has two Applied applications and one Interview application; HR Operations Specialist has one Applied and one Hired application. APP-001 is one day overdue, and one HR Operations Specialist application entered Hired in September.

The overdue SQL report uses the current business date, so its result changes over time. The hire report currently uses a fixed September 2026 date range; edit its two boundaries to report another range.

## Workflow code

- `src/create-application.mts` checks the candidate–vacancy pair and vacancy status, creates an application at Applied, and records initial history.
- `src/plan-stage-change.mts` checks a proposed stage change without writing.
- `src/change-stage.mts` checks the transition, records stage history, and updates the application’s current stage. Reuse the same history label when retrying an uncertain result.
- `src/list-overdue-followups.mts` reads Airtable and calculates overdue follow-ups without changing records.

The interactive menu is in `src/cli.mts`. It resolves menu selections to Airtable record IDs before calling the workflow functions. The stage rules are in `src/stage-rules.mts`.

## Current limits

- Airtable base setup and transfers are manual; there is no scheduled sync or web interface.
- Workflow checks assume a single operator. Airtable does not provide a transaction across the history and application writes, so the stage-change helper includes retry and conflict checks but does not guarantee atomic updates under concurrent writers.
- The PostgreSQL transfer inserts and updates records. It does not remove PostgreSQL rows when their Airtable records are deleted.
- Application creation currently fails closed if the Airtable Applications list has more than one page; that workflow needs pagination before scaling past 100 applications.
- All included candidate data is synthetic.

See [requirements](docs/requirements.md) and [integration decisions](docs/integration-decisions.md) for the intended scope and design decisions.
