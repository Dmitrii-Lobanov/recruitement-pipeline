import { Client } from "pg";
import { isRecord } from './is-record.mts'

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type Value = string | number | null;

function text(record: AirtableRecord, field: string): string {
  const value = record.fields[field];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${record.id}: missing ${field}`);
  }

  return value;
}

function optionalText(record: AirtableRecord, field: string): string | null {
  const value = record.fields[field];

  if (value === undefined) return null;

  return text(record, field);
}

function link(record: AirtableRecord, field: string): string {
  const value = record.fields[field];

  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== "string"
  ) {
    throw new Error(`${record.id}: expected one ${field} link`);
  }

  return value[0];
}

function optionalLink(record: AirtableRecord, field: string): string | null {
  if (record.fields[field] === undefined) return null;

  return link(record, field);
}

function choice(
  record: AirtableRecord,
  field: string,
  allowed: readonly string[],
): string {
  const value = text(record, field);

  if (!allowed.includes(value)) {
    throw new Error(`${record.id}: invalid ${field}: ${value}`);
  }

  return value;
}

function dateOnly(record: AirtableRecord, field: string): string | null {
  const value = optionalText(record, field);

  if (value === null) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${record.id}: invalid ${field}: ${value}`);
  }

  return value;
}

function timestamp(record: AirtableRecord, field: string): string {
  const value = text(record, field);

  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${record.id}: invalid ${field}: ${value}`);
  }

  return value;
}

async function readAll(
  baseId: string,
  token: string,
  table: string,
): Promise<AirtableRecord[]> {
  const result: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`,
    );

    url.searchParams.set("pageSize", "100");

    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`${table}: Airtable HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    if (!isRecord(data) || !Array.isArray(data.records)) {
      throw new Error(`${table}: invalid Airtable response`);
    }

    for (const item of data.records) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        !isRecord(item.fields)
      ) {
        throw new Error(`${table}: invalid Airtable record`);
      }
      result.push({ id: item.id, fields: item.fields });
    }

    if (data.offset !== undefined && typeof data.offset !== "string") {
      throw new Error(`${table}: invalid pagination offset`);
    }
    offset = data.offset;

    // Keep a small gap between requests for Airtable's per-base rate limit.
    if (offset) await new Promise((resolve) => setTimeout(resolve, 250));
  } while (offset);

  return result;
}

const tables = [
  {
    airtable: "Candidates",
    postgres: "candidates",
    columns: ["airtable_id", "name", "email"],
    values: (r: AirtableRecord): Value[] => [
      r.id,
      text(r, "Name"),
      optionalText(r, "Email"),
    ],
  },
  {
    airtable: "Vacancies",
    postgres: "vacancies",
    columns: ["airtable_id", "title", "status"],
    values: (r: AirtableRecord): Value[] => [
      r.id,
      text(r, "Title"),
      choice(r, "Status", ["Open", "Closed"]),
    ],
  },
  {
    airtable: "Recruiters",
    postgres: "recruiters",
    columns: ["airtable_id", "name"],
    values: (r: AirtableRecord): Value[] => [r.id, text(r, "Name")],
  },
  {
    airtable: "Recruitment Stages",
    postgres: "recruitment_stages",
    columns: ["airtable_id", "name", "type", "stage_order"],
    values: (r: AirtableRecord): Value[] => {
      const order = r.fields["Order"];
      if (typeof order !== "number" || !Number.isInteger(order)) {
        throw new Error(`${r.id}: invalid Order`);
      }
      return [
        r.id,
        text(r, "Name"),
        choice(r, "Type", ["Active", "Terminal"]),
        order,
      ];
    },
  },
  {
    airtable: "Applications",
    postgres: "applications",
    columns: [
      "airtable_id",
      "application_label",
      "candidate_id",
      "vacancy_id",
      "current_recruiter_id",
      "current_stage_id",
      "follow_up_date",
    ],
    values: (r: AirtableRecord): Value[] => [
      r.id,
      text(r, "Application Label"),
      link(r, "Candidate"),
      link(r, "Vacancy"),
      link(r, "Current Recruiter"),
      link(r, "Current Stage"),
      dateOnly(r, "Follow-up Date"),
    ],
  },
  {
    airtable: "Stage History",
    postgres: "stage_history",
    columns: [
      "airtable_id",
      "history_label",
      "application_id",
      "previous_stage_id",
      "new_stage_id",
      "entered_at",
    ],
    values: (r: AirtableRecord): Value[] => [
      r.id,
      text(r, "History Label"),
      link(r, "Application"),
      optionalLink(r, "Previous Stage"),
      link(r, "New Stage"),
      timestamp(r, "Entered At"),
    ],
  },
] as const;

const baseId = process.env.AIRTABLE_BASE_ID;
const token = process.env.AIRTABLE_TOKEN;
if (!baseId || !token) {
  throw new Error("Set AIRTABLE_BASE_ID and AIRTABLE_TOKEN in .env");
}

// Read the full source before changing PostgreSQL.
const snapshots = [];
for (const table of tables) {
  const records = await readAll(baseId, token, table.airtable);
  snapshots.push({ table, records });
}

const client = new Client({
  database: process.env.PGDATABASE ?? "recruitment_pipeline",
  host: process.env.PGHOST ?? "/tmp",
});

await client.connect();

try {
  await client.query("BEGIN");

  for (const { table, records } of snapshots) {
    const columns = [...table.columns];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const updates = columns
      .slice(1)
      .map((column) => `${column} = EXCLUDED.${column}`)
      .join(", ");

    // Table and column names come only from the constants above.
    const sql = `
      INSERT INTO ${table.postgres} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (airtable_id) DO UPDATE SET ${updates}
    `;

    for (const record of records) {
      try {
        await client.query(sql, table.values(record));
      } catch (error) {
        throw new Error(
          `${table.airtable} record ${record.id} failed: ${String(error)}`,
        );
      }
    }
  }

  await client.query("COMMIT");
  for (const { table, records } of snapshots) {
    console.log(`${table.airtable}: transferred ${records.length}`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}