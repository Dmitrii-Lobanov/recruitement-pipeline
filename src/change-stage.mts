import { createStageHistory } from "./create-stage-history.mts";
import { findStageId } from "./find-stage-id.mts";
import { readApplication } from "./read-application.mts";
import { readHistoryByLabel } from "./read-history-by-label.mts";
import { readStage } from "./read-stage.mts";
import { isAllowedTransition, type Stage } from "./stage-rules.mts";
import { updateCurrentStage } from "./update-current-stage.mts";

export type ChangeStageInput = {
  baseId: string;
  token: string;
  applicationId: string;
  nextStage: Stage;
  historyLabel: string;
  enteredAt: Date;
};

export async function changeStage(input: ChangeStageInput): Promise<string> {
  if (!input.historyLabel.trim()) {
    throw new Error("historyLabel is required");
  }

  const nextStageId = await findStageId(
    input.baseId,
    input.token,
    input.nextStage,
  );

  let history = await readHistoryByLabel(
    input.baseId,
    input.token,
    input.historyLabel,
  );

  if (!history) {
    const application = await readApplication(
      input.baseId,
      input.token,
      input.applicationId,
    );

    const currentStage = await readStage(
      input.baseId,
      input.token,
      application.currentStageId,
    );

    if (!isAllowedTransition(currentStage, input.nextStage)) {
      throw new Error(
        `Transition ${currentStage} → ${input.nextStage} is not allowed`,
      );
    }

    await createStageHistory({
      baseId: input.baseId,
      token: input.token,
      historyLabel: input.historyLabel,
      applicationId: input.applicationId,
      previousStageId: application.currentStageId,
      newStageId: nextStageId,
      enteredAt: input.enteredAt,
    });

    history = await readHistoryByLabel(
      input.baseId,
      input.token,
      input.historyLabel,
    );

    if (!history) {
      throw new Error(
        "History write may have completed, but it could not be confirmed; retry with the same historyLabel",
      );
    }
  }

  if (
    history.applicationId !== input.applicationId ||
    history.newStageId !== nextStageId ||
    !history.previousStageId
  ) {
    throw new Error("History label belongs to a different stage change");
  }

  const previousStage = await readStage(
    input.baseId,
    input.token,
    history.previousStageId,
  );

  if (!isAllowedTransition(previousStage, input.nextStage)) {
    throw new Error("Existing history describes an invalid transition");
  }

  const latestApplication = await readApplication(
    input.baseId,
    input.token,
    input.applicationId,
  );

  if (latestApplication.currentStageId === history.previousStageId) {
    await updateCurrentStage(
      input.baseId,
      input.token,
      input.applicationId,
      nextStageId,
    );
  } else if (latestApplication.currentStageId !== nextStageId) {
    throw new Error("Application changed to another stage; resolve the conflict");
  }

  const confirmedApplication = await readApplication(
    input.baseId,
    input.token,
    input.applicationId,
  );
  
  const confirmedHistory = await readHistoryByLabel(
    input.baseId,
    input.token,
    input.historyLabel,
  );

  if (
    confirmedApplication.currentStageId !== nextStageId ||
    confirmedHistory?.id !== history.id
  ) {
    throw new Error("Stage change could not be confirmed");
  }

  return history.id;
}