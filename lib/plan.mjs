import { calculateShoppingList } from "./kalkulator.mjs";
import { buildReceipt, grosze } from "./koszyk.mjs";

export const DNI = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];

const OBIAD = new Set([
  "Kurczak",
  "Wołowina",
  "Wieprzowina",
  "Ryby i owoce morza",
  "Makaron",
  "Wegetariańskie",
  "Wegańskie",
  "Jagnięcina",
  "Kozina",
]);
const KOLACJA = new Set(["Przystawka", "Dodatek", "Wegetariańskie", "Wegańskie"]);

const costCache = new Map();

export function mealTypes(count) {
  if (count >= 3) return ["Śniadanie", "Obiad", "Kolacja"];
  if (count === 2) return ["Śniadanie", "Obiad"];
  return ["Obiad"];
}

export function choiceFor(recipe, people) {
  if (recipe.porcje) return { recipeId: recipe.id, servings: people };
  return { recipeId: recipe.id, servings: people, assumedBaseServings: 4 };
}

function poolFor(meal, recipes) {
  if (meal === "Śniadanie") {
    const found = recipes.filter((recipe) => recipe.kategoria === "Śniadanie");
    if (found.length) return found;
  }
  if (meal === "Kolacja") {
    const found = recipes.filter((recipe) => KOLACJA.has(recipe.kategoria));
    if (found.length) return found;
  }
  if (meal === "Obiad") {
    const found = recipes.filter((recipe) => OBIAD.has(recipe.kategoria));
    if (found.length) return found;
  }
  return recipes;
}

function costsFor(data, people) {
  const key = String(people);
  if (costCache.has(key)) return costCache.get(key);
  const costs = new Map();
  for (const recipe of data.przepisy) {
    const list = calculateShoppingList(data, [choiceFor(recipe, people)]);
    costs.set(recipe.id, buildReceipt(data, list).sumaGrosze);
  }
  costCache.set(key, costs);
  return costs;
}

function slotsFor(days, mealsPerDay) {
  const order = new Map(DNI.map((day, index) => [day, index]));
  const chosen = [...days].sort((a, b) => order.get(a) - order.get(b));
  const types = mealTypes(mealsPerDay);
  const slots = [];
  for (const day of chosen) {
    for (const typ of types) slots.push({ dzien: day, typ });
  }
  return slots;
}

function pickAssignment(data, slots, costs, budgetGrosze) {
  const target = budgetGrosze / slots.length;
  const byId = new Map(data.przepisy.map((recipe) => [recipe.id, recipe]));
  const used = new Set();
  const pantry = new Set();
  const lastCategory = {};
  const assignment = [];
  for (const slot of slots) {
    const pool = poolFor(slot.typ, data.przepisy).filter((recipe) => !used.has(recipe.id));
    const source = pool.length ? pool : data.przepisy.filter((recipe) => !used.has(recipe.id));
    let best = null;
    let bestScore = Infinity;
    for (const recipe of source) {
      const cost = costs.get(recipe.id) ?? 0;
      const over = Math.max(0, cost - target);
      const overlap = recipe.skladniki.reduce((sum, line) => sum + (pantry.has(line.id) ? 1 : 0), 0);
      const same =
        lastCategory[slot.typ] &&
        lastCategory[slot.typ] === recipe.kategoria &&
        recipe.kategoria !== "Śniadanie";
      const score = over * 10 + Math.abs(cost - target) * 0.25 + (same ? 400 : 0) - Math.min(overlap, 8) * 80;
      if (score < bestScore) {
        bestScore = score;
        best = recipe;
      }
    }
    if (!best) break;
    used.add(best.id);
    for (const line of best.skladniki) pantry.add(line.id);
    lastCategory[slot.typ] = best.kategoria;
    assignment.push({ dzien: slot.dzien, typ: slot.typ, recipeId: best.id });
  }
  return { assignment, byId };
}

function aggregate(data, assignment, people, quantityOverrides) {
  const selection = assignment.map((slot) => {
    const recipe = data.przepisy.find((item) => item.id === slot.recipeId);
    return choiceFor(recipe, people);
  });
  const list = calculateShoppingList(data, selection, { quantityOverrides });
  const receipt = buildReceipt(data, list);
  return { list, receipt };
}

function swapDown(data, assignment, costs) {
  const used = new Set(assignment.map((slot) => slot.recipeId));
  const ranked = assignment
    .map((slot, index) => ({ slot, index, cost: costs.get(slot.recipeId) ?? 0 }))
    .sort((a, b) => b.cost - a.cost);
  for (const item of ranked) {
    const pool = poolFor(item.slot.typ, data.przepisy).filter((recipe) => !used.has(recipe.id));
    const source = pool.length ? pool : data.przepisy.filter((recipe) => !used.has(recipe.id));
    const cheaper = source
      .filter((recipe) => (costs.get(recipe.id) ?? 0) < item.cost)
      .sort((a, b) => (costs.get(a.id) ?? 0) - (costs.get(b.id) ?? 0));
    if (!cheaper.length) continue;
    const next = assignment.map((slot) => ({ ...slot }));
    next[item.index] = { ...item.slot, recipeId: cheaper[0].id };
    return next;
  }
  return null;
}

export function describePlan(data, assignment, people, budget, quantityOverrides) {
  const { receipt } = aggregate(data, assignment, people, quantityOverrides);
  const budgetGrosze = grosze(budget);
  const over = receipt.sumaGrosze > budgetGrosze;
  const meals = assignment.length;
  const byDay = [];
  for (const day of DNI) {
    const mealsForDay = assignment.filter((slot) => slot.dzien === day);
    if (!mealsForDay.length) continue;
    byDay.push({
      dzien: day,
      posilki: mealsForDay.map((slot) => ({
        typ: slot.typ,
        recipe: data.przepisy.find((recipe) => recipe.id === slot.recipeId),
      })),
    });
  }
  let komunikat = null;
  let ostrzezenie = null;
  if (over) {
    komunikat =
      "Nie udało się ułożyć planu w tym budżecie. Poniżej jest najbliższy policzony wynik — kwota jest prawdziwa, plan nie mieści się w limicie.";
  }
  if (!receipt.kompletna) {
    ostrzezenie =
      "Część składników nie ma podanej ilości. Suma ich nie obejmuje. To nie jest pełny koszt zakupów.";
  }
  return {
    dni: byDay,
    assignment,
    receipt,
    posilki: meals,
    produkty: receipt.liczbaPozycji,
    miesciSie: !over,
    komunikat,
    ostrzezenie,
  };
}

export function buildPlan(data, input) {
  const people = input.people;
  const days = input.days?.length ? input.days : DNI;
  const mealsPerDay = input.mealsPerDay;
  const budget = input.budget;
  const slots = slotsFor(days, mealsPerDay);
  const costs = costsFor(data, people);
  let { assignment } = pickAssignment(data, slots, costs, grosze(budget));
  let quoted = describePlan(data, assignment, people, budget, input.quantityOverrides);
  let tries = 0;
  while (quoted.receipt.sumaGrosze > grosze(budget) && tries < 12) {
    const swapped = swapDown(data, assignment, costs);
    if (!swapped) break;
    assignment = swapped;
    quoted = describePlan(data, assignment, people, budget, input.quantityOverrides);
    tries += 1;
  }
  return { ...quoted, proby: tries };
}
