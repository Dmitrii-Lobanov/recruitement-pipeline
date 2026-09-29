# Airtable Schema

Base: **Recruitment Pipeline — Portfolio**

Airtable is the source of truth for recruitment records. Local PostgreSQL
will hold a reporting copy. Only synthetic HR data will be used.

## Tables and fields

| Table | Field | Airtable type | Purpose |
|---|---|---|---|
| Candidates | Name | Single line text (primary) | Candidate's display name |
| Candidates | Email | Email | Synthetic contact address |
| Vacancies | Title | Single line text (primary) | Vacancy's display name |
| Vacancies | Status | Single select: Open, Closed | Whether new applications may be created |
| Recruiters | Name | Single line text (primary) | Recruiter's display name |
| Recruitment Stages | Name | Single line text (primary) | Stage name |
| Recruitment Stages | Type | Single select: Active, Terminal | Whether the stage is an active step or final outcome |
| Recruitment Stages | Order | Number, 0 decimal places | Display order |
| Applications | Application Label | Single line text (primary) | Human-readable label |
| Applications | Candidate | Link to Candidates; one record | Candidate for this application |
| Applications | Vacancy | Link to Vacancies; one record | Vacancy for this application |
| Applications | Current Recruiter | Link to Recruiters; one record | Current owner |
| Applications | Current Stage | Link to Recruitment Stages; one record | Current position in the pipeline |
| Applications | Follow-up Date | Date, without time | Current optional follow-up date |
| Stage History | History Label | Single line text (primary) | Human-readable label |
| Stage History | Application | Link to Applications; one record | Application whose stage changed |
| Stage History | Previous Stage | Link to Recruitment Stages; one record | Stage before the change; blank for the initial entry |
| Stage History | New Stage | Link to Recruitment Stages; one record | Stage entered |
| Stage History | Entered At | Date with time, America/Guayaquil display time zone | Time the application entered the new stage |

“One record” means a field on one application or history entry links to at
most one record in the referenced table. Many applications can still link
to the same candidate, vacancy, recruiter, or stage. Many history entries
can link to the same application.

Airtable automatically creates reverse link fields in the referenced
tables. These show related applications or history entries; they are the
other side of the links above, not separate relationships.

## Recruitment stage records

| Name | Type | Order |
|---|---|---:|
| Applied | Active | 1 |
| Screening | Active | 2 |
| Interview | Active | 3 |
| Hired | Terminal | 4 |
| Rejected | Terminal | 5 |
| Withdrawn | Terminal | 6 |

## Rules requiring workflow checks

The fields and links represent the data but do not, by themselves,
enforce every business rule. The workflow must check that:

- A candidate–vacancy pair has no existing application before creating one.
- A vacancy is Open before creating an application.
- A new application starts at Applied and receives an initial history entry.
- Stage changes follow the allowed transitions, preserve earlier history,
  and leave Current Stage matching the latest history entry.
- Every application has a candidate, vacancy, current recruiter, and
  current stage; every history entry has an application, new stage, and
  entry timestamp.

Overdue status will be calculated from Current Stage, Follow-up Date, and
today's date in America/Guayaquil. It is not stored as a separate field.