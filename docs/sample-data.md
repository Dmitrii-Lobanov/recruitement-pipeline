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
| Applications | 5 |
| Stage History | 10 |
| Total | 30 |

Finance Coordinator is Closed and has no applications. This record helps test
the rule that new applications require an open vacancy.

## Applications

| Label | Candidate | Vacancy | Recruiter | Current stage | Follow-up date |
|---|---|---|---|---|---|
| APP-001 | Maya Chen | Data Analyst | Alex Rivera | Interview | 2026-09-28 |
| APP-002 | Maya Chen | HR Operations Specialist | Sam Patel | Applied | 2026-09-29 |
| APP-003 | Jordan Lee | Data Analyst | Alex Rivera | Applied | None |
| APP-004 | Priya Shah | HR Operations Specialist | Sam Patel | Hired | 2026-09-26 |
| APP-005 | Luis Moreno | Data Analyst | Alex Rivera | Applied | None |

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
| HIST-009 | APP-001 | Screening | Interview | 2026-09-29 13:28 |
| HIST-010 | APP-005 | None | Applied | 2026-09-29 13:47 |

## Expected results

- As of 2026-09-29, APP-001 is overdue by one calendar day.
- APP-002 is due today, APP-003 and APP-005 have no follow-up date, and
  APP-004 is terminal; none of these four is overdue.
- Data Analyst has one application at Interview and two at Applied.
- HR Operations Specialist has one application at Applied and one at Hired.
- For the date range 2026-09-01 inclusive to 2026-10-01 exclusive,
  HR Operations Specialist has one application that entered Hired.

The duplicate candidate–vacancy and closed-vacancy rejection scenarios
require workflow checks; they are not represented by invalid sample records.
