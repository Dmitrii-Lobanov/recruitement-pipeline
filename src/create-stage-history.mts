import { isRecord } from "./is-record.mts";

const STAGE_HISTORY_TABLE_ID = "tbl3SpJ7ZjScLj3xi";

export type CreateStageHistoryInput = {
  baseId: string;
  token: string;
  historyLabel: string;
  applicationId: string;
  previousStageId?: string;
  newStageId: string;
  enteredAt: Date;
};

export async function createStageHistory(
  input: CreateStageHistoryInput,
): Promise<string> {
  if (Number.isNaN(input.enteredAt.getTime())) {
    throw new Error("enteredAt must be a valid Date");
  }

  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}` +
    `/${STAGE_HISTORY_TABLE_ID}`;

  const fields = {
    "History Label": input.historyLabel,
    Application: [input.applicationId],
    ...(input.previousStageId
      ? { "Previous Stage": [input.previousStageId] }
      : {}),
    "New Stage": [input.newStageId],
    "Entered At": input.enteredAt.toISOString(),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Airtable history creation failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || typeof data.id !== "string") {
    throw new Error("Airtable returned an invalid created history record");
  }

  return data.id;
}