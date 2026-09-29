# Recruitment Pipeline — Conceptual Data Model

## 1. Entities

| Entity | Meaning | Business information |
|---|---|---|
| Candidate | A person considered for vacancies | Name and synthetic contact details |
| Vacancy | A position accepting applications | Title and open/closed status |
| Recruiter | A person responsible for applications | Name |
| Application | One candidate's consideration for one vacancy | Candidate, vacancy, current recruiter, current stage, optional follow-up date |
| Recruitment Stage | A shared definition of a recruitment step or outcome | Name and whether it is terminal |
| Stage History Entry | A record of an application entering a stage | Application, previous stage if any, new stage, and event timestamp |

## 2. Relationships

- A candidate can have zero or many applications.
  Every application belongs to exactly one candidate.
- A vacancy can have zero or many applications.
  Every application belongs to exactly one vacancy.
- A recruiter can own zero or many applications.
  Every application has exactly one current recruiter.
- A recruitment stage can be the current stage of zero or many applications.
  Every application has exactly one current stage.
- An application has one or many stage history entries.
  Every history entry belongs to exactly one application.
- Every history entry references exactly one new stage.
  A stage can appear as the new stage in zero or many history entries.
- Every history entry references zero or one previous stage.
  A stage can appear as the previous stage in zero or many history entries.

Candidates and vacancies have a many-to-many relationship through
applications. Each candidate–vacancy pair can have only one application.

## 3. Stages and history

Active stages: Applied, Screening, Interview.
Terminal stages: Hired, Rejected, Withdrawn.

Forward progression is Applied → Screening → Interview → Hired.
Any active stage may transition to Rejected or Withdrawn.
Terminal stages have no outgoing transitions.

The initial history entry has no previous stage and records Applied as
the new stage. Subsequent entries record both previous and new stages.

Earlier history is preserved. Each subsequent entry's previous stage
must match the preceding entry's new stage. The application's current
stage must match the latest history entry's new stage.

## 4. Current information and derived information

The application holds its current recruiter and optional follow-up date.
Ownership history and follow-up history are outside scope.

Overdue status is calculated, not a separate business entity:
the application is active, has a follow-up date, and that date is earlier
than today in America/Guayaquil.

Pipeline counts use each application's current stage.
Hire counts use the timestamp of the history entry entering Hired.

The recruitment lead is a business role, not a separate entity for this
project, because accounts and access controls are outside scope.

## 5. Worked example

Candidate Maya Chen applies to two open vacancies: Data Analyst and
HR Operations Specialist. Recruiter Alex owns the Data Analyst
application; recruiter Sam owns the HR Operations Specialist application.

The Data Analyst application was created at Applied and later moved to
Screening. Its current stage is Screening. Its history contains an
initial entry into Applied and a later entry from Applied to Screening.

The HR Operations Specialist application remains at Applied. Its
history contains one initial entry into Applied.

These are two separate applications for the same candidate, so they can
have different owners, stages, and follow-up dates. Creating another
application for Maya and the Data Analyst vacancy would violate BR-01,
even if the existing application later reached a terminal stage.

## 6. Requirements coverage

| Rule | How the model supports it |
|---|---|
| BR-01 | Application connects one candidate to one vacancy. The candidate–vacancy pair must be unique, including when the application is terminal. |
| BR-02 | Every application belongs to one candidate and one vacancy and has one current recruiter. |
| BR-03 | Vacancy has an open or closed status. Creating an application requires checking that the vacancy is open; closing it does not change existing applications. |
| BR-04 | Each application has one current stage. The stage transition rules define allowed moves and prohibit moves from terminal stages. |
| BR-05 | Each application has stage history entries. The initial entry records Applied; later entries record the previous stage, new stage, and timestamp. The current stage must match the latest entry. |
| BR-06 | Application has an optional current follow-up date. Overdue status is calculated using that date, the current stage, and today's date in America/Guayaquil. |
| BR-07 | A missing follow-up date or terminal stage excludes an application from overdue results. Replacing or clearing the date changes its current value; earlier dates are not tracked. |
| BR-08 | Application has one current recruiter, who can be reassigned. Reports use the current owner; previous owners are not tracked. |