import { isRecord } from "./is-record.mts";

const APPLICATIONS_TABLE_ID = "tblTqz73hVy4mAHRe";

export async function updateCurrentStage(
  baseId: string,
  token: string,
  applicationId: string,
  nextStageId: string,
): Promise<void> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${APPLICATIONS_TABLE_ID}/${encodeURIComponent(applicationId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: { "Current Stage": [nextStageId] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Airtable stage update failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    !isRecord(data) ||
    data.id !== applicationId ||
    !isRecord(data.fields)
  ) {
    throw new Error("Airtable returned an invalid updated application");
  }

  const stageIds = data.fields["Current Stage"];
  if (
    !Array.isArray(stageIds) ||
    stageIds.length !== 1 ||
    stageIds[0] !== nextStageId
  ) {
    throw new Error("Airtable did not confirm the requested current stage");
  }
}