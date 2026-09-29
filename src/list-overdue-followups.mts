import { isRecord } from "./is-record.mts";

const BUSINESS_TIME_ZONE = "America/Guayaquil";
const MILLISECONDS_PER_DAY = 86_400_000;

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

export type OverdueFollowUp = {
  applicationId: string;
  applicationLabel: string;
  candidate: string;
  vacancy: string;
  recruiter: string;
  currentStage: string;
  followUpDate: string;
  daysOverdue: number;
};

function parseDateOnly(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  const day = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  return day;
}

function businessDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid current time");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (part: string) => parts.find((item) => item.type === part)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function listRecords(
  baseId: string,
  token: string,
  table: string,
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  const seenOffsets = new Set<string>();

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
      throw new Error(`Airtable ${table} list failed: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.records)) {
      throw new Error(`Airtable returned an invalid ${table} list`);
    }

    for (const item of data.records) {
      if (!isRecord(item) || typeof item.id !== "string" || !isRecord(item.fields)) {
        throw new Error(`Airtable returned an invalid ${table} record`);
      }
      records.push({ id: item.id, fields: item.fields });
    }

    if (data.offset !== undefined && typeof data.offset !== "string") {
      throw new Error(`Airtable returned an invalid ${table} offset`);
    }
    offset = data.offset;
    if (offset) {
      if (seenOffsets.has(offset)) throw new Error(`Repeated ${table} offset`);
      seenOffsets.add(offset);
    }
  } while (offset);

  return records;
}

function requiredText(record: AirtableRecord, field: string): string {
  const value = record.fields[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${record.id} is missing ${field}`);
  }
  return value;
}

function linkedId(record: AirtableRecord, field: string): string {
  const value = record.fields[field];
  if (!Array.isArray(value) || value.length !== 1 || typeof value[0] !== "string") {
    throw new Error(`${record.id} must have exactly one ${field} link`);
  }
  return value[0];
}

function referencedRecord(
  records: Map<string, AirtableRecord>,
  id: string,
  field: string,
): AirtableRecord {
  const record = records.get(id);
  if (!record) throw new Error(`Missing ${field} record ${id}`);
  return record;
}

export async function listOverdueFollowUps(
  baseId: string,
  token: string,
  now: Date = new Date(),
): Promise<OverdueFollowUp[]> {
  const today = businessDate(now);
  const todayDay = parseDateOnly(today);

  // Sequential requests stay comfortably within Airtable's per-base rate limit.
  const applications = await listRecords(baseId, token, "Applications");
  const candidates = new Map(
    (await listRecords(baseId, token, "Candidates")).map((record) => [record.id, record]),
  );
  const vacancies = new Map(
    (await listRecords(baseId, token, "Vacancies")).map((record) => [record.id, record]),
  );
  const recruiters = new Map(
    (await listRecords(baseId, token, "Recruiters")).map((record) => [record.id, record]),
  );
  const stages = new Map(
    (await listRecords(baseId, token, "Recruitment Stages")).map((record) => [record.id, record]),
  );

  const overdue: OverdueFollowUp[] = [];
  for (const application of applications) {
    const stage = referencedRecord(
      stages,
      linkedId(application, "Current Stage"),
      "Current Stage",
    );
    const stageType = requiredText(stage, "Type");
    if (stageType !== "Active" && stageType !== "Terminal") {
      throw new Error(`${stage.id} has an invalid stage type`);
    }
    if (stageType === "Terminal") continue;

    // Airtable omits empty fields from API records.
    const followUpDate = application.fields["Follow-up Date"];
    if (followUpDate === undefined) continue;
    if (typeof followUpDate !== "string") {
      throw new Error(`${application.id} has an invalid Follow-up Date`);
    }
    const followUpDay = parseDateOnly(followUpDate);
    if (followUpDay >= todayDay) continue;

    const candidate = referencedRecord(
      candidates,
      linkedId(application, "Candidate"),
      "Candidate",
    );
    const vacancy = referencedRecord(
      vacancies,
      linkedId(application, "Vacancy"),
      "Vacancy",
    );
    const recruiter = referencedRecord(
      recruiters,
      linkedId(application, "Current Recruiter"),
      "Current Recruiter",
    );

    overdue.push({
      applicationId: application.id,
      applicationLabel: requiredText(application, "Application Label"),
      candidate: requiredText(candidate, "Name"),
      vacancy: requiredText(vacancy, "Title"),
      recruiter: requiredText(recruiter, "Name"),
      currentStage: requiredText(stage, "Name"),
      followUpDate,
      daysOverdue: (todayDay - followUpDay) / MILLISECONDS_PER_DAY,
    });
  }

  return overdue.sort(
    (a, b) =>
      a.followUpDate.localeCompare(b.followUpDate) ||
      a.applicationLabel.localeCompare(b.applicationLabel),
  );
}
