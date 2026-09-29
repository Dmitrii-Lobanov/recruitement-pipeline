BEGIN;

CREATE TABLE IF NOT EXISTS candidates (
    airtable_id text PRIMARY KEY,
    name text NOT NULL,
    email text
);

CREATE TABLE IF NOT EXISTS vacancies (
    airtable_id text PRIMARY KEY,
    title text NOT NULL,
    status text NOT NULL CHECK (status IN ('Open', 'Closed'))
);

CREATE TABLE IF NOT EXISTS recruiters (
    airtable_id text PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS recruitment_stages (
    airtable_id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    type text NOT NULL CHECK (type IN ('Active', 'Terminal')),
    stage_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
    airtable_id text PRIMARY KEY,
    application_label text NOT NULL UNIQUE,
    candidate_id text NOT NULL REFERENCES candidates (airtable_id),
    vacancy_id text NOT NULL REFERENCES vacancies (airtable_id),
    current_recruiter_id text NOT NULL REFERENCES recruiters (airtable_id),
    current_stage_id text NOT NULL REFERENCES recruitment_stages (airtable_id),
    follow_up_date date,
    UNIQUE (candidate_id, vacancy_id)
);

CREATE TABLE IF NOT EXISTS stage_history (
    airtable_id text PRIMARY KEY,
    history_label text NOT NULL UNIQUE,
    application_id text NOT NULL REFERENCES applications (airtable_id),
    previous_stage_id text REFERENCES recruitment_stages (airtable_id),
    new_stage_id text NOT NULL REFERENCES recruitment_stages (airtable_id),
    entered_at timestamptz NOT NULL,
    CHECK (previous_stage_id IS NULL OR previous_stage_id <> new_stage_id)
);

COMMIT;