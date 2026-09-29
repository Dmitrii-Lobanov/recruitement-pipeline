const APPLICATIONS_TABLE_ID = "tblTqz73hVy4mAHRe";

export type ApplicationRecord = {
  id: string;
  applicationLabel: string;
  currentStageId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readApplication(
  baseId: string,
  token: string,
  recordId: string,
): Promise<ApplicationRecord> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${APPLICATIONS_TABLE_ID}/${encodeURIComponent(recordId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Airtable application read failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();

  if (!isRecord(data) || !isRecord(data.fields)) {
    throw new Error("Airtable returned an invalid application record");
  }

  const label = data.fields["Application Label"];
  const stageIds = data.fields["Current Stage"];

  if (
    typeof data.id !== "string" ||
    typeof label !== "string" ||
    !Array.isArray(stageIds) ||
    stageIds.length !== 1 ||
    typeof stageIds[0] !== "string"
  ) {
    throw new Error("Application is missing a label or exactly one current stage");
  }

  return {
    id: data.id,
    applicationLabel: label,
    currentStageId: stageIds[0],
  };
}