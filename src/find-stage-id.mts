import { isRecord } from "./is-record.mts";
import type { Stage } from "./stage-rules.mts";

const STAGES_TABLE = "Recruitment Stages";

export async function findStageId(
  baseId: string,
  token: string,
  stage: Stage,
): Promise<string> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${encodeURIComponent(STAGES_TABLE)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Airtable stage list failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();

  if (!isRecord(data) || !Array.isArray(data.records)) {
    throw new Error("Airtable returned an invalid stage list");
  }

  if (data.offset !== undefined) {
    throw new Error("Stage list has another page; pagination is required");
  }

  const matches: string[] = [];

  for (const record of data.records) {
    if (
      !isRecord(record) ||
      typeof record.id !== "string" ||
      !isRecord(record.fields)
    ) {
      throw new Error("Airtable returned an invalid stage record");
    }

    if (record.fields["Name"] === stage) {
      matches.push(record.id);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one "${stage}" stage; found ${matches.length}`,
    );
  }

  return matches[0];
}