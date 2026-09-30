import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { changeStage } from "./change-stage.mts";
import { createApplication } from "./create-application.mts";
import { isRecord } from "./is-record.mts";
import { listOverdueFollowUps } from "./list-overdue-followups.mts";
import { planStageChange } from "./plan-stage-change.mts";
import { STAGES } from "./stage-rules.mts";

type AirtableRow = {
  id: string;
  fields: Record<string, unknown>;
};

const baseId = process.env.AIRTABLE_BASE_ID;
const token = process.env.AIRTABLE_TOKEN;

if (!baseId || !token) {
  throw new Error("Set AIRTABLE_BASE_ID and AIRTABLE_TOKEN in .env");
}

const prompt = createInterface({ input: stdin, output: stdout });
const apiRoot = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}`;

let lastRetry:
  | { description: string; run: () => Promise<unknown> }
  | undefined;

function field(row: AirtableRow, name: string): string {
  const value = row.fields[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`${row.id} is missing ${name}`);
  }
  return value;
}

function link(row: AirtableRow, name: string): string {
  const value = row.fields[name];
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== "string"
  ) {
    throw new Error(`${row.id} must have exactly one ${name} link`);
  }
  return value[0];
}

function optionalLink(row: AirtableRow, name: string): string | undefined {
  return row.fields[name] === undefined ? undefined : link(row, name);
}

function nameFor(
  rows: AirtableRow[],
  id: string,
  fieldName: string,
): string {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error(`Missing linked record ${id}`);
  return field(row, fieldName);
}

async function list(table: string): Promise<AirtableRow[]> {
  const rows: AirtableRow[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${apiRoot}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Cannot list ${table}: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.records)) {
      throw new Error(`Invalid ${table} response`);
    }

    for (const item of data.records) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !isRecord(item.fields)
      ) {
        throw new Error(`Invalid ${table} record`);
      }
      rows.push({ id: item.id, fields: item.fields });
    }

    if (data.offset !== undefined && typeof data.offset !== "string") {
      throw new Error(`Invalid ${table} page offset`);
    }
    offset = data.offset;
  } while (offset);

  return rows;
}

async function save(
  table: string,
  method: "POST" | "PATCH",
  fields: Record<string, unknown>,
  recordId?: string,
): Promise<string> {
  const path = recordId
    ? `${encodeURIComponent(table)}/${encodeURIComponent(recordId)}`
    : encodeURIComponent(table);

  const response = await fetch(`${apiRoot}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`${table} ${method} failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.id !== "string") {
    throw new Error(`${table} returned an invalid saved record`);
  }
  return data.id;
}

async function required(question: string): Promise<string> {
  const answer = (await prompt.question(question)).trim();
  if (!answer) throw new Error("A value is required");
  return answer;
}

async function confirm(message: string): Promise<boolean> {
  const answer = await prompt.question(`${message} Type YES to continue: `);
  return answer.trim() === "YES";
}

async function choose(
  rows: AirtableRow[],
  label: (row: AirtableRow) => string,
  question: string,
): Promise<AirtableRow | undefined> {
  if (rows.length === 0) {
    console.log("No records available.");
    return undefined;
  }

  rows.forEach((row, index) => {
    console.log(`${index + 1}. ${label(row)}`);
  });

  const answer = (await prompt.question(`${question} (0 cancels): `)).trim();
  if (answer === "0" || answer === "") return undefined;

  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
    throw new Error("Choose a number shown in the list");
  }
  return rows[index];
}

function nextCode(
  rows: AirtableRow[],
  fieldName: string,
  prefix: string,
): string {
  let highest = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)\\b`);

  for (const row of rows) {
    const value = row.fields[fieldName];
    if (typeof value !== "string") continue;
    const match = value.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

async function retryable(
  description: string,
  run: () => Promise<unknown>,
): Promise<void> {
  if (!(await confirm(description))) return;
  lastRetry = { description, run };
  console.log(await run());
  lastRetry = undefined;
}

async function listApplications(): Promise<void> {
  const [apps, candidates, vacancies, recruiters, stages] =
    await Promise.all([
      list("Applications"),
      list("Candidates"),
      list("Vacancies"),
      list("Recruiters"),
      list("Recruitment Stages"),
    ]);

  console.table(
    apps.map((app) => ({
      application: field(app, "Application Label"),
      candidate: nameFor(candidates, link(app, "Candidate"), "Name"),
      vacancy: nameFor(vacancies, link(app, "Vacancy"), "Title"),
      recruiter: nameFor(
        recruiters,
        link(app, "Current Recruiter"),
        "Name",
      ),
      stage: nameFor(stages, link(app, "Current Stage"), "Name"),
      followUp: app.fields["Follow-up Date"] ?? "",
    })),
  );
}

async function viewHistory(): Promise<void> {
  const apps = await list("Applications");
  const app = await choose(
    apps,
    (row) => field(row, "Application Label"),
    "Application",
  );
  if (!app) return;

  const [history, stages] = await Promise.all([
    list("Stage History"),
    list("Recruitment Stages"),
  ]);

  const entries = history
    .filter((row) => link(row, "Application") === app.id)
    .sort(
      (a, b) =>
        Date.parse(field(a, "Entered At")) -
        Date.parse(field(b, "Entered At")),
    );

  console.log(`\n${field(app, "Application Label")}`);
  for (const entry of entries) {
    const previousId = optionalLink(entry, "Previous Stage");
    const previous = previousId
      ? nameFor(stages, previousId, "Name")
      : "Start";
    const next = nameFor(stages, link(entry, "New Stage"), "Name");
    const enteredAt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Guayaquil",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(field(entry, "Entered At")));

    console.log(`${previous} → ${next} | ${enteredAt}`);
  }
}

async function listPeopleAndVacancies(): Promise<void> {
  for (const [table, labelName] of [
    ["Candidates", "Name"],
    ["Vacancies", "Title"],
    ["Recruiters", "Name"],
  ] as const) {
    const rows = await list(table);
    console.log(`\n${table}`);
    rows.forEach((row) => {
      const status =
        table === "Vacancies" ? ` — ${row.fields["Status"]}` : "";
      console.log(`- ${field(row, labelName)}${status}`);
    });
  }
}

async function addCandidate(): Promise<void> {
  const name = await required("Candidate name: ");
  const email = await required("Synthetic email: ");
  if (!(await confirm(`Create candidate ${name}?`))) return;
  console.log("Created:", await save("Candidates", "POST", {
    Name: name,
    Email: email,
  }));
}

async function editCandidate(): Promise<void> {
  const row = await choose(
    await list("Candidates"),
    (item) => field(item, "Name"),
    "Candidate",
  );
  if (!row) return;

  const name = (await prompt.question("New name (Enter keeps current): ")).trim();
  const email = (
    await prompt.question("New email (Enter keeps current): ")
  ).trim();
  const fields: Record<string, unknown> = {};
  if (name) fields.Name = name;
  if (email) fields.Email = email;
  if (Object.keys(fields).length === 0) return;

  if (!(await confirm("Update this candidate?"))) return;
  console.log("Updated:", await save("Candidates", "PATCH", fields, row.id));
}

async function addVacancy(): Promise<void> {
  const title = await required("Vacancy title: ");
  if (!(await confirm(`Create open vacancy ${title}?`))) return;
  console.log("Created:", await save("Vacancies", "POST", {
    Title: title,
    Status: "Open",
  }));
}

async function editVacancy(): Promise<void> {
  const row = await choose(
    await list("Vacancies"),
    (item) => `${field(item, "Title")} — ${field(item, "Status")}`,
    "Vacancy",
  );
  if (!row) return;

  const title = (
    await prompt.question("New title (Enter keeps current): ")
  ).trim();
  const status = (
    await prompt.question(
      "New status: Open / Closed (Enter keeps current): ",
    )
  ).trim();

  if (status && status !== "Open" && status !== "Closed") {
    throw new Error("Status must be Open or Closed");
  }

  const fields: Record<string, unknown> = {};
  if (title) fields.Title = title;
  if (status) fields.Status = status;
  if (Object.keys(fields).length === 0) return;

  if (!(await confirm("Update this vacancy?"))) return;
  console.log("Updated:", await save("Vacancies", "PATCH", fields, row.id));
}

async function addRecruiter(): Promise<void> {
  const name = await required("Recruiter name: ");
  if (!(await confirm(`Create recruiter ${name}?`))) return;
  console.log("Created:", await save("Recruiters", "POST", {
    Name: name,
  }));
}

async function editRecruiter(): Promise<void> {
  const row = await choose(
    await list("Recruiters"),
    (item) => field(item, "Name"),
    "Recruiter",
  );
  if (!row) return;

  const name = await required("New recruiter name: ");
  if (!(await confirm("Update this recruiter?"))) return;
  console.log(
    "Updated:",
    await save("Recruiters", "PATCH", { Name: name }, row.id),
  );
}

async function addApplication(): Promise<void> {
  const candidate = await choose(
    await list("Candidates"),
    (row) => field(row, "Name"),
    "Candidate",
  );
  if (!candidate) return;

  const vacancy = await choose(
    (await list("Vacancies")).filter(
      (row) => row.fields["Status"] === "Open",
    ),
    (row) => field(row, "Title"),
    "Open vacancy",
  );
  if (!vacancy) return;

  const recruiter = await choose(
    await list("Recruiters"),
    (row) => field(row, "Name"),
    "Recruiter",
  );
  if (!recruiter) return;

  const apps = await list("Applications");
  if (
    apps.some(
      (app) =>
        link(app, "Candidate") === candidate.id &&
        link(app, "Vacancy") === vacancy.id,
    )
  ) {
    console.log("This candidate already has an application for that vacancy.");
    return;
  }

  const appCode = nextCode(apps, "Application Label", "APP");
  const historyCode = nextCode(
    await list("Stage History"),
    "History Label",
    "HIST",
  );

  const applicationLabel =
    `${appCode} — ${field(candidate, "Name")} — ${field(vacancy, "Title")}`;
  const historyLabel = `${historyCode} — ${appCode} — Applied`;

  const request = {
    baseId,
    token,
    candidateId: candidate.id,
    vacancyId: vacancy.id,
    recruiterId: recruiter.id,
    applicationLabel,
    historyLabel,
    enteredAt: new Date(),
  };

  await retryable(
    `Create ${applicationLabel} with ${historyLabel}?`,
    () => createApplication(request),
  );
}

async function moveStage(): Promise<void> {
  const app = await choose(
    await list("Applications"),
    (row) => field(row, "Application Label"),
    "Application",
  );
  if (!app) return;

  const selected = await choose(
    STAGES.map((name) => ({ id: name, fields: { Name: name } })),
    (row) => field(row, "Name"),
    "Next stage",
  );
  if (!selected) return;
  const nextStage = selected.id as (typeof STAGES)[number];

  const plan = await planStageChange(baseId, token, app.id, nextStage);
  console.log(plan);
  if (!plan.allowed) {
    console.log("This transition is not allowed. Nothing was changed.");
    return;
  }

  const historyCode = nextCode(
    await list("Stage History"),
    "History Label",
    "HIST",
  );
  const appCode = field(app, "Application Label").split(" — ")[0];
  const historyLabel = `${historyCode} — ${appCode} — ${nextStage}`;

  await retryable(
    `Move ${plan.applicationLabel} to ${nextStage}?`,
    () =>
      changeStage({
        baseId,
        token,
        applicationId: app.id,
        nextStage,
        historyLabel,
        enteredAt: new Date(),
      }),
  );
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

async function setFollowUp(): Promise<void> {
  const app = await choose(
    await list("Applications"),
    (row) =>
      `${field(row, "Application Label")} — ` +
      `${row.fields["Follow-up Date"] ?? "no date"}`,
    "Application",
  );
  if (!app) return;

  const answer = (
    await prompt.question("Date YYYY-MM-DD, or CLEAR: ")
  ).trim();

  if (answer !== "CLEAR" && !validDateOnly(answer)) {
    throw new Error("Enter a real YYYY-MM-DD date or CLEAR");
  }

  const value = answer === "CLEAR" ? null : answer;
  if (!(await confirm(`Set follow-up to ${value ?? "blank"}?`))) return;

  console.log(
    "Updated:",
    await save(
      "Applications",
      "PATCH",
      { "Follow-up Date": value },
      app.id,
    ),
  );
}

async function reassignRecruiter(): Promise<void> {
  const app = await choose(
    await list("Applications"),
    (row) => field(row, "Application Label"),
    "Application",
  );
  if (!app) return;

  const recruiter = await choose(
    await list("Recruiters"),
    (row) => field(row, "Name"),
    "New recruiter",
  );
  if (!recruiter) return;

  if (
    !(await confirm(
      `Assign ${field(app, "Application Label")} to ` +
        `${field(recruiter, "Name")}?`,
    ))
  ) {
    return;
  }

  console.log(
    "Updated:",
    await save(
      "Applications",
      "PATCH",
      { "Current Recruiter": [recruiter.id] },
      app.id,
    ),
  );
}

function runCommand(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

async function menu(): Promise<void> {
  const choices = `
1  List applications
2  View an application's stage history
3  List candidates, vacancies, and recruiters
4  Add candidate
5  Edit candidate
6  Add open vacancy
7  Edit vacancy or its status
8  Add recruiter
9  Edit recruiter
10 Create application
11 Change application stage
12 Set or clear follow-up date
13 Reassign recruiter
14 Show overdue follow-ups
15 Sync Airtable to PostgreSQL
16 Run SQL reports
17 Retry last uncertain application/stage write
0  Exit
`;

  while (true) {
    console.log(choices);
    const answer = (await prompt.question("Choose an action: ")).trim();

    if (answer === "0") return;

    try {
      switch (answer) {
        case "1": await listApplications(); break;
        case "2": await viewHistory(); break;
        case "3": await listPeopleAndVacancies(); break;
        case "4": await addCandidate(); break;
        case "5": await editCandidate(); break;
        case "6": await addVacancy(); break;
        case "7": await editVacancy(); break;
        case "8": await addRecruiter(); break;
        case "9": await editRecruiter(); break;
        case "10": await addApplication(); break;
        case "11": await moveStage(); break;
        case "12": await setFollowUp(); break;
        case "13": await reassignRecruiter(); break;
        case "14":
          console.table(await listOverdueFollowUps(baseId, token));
          break;
        case "15":
          runCommand(process.execPath, [
            "src/sync-airtable-to-postgres.mts",
          ]);
          break;
        case "16":
          runCommand("psql", [
            "-X",
            "-P", "pager=off",
            "-v", "ON_ERROR_STOP=1",
            "-d", process.env.PGDATABASE ?? "recruitment_pipeline",
            "-f", "sql/reports.sql",
          ]);
          break;
        case "17":
          if (!lastRetry) {
            console.log("There is no uncertain write to retry.");
          } else if (await confirm(`Retry ${lastRetry.description}?`)) {
            console.log(await lastRetry.run());
            lastRetry = undefined;
          }
          break;
        default:
          console.log("Choose a number from the menu.");
      }
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : String(error),
      );
      if (lastRetry) {
        console.log(
          "If the last application or stage write had an uncertain " +
          "outcome, choose 17 to retry it with the same labels.",
        );
      }
    }
  }
}

try {
  await menu();
} finally {
  prompt.close();
}