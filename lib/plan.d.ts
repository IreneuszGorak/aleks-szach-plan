import type { AppData, PlanResult } from "./types";

export const DNI: string[];

export function buildPlan(
  data: AppData,
  input: {
    people: number;
    days: string[];
    mealsPerDay: number;
    budget: number;
    quantityOverrides?: Record<string, { amount: number; unit: string }>;
  },
): PlanResult;

export function describePlan(
  data: AppData,
  assignment: { dzien: string; typ: string; recipeId: string }[],
  people: number,
  budget: number,
  quantityOverrides?: Record<string, { amount: number; unit: string }>,
): PlanResult;
