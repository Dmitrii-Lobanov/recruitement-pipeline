import { isRecord } from "./is-record.mts";

const STAGE_HISTORY_TABLE_ID = "tbl3SpJ7ZjScLj3xi";

export type StageHistoryRecord = {
  id: string;
  historyLabel: string;
  applicationId: string;
  previousStageId?: string;
  newStageId: string;
  enteredAt: string;
};

function oneLinkedId(value: unknown, field: string): string {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== "string"
  ) {
    throw new Error(`History entry must have exactly one ${field} link`);
  }
  return value[0];
}

export async function readHistoryByLabel(
  baseId: string,
  token: string,
  historyLabel: string,
): Promise<StageHistoryRecord | null> {
  let offset: string | undefined;
  let found: StageHistoryRecord | null = null;
  const seenOffsets = new Set<string>();

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
        `/${STAGE_HISTORY_TABLE_ID}`,
    );
    
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Airtable history list failed: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.records)) {
      throw new Error("Airtable returned an invalid history list");
    }

    for (const record of data.records) {
      if (
        !isRecord(record) ||
        typeof record.id !== "string" ||
        !isRecord(record.fields)
      ) {
        throw new Error("Airtable returned an invalid history record");
      }

      if (record.fields["History Label"] !== historyLabel) continue;
      if (found) {
        throw new Error(`Multiple history entries have label "${historyLabel}"`);
      }

      const fields = record.fields;
      const previous = fields["Previous Stage"];
      const enteredAt = fields["Entered At"];

      if (
        typeof enteredAt !== "string" ||
        Number.isNaN(Date.parse(enteredAt))
      ) {
        throw new Error("History entry has an invalid Entered At value");
      }

      found = {
        id: record.id,
        historyLabel,
        applicationId: oneLinkedId(fields["Application"], "Application"),
        ...(previous === undefined || 
        (Array.isArray(previous) && previous.length === 0)
          ? {}
          : { previousStageId: oneLinkedId(previous, "Previous Stage") }),
        newStageId: oneLinkedId(fields["New Stage"], "New Stage"),
        enteredAt,
      };
    }

    if (data.offset === undefined) {
      offset = undefined;
    } else if (typeof data.offset === "string" && data.offset.length > 0) {
      if (seenOffsets.has(data.offset)) {
        throw new Error("Airtable repeated a history pagination offset");
      }
      seenOffsets.add(data.offset);
      offset = data.offset;
    } else {
      throw new Error("Airtable returned an invalid history pagination offset");
    }
  } while (offset);

  return found;
}