import { readApplication } from "./read-application.mts";
import { readStage } from "./read-stage.mts";
import { isAllowedTransition, type Stage } from "./stage-rules.mts";

export type StageChangePlan = {
  applicationId: string;
  applicationLabel: string;
  currentStage: Stage;
  nextStage: Stage;
  allowed: boolean;
};

export async function planStageChange(
  baseId: string,
  token: string,
  applicationId: string,
  nextStage: Stage,
): Promise<StageChangePlan> {
  const application = await readApplication(baseId, token, applicationId);
  
  const currentStage = await readStage(
    baseId,
    token,
    application.currentStageId,
  );

  return {
    applicationId: application.id,
    applicationLabel: application.applicationLabel,
    currentStage,
    nextStage,
    allowed: isAllowedTransition(currentStage, nextStage),
  };
}