# Integration Decisions

## Source of truth

Airtable is the source of truth for candidates, vacancies, recruiters,
applications, recruitment stages, and stage history. Recruiters make
operational changes there. Local PostgreSQL holds a copy for SQL reporting;
reports do not change recruitment records.

## Data flow

A manually started transfer reads Airtable records and copies them to
PostgreSQL in one direction: Airtable → PostgreSQL. A successful run
reflects new and changed records in the reporting copy. A run is never
assumed to happen automatically.

## Record identity and repeat runs

Each PostgreSQL record retains the stable identity of its corresponding
Airtable record. On a repeat run, the transfer updates the existing copy
for that identity instead of inserting a duplicate. Two runs with no
Airtable changes must produce the same record counts and values.

## Failures and checks

The transfer reports whether it succeeded and identifies the entity
whose transfer failed. A failed run is not presented as a completed
reporting refresh. After a successful run, compare record counts for each
entity in Airtable and PostgreSQL and check a few known application
stages and history entries.

## Free-plan fit

The current synthetic dataset has 4 candidates, 3 vacancies, 2 recruiters,
6 stages, 5 applications, and 10 stage history entries: 30 records across
the base. Manual transfers keep API usage modest; actual usage should be
checked in Airtable workspace settings.

## Implemented transfer

`src/sync-airtable-to-postgres.mts` reads all pages of the six Airtable
tables. Its field mapping targets the tables defined in `sql/schema.sql`.
Each reporting row uses the Airtable record ID as its primary key, and
the transfer uses `INSERT ... ON CONFLICT DO UPDATE` to copy new and changed
records. Candidates, vacancies, recruiters, and stages are loaded before
applications; stage history is loaded last to satisfy foreign keys.

All PostgreSQL writes occur in one transaction. A database write failure
identifies the table and record, rolls back the run, and leaves the previous
reporting copy intact. After correcting the cause, rerun the manual transfer
and compare table counts and known records with Airtable.

The transfer does not delete PostgreSQL rows when their Airtable records
are deleted. Deletion reconciliation is deferred. n8n remains out of scope
unless a specific need justifies it.
