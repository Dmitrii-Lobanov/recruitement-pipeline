-- 1. Current pipeline counts by vacancy and stage
SELECT
    v.title AS vacancy,
    s.name AS stage,
    count(*) AS applications
FROM applications a
JOIN vacancies v ON v.airtable_id = a.vacancy_id
JOIN recruitment_stages s ON s.airtable_id = a.current_stage_id
GROUP BY v.title, s.name, s.stage_order
ORDER BY v.title, s.stage_order;

-- 2. Overdue follow-ups in America/Guayaquil
SELECT
    a.application_label,
    c.name AS candidate,
    v.title AS vacancy,
    r.name AS recruiter,
    a.follow_up_date,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')::date
        - a.follow_up_date AS days_overdue
FROM applications a
JOIN candidates c ON c.airtable_id = a.candidate_id
JOIN vacancies v ON v.airtable_id = a.vacancy_id
JOIN recruiters r ON r.airtable_id = a.current_recruiter_id
JOIN recruitment_stages s ON s.airtable_id = a.current_stage_id
WHERE s.type = 'Active'
  AND a.follow_up_date <
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil')::date
ORDER BY a.follow_up_date, a.application_label;

-- 3. Applications entering Hired in September 2026
SELECT
    v.title AS vacancy,
    count(DISTINCT a.airtable_id) AS hires
FROM stage_history h
JOIN applications a ON a.airtable_id = h.application_id
JOIN vacancies v ON v.airtable_id = a.vacancy_id
JOIN recruitment_stages s ON s.airtable_id = h.new_stage_id
WHERE s.name = 'Hired'
  AND h.entered_at >=
      (TIMESTAMP '2026-09-01 00:00:00' AT TIME ZONE 'America/Guayaquil')
  AND h.entered_at <
      (TIMESTAMP '2026-10-01 00:00:00' AT TIME ZONE 'America/Guayaquil')
GROUP BY v.title
ORDER BY v.title;