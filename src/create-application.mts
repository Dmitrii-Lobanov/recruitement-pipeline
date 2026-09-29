import { createStageHistory } from "./create-stage-history.mts";
import { findStageId } from "./find-stage-id.mts";
import { isRecord } from "./is-record.mts";
import { readApplication } from "./read-application.mts";
import { readHistoryByLabel } from "./read-history-by-label.mts";

const APPLICATIONS_TABLE_ID = "tblTqz73hVy4mAHRe";
const VACANCIES_TABLE = "Vacancies";

export type CreateApplicationInput = {
  baseId: string;
  token: string;
  applicationLabel: string;
  historyLabel: string;
  candidateId: string;
  vacancyId: string;
  recruiterId: string;
  enteredAt: Date;
};

type ExistingApplication = {
  id: string;
  label: string;
  candidateId: string;
  vacancyId: string;
  recruiterId: string;
  currentStageId: string;
};

function oneLink(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== "string"
  ) {
    throw new Error(`Application must have exactly one ${name} link`);
  }
  return value[0];
}

async function listApplications(
  baseId: string,
  token: string,
): Promise<ExistingApplication[]> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${APPLICATIONS_TABLE_ID}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Airtable application list failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.records)) {
    throw new Error("Airtable returned an invalid application list");
  }

  if (data.offset !== undefined) {
    throw new Error("Application list has another page; pagination is required");
  }

  const applications: ExistingApplication[] = [];
  
  for (const record of data.records) {
    if (
      !isRecord(record) ||
      typeof record.id !== "string" ||
      !isRecord(record.fields) ||
      typeof record.fields["Application Label"] !== "string"
    ) {
      throw new Error("Airtable returned an invalid application record");
    }

    applications.push({
      id: record.id,
      label: record.fields["Application Label"],
      candidateId: oneLink(record.fields, "Candidate"),
      vacancyId: oneLink(record.fields, "Vacancy"),
      recruiterId: oneLink(record.fields, "Current Recruiter"),
      currentStageId: oneLink(record.fields, "Current Stage"),
    });
  }

  return applications;
}

async function readVacancyStatus(
  baseId: string,
  token: string,
  vacancyId: string,
): Promise<string> {
  const url =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}` +
    `/${encodeURIComponent(VACANCIES_TABLE)}/${encodeURIComponent(vacancyId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Airtable vacancy read failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();

  if (!isRecord(data) || !isRecord(data.fields)) {
    throw new Error("Airtable returned an invalid vacancy");
  }

  const status = data.fields["Status"];

  if (status !== "Open" && status !== "Closed") {
    throw new Error("Vacancy has an unknown or missing Status");
  }

  return status;
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<{ applicationId: string; historyId: string }> {
  if (
    !input.applicationLabel.trim() ||
    !input.historyLabel.trim() ||
    Number.isNaN(input.enteredAt.getTime())
  ) {
    throw new Error("Valid labels and enteredAt are required");
  }

  const appliedStageId = await findStageId(
    input.baseId,
    input.token,
    "Applied",
  );
  const applications = await listApplications(input.baseId, input.token);

  const existingHistory = await readHistoryByLabel(
    input.baseId,
    input.token,
    input.historyLabel,
  );

  const matchingLabels = applications.filter(
    (app) => app.label === input.applicationLabel,
  );

  const matchingPairs = applications.filter(
    (app) =>
      app.candidateId === input.candidateId &&
      app.vacancyId === input.vacancyId,
  );

  if (matchingLabels.length > 1 || matchingPairs.length > 1) {
    throw new Error("Duplicate applications already exist in Airtable");
  }

  let application = matchingLabels[0];

  if (
    application &&
    (application.candidateId !== input.candidateId ||
      application.vacancyId !== input.vacancyId)
  ) {
    throw new Error("Application label belongs to another candidate–vacancy pair");
  }

  if (matchingPairs.some((app) => app.id !== application?.id)) {
    throw new Error("Candidate already has an application for this vacancy");
  }

  if (!application && existingHistory) {
    throw new Error("History label exists without the expected application");
  }

  if (!application) {
    const status = await readVacancyStatus(
      input.baseId,
      input.token,
      input.vacancyId,
    );

    if (status !== "Open") {
      throw new Error("New applications require an open vacancy");
    }

    const url =
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}` +
      `/${APPLICATIONS_TABLE_ID}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          "Application Label": input.applicationLabel,
          Candidate: [input.candidateId],
          Vacancy: [input.vacancyId],
          "Current Recruiter": [input.recruiterId],
          "Current Stage": [appliedStageId],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Airtable application creation failed: HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!isRecord(data) || typeof data.id !== "string") {
      throw new Error("Application may have been created; retry with the same labels");
    }

    application = {
      id: data.id,
      label: input.applicationLabel,
      candidateId: input.candidateId,
      vacancyId: input.vacancyId,
      recruiterId: input.recruiterId,
      currentStageId: appliedStageId,
    };
  }

  if (
    !existingHistory &&
    (application.currentStageId !== appliedStageId ||
      application.recruiterId !== input.recruiterId)
  ) {
    throw new Error("Incomplete application changed before initial history was added");
  }

  if (!existingHistory) {
    await createStageHistory({
      baseId: input.baseId,
      token: input.token,
      historyLabel: input.historyLabel,
      applicationId: application.id,
      newStageId: appliedStageId,
      enteredAt: input.enteredAt,
    });
  }

  const history = await readHistoryByLabel(
    input.baseId,
    input.token,
    input.historyLabel,
  );

  if (
    !history ||
    history.applicationId !== application.id ||
    history.previousStageId !== undefined ||
    history.newStageId !== appliedStageId
  ) {
    throw new Error("Initial Applied history could not be confirmed");
  }

  const confirmedApplication = await readApplication(
    input.baseId,
    input.token,
    application.id,
  );
  if (
    confirmedApplication.applicationLabel !== input.applicationLabel ||
    (!existingHistory &&
      confirmedApplication.currentStageId !== appliedStageId)
  ) {
    throw new Error("Created application could not be confirmed");
  }

  return { applicationId: application.id, historyId: history.id };
}