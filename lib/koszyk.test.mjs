import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { choosePack, buildReceipt, grosze } from "./koszyk.mjs";
import { calculateShoppingList } from "./kalkulator.mjs";
import { buildPlan } from "./plan.mjs";

const data = JSON.parse(readFileSync(new URL("../public/dane_aplikacji.json", import.meta.url)));

test("400 g prefers the 500 g pack over 1 kg", () => {
  const ingredient = {
    produkt_ids: ["p500", "p1000"],
    przeliczniki: { g_na_ml: 1, gramy_na_jednostke: {} },
  };
  const products = {
    p500: { id: "p500", nazwa: "Ryż 500 g", cena: 4.5, ilosc: 500, jednostka: "g" },
    p1000: { id: "p1000", nazwa: "Ryż 1 kg", cena: 8, ilosc: 1, jednostka: "kg" },
  };
  const pack = choosePack(400, ingredient, products);
  assert.equal(pack.product.id, "p500");
  assert.equal(pack.count, 1);
  assert.equal(pack.cost, grosze(4.5));
});

test("700 g buys two 500 g packs when that wastes less", () => {
  const ingredient = {
    produkt_ids: ["p500"],
    przeliczniki: { g_na_ml: 1, gramy_na_jednostke: {} },
  };
  const products = {
    p500: { id: "p500", nazwa: "Ryż 500 g", cena: 4.5, ilosc: 500, jednostka: "g" },
  };
  const pack = choosePack(700, ingredient, products);
  assert.equal(pack.count, 2);
  assert.equal(pack.cost, grosze(4.5) * 2);
});

test("receipt total equals the sum of its lines", () => {
  const selected = data.przepisy.slice(0, 8).map((recipe) =>
    recipe.porcje
      ? { recipeId: recipe.id, servings: 2 }
      : { recipeId: recipe.id, servings: 2, assumedBaseServings: 4 },
  );
  const list = calculateShoppingList(data, selected);
  const receipt = buildReceipt(data, list);
  const summed = receipt.lines.reduce((sum, line) => sum + line.kosztGrosze, 0);
  assert.equal(receipt.sumaGrosze, summed);
  assert.equal(Math.round(receipt.suma * 100), receipt.sumaGrosze);
});

test("plan stays inside a wide budget and never invents a recipe", () => {
  const plan = buildPlan(data, {
    people: 2,
    days: ["Poniedziałek", "Wtorek", "Środa"],
    mealsPerDay: 2,
    budget: 400,
  });
  assert.equal(plan.posilki, 6);
  assert.equal(plan.miesciSie, true);
  assert.ok(plan.receipt.suma <= 400);
  const ids = new Set(data.przepisy.map((recipe) => recipe.id));
  for (const day of plan.dni) {
    for (const meal of day.posilki) assert.ok(ids.has(meal.recipe.id));
  }
});

test("a tiny budget is reported honestly", () => {
  const plan = buildPlan(data, {
    people: 6,
    days: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
    mealsPerDay: 3,
    budget: 20,
  });
  assert.equal(plan.miesciSie, false);
  assert.match(plan.komunikat, /budżecie/);
  assert.ok(plan.receipt.suma > 20);
});
