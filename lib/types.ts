export interface RecipeLine {
  id: string;
  nazwa: string;
  ilosc: number | null;
  jednostka: string | null;
  miara: string | null;
}

export interface Recipe {
  id: string;
  nazwa: string;
  kategoria: string | null;
  porcje: number | null;
  czas_przygotowania_min: number | null;
  czas_gotowania_min: number | null;
  skladniki: RecipeLine[];
  instrukcja: string[] | string | null;
  zdjecie_url: string | null;
}

export interface Product {
  id: string;
  nazwa: string;
  marka?: string | null;
  cena: number;
  ilosc: number;
  jednostka: string;
  url: string | null;
  zdjecie_url: string | null;
  promocja?: { aktywna?: boolean; cena_regularna?: number | null; warunki?: string | null } | null;
}

export interface AppData {
  przepisy: Recipe[];
  skladniki: Record<string, { nazwa: string; cena_za_100g: number; produkt_ids: string[] }>;
  produkty: Record<string, Product>;
}

export interface ReceiptLine {
  kind: "opakowanie" | "zuzycie" | "woda";
  nazwa: string;
  url?: string | null;
  zdjecie?: string | null;
  ilosc?: number;
  jednostka?: string;
  cena?: number;
  sztuk?: number;
  kosztGrosze: number;
  iloscG?: number;
  cenaZa100g?: number;
  potrzebaG?: number;
  promocja?: { cenaRegularna: number | null; warunki: string | null } | null;
}

export interface MissingLine {
  recipeId: string;
  recipeName: string;
  lineIndex: number;
  originalMeasure: string | null;
  originalAmount: number | null;
  originalUnit: string | null;
}

export interface Receipt {
  lines: ReceiptLine[];
  uzupelnij: { skladnikId: string; nazwa: string; cenaZa100g: number; braki: MissingLine[] }[];
  sumaGrosze: number;
  suma: number;
  opakowania: number;
  zuzycie: number;
  kompletna: boolean;
  liczbaPozycji: number;
}

export interface PlanMeal {
  typ: string;
  recipe: Recipe;
}

export interface PlanDay {
  dzien: string;
  posilki: PlanMeal[];
}

export interface PlanResult {
  dni: PlanDay[];
  assignment: { dzien: string; typ: string; recipeId: string }[];
  receipt: Receipt;
  posilki: number;
  produkty: number;
  miesciSie: boolean;
  komunikat: string | null;
  ostrzezenie: string | null;
  proby?: number;
}
