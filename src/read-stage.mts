import { isRecord } from "./is-record.mts";
import { STAGES, type Stage } from "./stage-rules.mts";

const STAGES_TABLE = "Recruitment Stages";

function isStage(value: unknown): value is Stage {
  return (
    typeof value === "string" &&
    (STAGES as readonly string[]).includes(value)
  );
}

export async function readStage(
  baseId: string,
  token: string,
  stageId: string,
): Promise<Stage> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${encodeURIComponent(STAGES_TABLE)}/${encodeURIComponent(stageId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Airtable stage read failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !isRecord(data.fields)) {
    throw new Error("Airtable returned an invalid stage record");
  }

  const name = data.fields["Name"];
  if (!isStage(name)) {
    throw new Error("Stage record has an unknown or missing Name");
  }

  return name;
}