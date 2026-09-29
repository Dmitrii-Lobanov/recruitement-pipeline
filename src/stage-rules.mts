export const STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Hired",
  "Rejected",
  "Withdrawn",
] as const;

export type Stage = (typeof STAGES)[number];

const ALLOWED_TRANSITIONS: Record<Stage, readonly Stage[]> = {
  Applied: ["Screening", "Rejected", "Withdrawn"],
  Screening: ["Interview", "Rejected", "Withdrawn"],
  Interview: ["Hired", "Rejected", "Withdrawn"],
  Hired: [],
  Rejected: [],
  Withdrawn: [],
};

export function isAllowedTransition(
  currentStage: Stage,
  nextStage: Stage,
): boolean {
  return ALLOWED_TRANSITIONS[currentStage].includes(nextStage);
}