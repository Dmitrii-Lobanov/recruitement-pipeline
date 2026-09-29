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

The initial synthetic dataset will contain approximately 10 candidates,
3 vacancies, 2 recruiters, 6 stages, 12 applications, and 30 stage
history entries: 63 records across the base. This is below Airtable
Free's 1,000-record-per-base limit. Manual transfers of this small
dataset should also stay below the 1,000-API-calls-per-workspace monthly
limit; actual usage will be checked in workspace settings.

## Decisions deferred

The exact transfer tool, field mapping, treatment of deleted Airtable
records, and recovery steps after a failed transfer will be decided
before implementing the transfer. n8n will be introduced only if a
specific need justifies it.