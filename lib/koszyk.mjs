// Package counts and the receipt total. Prices come only from data.
// ponytail: one pack size per catalogue product; no promo combinatorics.

export function grosze(pln) {
  return Math.round((Number(pln) + Number.EPSILON) * 100);
}

export function zloty(grosz) {
  return grosz / 100;
}

export function packGrams(product, ingredient) {
  const qty = Number(product?.ilosc);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = product.jednostka;
  const conv = ingredient?.przeliczniki || {};
  if (unit === "g") return qty;
  if (unit === "kg") return qty * 1000;
  if (unit === "ml") return conv.g_na_ml > 0 ? qty * conv.g_na_ml : null;
  if (unit === "l") return conv.g_na_ml > 0 ? qty * 1000 * conv.g_na_ml : null;
  const each = conv.gramy_na_jednostke?.[unit];
  return each > 0 ? qty * each : null;
}

export function choosePack(grams, ingredient, products) {
  if (!(grams > 0) || !ingredient?.produkt_ids?.length) return null;
  let best = null;
  for (const id of ingredient.produkt_ids) {
    const product = products[id];
    if (!product || !(Number(product.cena) > 0)) continue;
    const gramsPer = packGrams(product, ingredient);
    if (!gramsPer) continue;
    const count = Math.max(1, Math.ceil(grams / gramsPer - 1e-9));
    const waste = count * gramsPer - grams;
    const unitGrosze = grosze(product.cena);
    const cost = unitGrosze * count;
    const cand = { product, count, gramsPer, waste, unitGrosze, cost };
    const betterWaste = !best || waste < best.waste - 0.05;
    const sameWasteCheaper = best && Math.abs(waste - best.waste) <= 0.05 && cost < best.cost;
    if (betterWaste || sameWasteCheaper) best = cand;
  }
  return best;
}

export function buildReceipt(data, list) {
  const lines = [];
  const uzupelnij = [];
  for (const row of list.pozycje) {
    const ingredient = data.skladniki[row.skladnik_id];
    const missing = (row.pozycje || []).filter((item) => item.status === "needs_quantity");
    if (row.skladnik_id === "woda") {
      lines.push({
        kind: "woda",
        nazwa: row.nazwa,
        kosztGrosze: 0,
        iloscG: row.ilosc_g,
      });
      continue;
    }
    if (missing.length && !(row.ilosc_g > 0)) {
      uzupelnij.push({
        skladnikId: row.skladnik_id,
        nazwa: row.nazwa,
        cenaZa100g: row.cena_za_100g,
        braki: missing,
      });
      continue;
    }
    const pack = choosePack(row.ilosc_g, ingredient, data.produkty);
    if (pack) {
      const promo = pack.product.promocja?.aktywna ? pack.product.promocja : null;
      lines.push({
        kind: "opakowanie",
        nazwa: pack.product.nazwa,
        url: pack.product.url || null,
        zdjecie: pack.product.zdjecie_url || null,
        marka: pack.product.marka || null,
        ilosc: pack.product.ilosc,
        jednostka: pack.product.jednostka,
        cena: pack.product.cena,
        sztuk: pack.count,
        kosztGrosze: pack.cost,
        potrzebaG: row.ilosc_g,
        promocja: promo
          ? {
              cenaRegularna: promo.cena_regularna ?? null,
              warunki: promo.warunki || null,
            }
          : null,
        braki: missing,
      });
      if (missing.length) {
        uzupelnij.push({
          skladnikId: row.skladnik_id,
          nazwa: row.nazwa,
          cenaZa100g: row.cena_za_100g,
          braki: missing,
        });
      }
      continue;
    }
    lines.push({
      kind: "zuzycie",
      nazwa: row.nazwa,
      skladnikId: row.skladnik_id,
      iloscG: row.ilosc_g,
      cenaZa100g: row.cena_za_100g,
      kosztGrosze: grosze(row.koszt),
      braki: missing,
    });
    if (missing.length) {
      uzupelnij.push({
        skladnikId: row.skladnik_id,
        nazwa: row.nazwa,
        cenaZa100g: row.cena_za_100g,
        braki: missing,
      });
    }
  }
  const sumaGrosze = lines.reduce((sum, line) => sum + (line.kosztGrosze || 0), 0);
  const opakowania = lines
    .filter((line) => line.kind === "opakowanie")
    .reduce((sum, line) => sum + line.kosztGrosze, 0);
  const zuzycie = lines
    .filter((line) => line.kind === "zuzycie")
    .reduce((sum, line) => sum + line.kosztGrosze, 0);
  return {
    lines,
    uzupelnij,
    sumaGrosze,
    suma: zloty(sumaGrosze),
    opakowania: zloty(opakowania),
    zuzycie: zloty(zuzycie),
    kompletna: list.kompletna && uzupelnij.length === 0,
    liczbaPozycji: lines.filter((line) => line.kind !== "woda").length + uzupelnij.length,
  };
}
