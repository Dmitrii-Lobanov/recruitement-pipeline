# Recruitment Pipeline — Business Requirements

## 1. Problem and objective

Recruiters need a consistent way to track applications, understand their
current status, and identify follow-ups requiring attention.

The project will record application ownership, preserve stage history,
highlight overdue follow-ups, and support basic recruitment analytics.
Success means the acceptance scenarios below can be demonstrated using
synthetic data.

## 2. Users and responsibilities

- Recruiters maintain candidates and applications, record stage changes,
  and manage follow-up dates for their assigned applications.
- A recruitment lead maintains vacancies and recruiter assignments and
  reviews pipeline reports.

These responsibilities describe the workflow; user accounts and access
controls are outside this project's scope.

## 3. Scope

### In scope

- Candidates and their basic synthetic contact details.
- Vacancies and whether they are open or closed.
- Recruiters and application ownership.
- Applications connecting candidates to vacancies.
- Recruitment stages and timestamped stage history.
- One current follow-up date per application.
- An overdue follow-up list and basic SQL recruitment analytics.

### Out of scope

Interview scheduling, real emails, CV storage, offer generation,
authentication, AI scoring, and production hosting.

## 4. Recruitment workflow

A recruiter creates a candidate or selects an existing candidate, then
creates an application for an open vacancy and assigns its owner.

The application starts at Applied and can progress through Screening and
Interview to Hired. An active application can instead end as Rejected or
Withdrawn. Interview is a tracking stage only; scheduling is excluded.

Applied, Screening, and Interview are active stages. Hired, Rejected, and
Withdrawn are terminal stages. Recruiters update follow-up dates as work
progresses. Every stage entry is preserved in history.

## 5. Business rules

- BR-01: A candidate may apply to multiple vacancies. Only one application
  per candidate and vacancy pair is allowed, including terminal applications.
- BR-02: Every application must reference one candidate, one vacancy, and
  exactly one responsible recruiter.
- BR-03: New applications are allowed only for open vacancies. Closing a
  vacancy does not automatically change its existing applications.
- BR-04: Every application starts at Applied. Forward progression is
  Applied → Screening → Interview → Hired. Any active stage may transition
  to Rejected or Withdrawn. Skipping stages, backward moves, and reopening
  terminal applications are excluded.
- BR-05: Creation records the initial stage and entry timestamp. Each
  subsequent stage change records the previous stage, new stage, and change
  timestamp without overwriting earlier history. The current stage must
  match the latest history entry.
- BR-06: Each application may have one current follow-up date. An active
  application is overdue when that date is earlier than today's date in
  America/Guayaquil. A follow-up due today is not overdue.
- BR-07: Applications without a follow-up date and terminal applications
  are never overdue. Recruiters may replace or clear the current follow-up
  date; follow-up history is outside scope.
- BR-08: Recruiters may reassign application ownership. Reports and overdue
  lists use the current owner; ownership history is outside scope.

## 6. Reporting questions

1. How many applications are currently in each stage, grouped by vacancy?
   Count applications, not distinct candidates, including terminal stages.
2. Which applications have overdue follow-ups?
   Show candidate, vacancy, current recruiter, follow-up date, and calendar
   days overdue, ordered by oldest follow-up date first.
3. How many applications entered Hired during a selected date range,
   grouped by vacancy?
   Use the Hired history timestamp and an inclusive start and exclusive end
   boundary, interpreted in America/Guayaquil.

## 7. Acceptance scenarios

### A. Create an application

Given a candidate, an open vacancy, and a recruiter,
when an application is created,
then it has that recruiter as owner, starts at Applied, and has an initial
Applied history entry. A second application for the same pair is refused.

### B. Preserve stage history

Given an application at Applied,
when it moves to Screening,
then its current stage is Screening, the original history entry remains,
and a timestamped Applied-to-Screening change is recorded.

### C. Identify an overdue follow-up

Given an application at Screening with a follow-up date of 2026-09-28,
when the business date is 2026-09-29 in America/Guayaquil,
then it appears in the overdue list with one calendar day overdue.

### D. Exclude applications that are not overdue

Given today's business date,
when the overdue list is generated,
then it excludes active applications due today or without a follow-up date,
and terminal applications even when their follow-up dates are in the past.

## 8. Constraints and open questions

Use synthetic HR data only, Airtable Free, and local PostgreSQL, with a
total tool budget of $0. Introduce n8n only if a demonstrated need justifies
it. The entire three-project portfolio must fit within two hours per day
for one month.

Before integration, decide which system owns each kind of data, how data
moves between systems, and how repeated transfers avoid duplicates.
Confirm that the planned sample size fits the available free-tier limits.
