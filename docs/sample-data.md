# Synthetic Sample Data

This dataset uses synthetic people and placeholder email addresses.
Expected overdue results below use 29 September 2026 as the business date
in America/Guayaquil. Results based on today's date will change later.

## Record counts

| Table | Records |
|---|---:|
| Candidates | 4 |
| Vacancies | 3 |
| Recruiters | 2 |
| Recruitment Stages | 6 |
| Applications | 4 |
| Stage History | 8 |
| Total | 27 |

Finance Coordinator is Closed and has no applications. Luis Moreno is a
candidate without an application. These records help test cases where a
vacancy or candidate exists independently of an application.

## Applications

| Label | Candidate | Vacancy | Recruiter | Current stage | Follow-up date |
|---|---|---|---|---|---|
| APP-001 | Maya Chen | Data Analyst | Alex Rivera | Screening | 2026-09-28 |
| APP-002 | Maya Chen | HR Operations Specialist | Sam Patel | Applied | 2026-09-29 |
| APP-003 | Jordan Lee | Data Analyst | Alex Rivera | Applied | None |
| APP-004 | Priya Shah | HR Operations Specialist | Sam Patel | Hired | 2026-09-26 |

## Stage history

| Entry | Application | Previous stage | New stage | Entered at (America/Guayaquil) |
|---|---|---|---|---|
| HIST-001 | APP-001 | None | Applied | 2026-09-27 09:00 |
| HIST-002 | APP-001 | Applied | Screening | 2026-09-28 10:00 |
| HIST-003 | APP-002 | None | Applied | 2026-09-29 08:00 |
| HIST-004 | APP-003 | None | Applied | 2026-09-28 11:00 |
| HIST-005 | APP-004 | None | Applied | 2026-09-20 09:00 |
| HIST-006 | APP-004 | Applied | Screening | 2026-09-21 10:00 |
| HIST-007 | APP-004 | Screening | Interview | 2026-09-23 14:00 |
| HIST-008 | APP-004 | Interview | Hired | 2026-09-25 16:00 |

## Expected results

- As of 2026-09-29, APP-001 is overdue by one calendar day.
- APP-002 is due today, APP-003 has no follow-up date, and APP-004 is
  terminal; none of these three is overdue.
- Data Analyst has one application at Screening and one at Applied.
- HR Operations Specialist has one application at Applied and one at Hired.
- For the date range 2026-09-01 inclusive to 2026-10-01 exclusive,
  HR Operations Specialist has one application that entered Hired.

The duplicate candidate–vacancy and closed-vacancy rejection scenarios
require workflow checks; they are not represented by invalid sample records.