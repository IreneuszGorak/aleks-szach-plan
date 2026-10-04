"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildPlan, describePlan, DNI } from "@/lib/plan.mjs";
import type { AppData, PlanResult, Recipe, ReceiptLine } from "@/lib/types";

const MESSAGES = [
  "Analizujemy Twój budżet",
  "Dobieramy posiłki",
  "Dopasowujemy produkty z Lidla",
  "Tworzymy listę zakupów",
];

const UNITS = ["g", "ml", "łyżeczka", "łyżka", "szt.", "ząbek", "plaster", "pęczek"];

function formatPln(value: number) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function formatFromGrosze(grosze: number) {
  return formatPln(grosze / 100);
}

function formatAmount(value: number) {
  return value.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
}

function formatGrams(value: number) {
  if (value > 0 && value < 1) {
    return value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Math.round(value).toLocaleString("pl-PL");
}

function parsePln(raw: string) {
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function stepsOf(recipe: Recipe) {
  if (Array.isArray(recipe.instrukcja)) return recipe.instrukcja.filter((step) => step.trim());
  if (typeof recipe.instrukcja === "string") return recipe.instrukcja.split(/\n+/).map((step) => step.trim()).filter(Boolean);
  return [];
}

function countLabel(count: number, one: string, few: string, many: string) {
  if (count === 1) return `1 ${one}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

function measure(line: { miara: string | null; ilosc: number | null; jednostka: string | null; nazwa: string }) {
  if (line.miara) return line.miara;
  if (line.ilosc != null) return `${line.ilosc} ${line.jednostka ?? ""}`.trim();
  return "ilość do uzupełnienia";
}

export default function PlanFlow() {
  const [data, setData] = useState<AppData | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | "load" | "done">(1);
  const [people, setPeople] = useState(2);
  const [days, setDays] = useState<string[]>([...DNI]);
  const [meals, setMeals] = useState(2);
  const [budgetRaw, setBudgetRaw] = useState("300");
  const [line, setLine] = useState(0);
  const [runId, setRunId] = useState(0);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [locked, setLocked] = useState<{ people: number; budget: number } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { amount: number; unit: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [hiddenPhotos, setHiddenPhotos] = useState<Record<string, true>>({});
  const request = useRef({ people: 2, days: [...DNI] as string[], meals: 2, budget: 300 });

  useEffect(() => {
    fetch("/dane_aplikacji.json")
      .then((response) => {
        if (!response.ok) throw new Error("dane");
        return response.json();
      })
      .then((json: AppData) => setData(json))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (runId === 0 || !data) return;
    const req = request.current;
    let alive = true;
    const compute = window.setTimeout(() => {
      try {
        const next = buildPlan(data, {
          people: req.people,
          days: req.days,
          mealsPerDay: req.meals,
          budget: req.budget,
        }) as PlanResult;
        if (!alive) return;
        setPlan(next);
        setLocked({ people: req.people, budget: req.budget });
        setOverrides({});
        setError(null);
      } catch {
        if (alive) setError("Nie udało się policzyć planu z tych danych. Wróć i wybierz inne dni.");
      }
    }, 60);
    const ticks = window.setInterval(() => setLine((current) => Math.min(MESSAGES.length - 1, current + 1)), 700);
    return () => {
      alive = false;
      window.clearTimeout(compute);
      window.clearInterval(ticks);
    };
  }, [runId, data]);

  useEffect(() => {
    if (step !== "load" || !plan || line < MESSAGES.length - 1) return;
    const done = window.setTimeout(() => setStep("done"), 420);
    return () => window.clearTimeout(done);
  }, [step, plan, line]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const view = useMemo(() => {
    if (!data || !plan || !locked) return plan;
    return describePlan(data, plan.assignment, locked.people, locked.budget, overrides) as PlanResult;
  }, [data, plan, locked, overrides]);

  function toggleDay(day: string) {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  function generate() {
    const budget = parsePln(budgetRaw);
    if (!budget || days.length === 0) return;
    request.current = { people, days: [...days], meals, budget };
    setPlan(null);
    setError(null);
    setLine(0);
    setStep("load");
    setRunId((value) => value + 1);
  }

  if (failed) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">Nie ma pliku z danymi.</h1>
        <p className="mt-4 text-lg">Aplikacja potrzebuje public/dane_aplikacji.json obok buildu.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <p className="text-2xl">Otwieramy bazę przepisów.</p>
      </main>
    );
  }

  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 lg:px-8">
        <Link href="/" className="font-semibold">
          Nakrycie
        </Link>
      </header>

      {step === "load" ? (
        <section className="mx-auto flex min-h-[70svh] max-w-xl flex-col justify-end px-5 pb-20">
          <p className="text-4xl leading-none font-semibold tracking-[-0.03em]">{MESSAGES[line]}</p>
          <div className="mt-8 h-1 bg-rule">
            <div className="h-full bg-awning" style={{ width: `${((line + 1) / MESSAGES.length) * 100}%` }} />
          </div>
          {error ? (
            <div className="mt-6">
              <p className="text-warn">{error}</p>
              <button type="button" className="btn mt-4" onClick={() => setStep(4)}>
                Wróć do budżetu
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <Question title="Dla ilu osób gotujesz?" onBack={null}>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <button key={count} type="button" className="choice min-w-16 text-2xl" aria-pressed={people === count} onClick={() => setPeople(count)}>
                {count}
              </button>
            ))}
          </div>
          <button type="button" className="btn mt-10" onClick={() => setStep(2)}>
            Dalej
          </button>
        </Question>
      ) : null}

      {step === 2 ? (
        <Question title="W które dni tego tygodnia chcesz gotować?" onBack={() => setStep(1)}>
          <p className="mb-6 max-w-md text-lg">Odznacz dni, w które nie gotujesz.</p>
          <div className="flex flex-wrap gap-3">
            {DNI.map((day) => (
              <button key={day} type="button" className="choice" aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}>
                {day}
              </button>
            ))}
          </div>
          <button type="button" className="btn mt-10" disabled={days.length === 0} onClick={() => setStep(3)}>
            Dalej
          </button>
        </Question>
      ) : null}

      {step === 3 ? (
        <Question title="Ile posiłków dziennie chcesz zaplanować?" onBack={() => setStep(2)}>
          <div className="grid max-w-xl gap-3">
            {[
              [1, "1 posiłek", "Obiad"],
              [2, "2 posiłki", "Śniadanie i obiad"],
              [3, "3 posiłki", "Śniadanie, obiad i kolacja. Kolacja bierze lżejsze przepisy z bazy."],
            ].map(([count, label, note]) => (
              <button key={String(count)} type="button" className="choice flex w-full flex-col items-start rounded-2xl px-4 py-3 text-left" aria-pressed={meals === count} onClick={() => setMeals(Number(count))}>
                <span className="block text-xl">{label}</span>
                <span className="mt-1 block text-sm opacity-80">{note}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn mt-10" onClick={() => setStep(4)}>
            Dalej
          </button>
        </Question>
      ) : null}

      {step === 4 ? (
        <Question title="Jaki jest Twój maksymalny budżet na ten plan?" onBack={() => setStep(3)}>
          <p className="mb-6 max-w-md text-lg">Kwota w złotych. Kod sprawdzi ją po zsumowaniu zakupów.</p>
          <label className="block">
            <span className="sr-only">Budżet w złotych</span>
            <input className="budget" inputMode="decimal" value={budgetRaw} onChange={(event) => setBudgetRaw(event.target.value)} />
            <span className="ml-3 text-3xl">zł</span>
          </label>
          <button type="button" className="btn mt-10" disabled={!parsePln(budgetRaw)} onClick={generate}>
            Ułóż plan
          </button>
        </Question>
      ) : null}

      {step === "done" && view && locked ? (
        <Result
          view={view}
          people={locked.people}
          budget={locked.budget}
          hiddenPhotos={hiddenPhotos}
          onHidePhoto={(src) => setHiddenPhotos((current) => ({ ...current, [src]: true }))}
          onOpen={setOpen}
          onAgain={() => setStep(1)}
          overrides={overrides}
          onOverride={(key, value) => {
            setOverrides((current) => {
              const next = { ...current };
              if (!value) delete next[key];
              else next[key] = value;
              return next;
            });
          }}
        />
      ) : null}

      {open ? (
        <RecipeDrawer
          recipe={open}
          people={locked?.people ?? people}
          hidden={hiddenPhotos}
          onHide={(src) => setHiddenPhotos((current) => ({ ...current, [src]: true }))}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </main>
  );
}

function Question({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: (() => void) | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto min-h-[74svh] max-w-3xl px-5 pb-16">
      {onBack ? (
        <button type="button" className="mb-8 text-sm underline decoration-rule underline-offset-4" onClick={onBack}>
          Wstecz
        </button>
      ) : (
        <div className="mb-8 h-5" />
      )}
      <h1 className="max-w-[16ch] text-[clamp(2.2rem,5vw,3.6rem)] leading-none font-semibold tracking-[-0.03em] text-balance">
        {title}
      </h1>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Result({
  view,
  people,
  budget,
  hiddenPhotos,
  onHidePhoto,
  onOpen,
  onAgain,
  overrides,
  onOverride,
}: {
  view: PlanResult;
  people: number;
  budget: number;
  hiddenPhotos: Record<string, true>;
  onHidePhoto: (src: string) => void;
  onOpen: (recipe: Recipe) => void;
  onAgain: () => void;
  overrides: Record<string, { amount: number; unit: string }>;
  onOverride: (key: string, value: { amount: number; unit: string } | null) => void;
}) {
  const many = view.receipt.uzupelnij.reduce((sum, row) => sum + row.braki.length, 0) >= 6;
  return (
    <section className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:px-8">
      <div className="lg:col-span-2">
        {view.komunikat ? (
          <p className="mb-6 max-w-2xl border border-warn px-4 py-3 text-warn">{view.komunikat}</p>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl leading-none font-semibold tracking-[-0.03em]">Twój plan na ten tydzień</h1>
            <p className="mt-4 font-mono text-xl">
              {formatFromGrosze(view.receipt.sumaGrosze)} · {countLabel(view.posilki, "posiłek", "posiłki", "posiłków")} ·{" "}
              {countLabel(view.produkty, "produkt", "produkty", "produktów")}
            </p>
            <p className="mt-2 text-sm">
              Dla {people === 1 ? "1 osoby" : `${people} osób`} · budżet {formatPln(budget)}
            </p>
          </div>
          <button type="button" className="btn" onClick={onAgain}>
            Zaplanuj ponownie
          </button>
        </div>
        {view.ostrzezenie ? <p className="mt-4 max-w-2xl">{view.ostrzezenie}</p> : null}
        {many ? <p className="mt-2 max-w-2xl text-warn">Zostało dużo pozycji bez ilości. Wyliczenie jest niepełne.</p> : null}
      </div>

      <div>
        {view.dni.map((day) => (
          <article key={day.dzien} className="mb-8">
            <h2 className="text-2xl font-semibold">{day.dzien}</h2>
            {day.posilki.map((meal) => {
              const photo = meal.recipe.zdjecie_url;
              const show = photo && !hiddenPhotos[photo];
              return (
                <button key={meal.recipe.id} type="button" className="meal" onClick={() => onOpen(meal.recipe)}>
                  {show ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" onError={() => onHidePhoto(photo)} />
                  ) : (
                    <span className="thumb bg-foam" />
                  )}
                  <span>
                    <span className="block text-sm">{meal.typ}</span>
                    <span className="text-xl">{meal.recipe.nazwa}</span>
                  </span>
                </button>
              );
            })}
          </article>
        ))}
      </div>

      <Receipt view={view} overrides={overrides} onOverride={onOverride} hiddenPhotos={hiddenPhotos} onHidePhoto={onHidePhoto} />
    </section>
  );
}

function Receipt({
  view,
  overrides,
  onOverride,
  hiddenPhotos,
  onHidePhoto,
}: {
  view: PlanResult;
  overrides: Record<string, { amount: number; unit: string }>;
  onOverride: (key: string, value: { amount: number; unit: string } | null) => void;
  hiddenPhotos: Record<string, true>;
  onHidePhoto: (src: string) => void;
}) {
  const receipt = view.receipt;
  return (
    <aside className="ticket h-fit lg:sticky lg:top-6">
      <p className="font-mono tracking-[0.08em]">LIDL</p>
      <p className="mt-1 text-sm text-ticket-soft">Katalog i cennik budżetowy. Nie jest to paragon z kasy.</p>
      <ul className="mt-4">
        {receipt.lines.map((line, index) => (
          <ReceiptRow key={`${line.nazwa}-${index}`} line={line} hiddenPhotos={hiddenPhotos} onHidePhoto={onHidePhoto} />
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t border-[#231e16] pt-3 font-mono text-lg">
        <span>{receipt.kompletna ? "RAZEM" : "SUMA WYCENIONYCH"}</span>
        <span>{formatFromGrosze(receipt.sumaGrosze)}</span>
      </p>
      {receipt.opakowania > 0 && receipt.zuzycie > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-ticket-soft">
          Opakowania z katalogu: {formatPln(receipt.opakowania)}. Reszta, {formatPln(receipt.zuzycie)}, to koszt zużycia wg stawki za 100 g, nie cena półki.
        </p>
      ) : null}
      {receipt.uzupelnij.length ? (
        <div className="mt-6">
          <h2 className="text-base font-semibold">Uzupełnij ilość</h2>
          <p className="mt-1 text-xs leading-relaxed text-ticket-soft">
            Te pozycje mają cenę za 100 g, ale bez ilości nie wchodzą do sumy.
          </p>
          <ul className="mt-3 space-y-4">
            {receipt.uzupelnij.flatMap((row) =>
              row.braki.map((gap) => {
                const key = `${gap.recipeId}:${gap.lineIndex}`;
                const current = overrides[key];
                return (
                  <li key={key} className="border-t border-dashed border-[#d9d0bc] pt-3 text-sm">
                    <p className="font-medium">{row.nazwa}</p>
                    <p className="text-ticket-soft">
                      {gap.recipeName} · {gap.originalMeasure || "brak jednostki"} · {formatPln(row.cenaZa100g)} / 100 g
                    </p>
                    <GapEditor
                      name={row.nazwa}
                      amount={current?.amount}
                      unit={current?.unit || gap.originalUnit || "g"}
                      onCommit={(amount, unit) => onOverride(key, amount ? { amount, unit } : null)}
                    />
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function ReceiptRow({
  line,
  hiddenPhotos,
  onHidePhoto,
}: {
  line: ReceiptLine;
  hiddenPhotos: Record<string, true>;
  onHidePhoto: (src: string) => void;
}) {
  const photo = line.zdjecie;
  const show = photo && !hiddenPhotos[photo];
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-2 border-t border-dashed border-[#d9d0bc] py-2 font-mono text-sm">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="mt-0.5 h-8 w-8 object-cover" onError={() => onHidePhoto(photo)} />
      ) : (
        <span className="w-0" />
      )}
      <span>
        {line.kind === "opakowanie" && line.url ? (
          <a href={line.url} target="_blank" rel="noreferrer" className="underline decoration-[#d9d0bc] underline-offset-4">
            {line.nazwa}
          </a>
        ) : (
          line.nazwa
        )}
        <span className="mt-0.5 block text-xs text-ticket-soft">
          {line.kind === "opakowanie"
            ? `${formatAmount(Number(line.ilosc) || 0)} ${line.jednostka} · ${formatPln(line.cena || 0)} × ${line.sztuk}`
            : line.kind === "woda"
              ? "woda z kranu"
              : `zużycie ${formatGrams(line.iloscG || 0)} g · ${formatPln(line.cenaZa100g || 0)} / 100 g`}
          {line.promocja ? " · promocja" : ""}
        </span>
      </span>
      <span>{formatFromGrosze(line.kosztGrosze)}</span>
    </li>
  );
}

function GapEditor({
  name,
  amount,
  unit,
  onCommit,
}: {
  name: string;
  amount?: number;
  unit: string;
  onCommit: (amount: number | null, unit: string) => void;
}) {
  const [draft, setDraft] = useState(amount != null ? String(amount) : "");
  const [picked, setPicked] = useState(unit);
  return (
    <div className="mt-2 flex gap-2">
      <input
        className="w-20 border-b border-[#231e16] bg-transparent font-mono"
        inputMode="decimal"
        aria-label={`Ilość: ${name}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = Number(draft.replace(",", "."));
          if (Number.isFinite(next) && next > 0) onCommit(next, picked);
          else onCommit(null, picked);
        }}
      />
      <select
        className="bg-transparent"
        aria-label={`Jednostka: ${name}`}
        value={picked}
        onChange={(event) => {
          const nextUnit = event.target.value;
          setPicked(nextUnit);
          const next = Number(draft.replace(",", "."));
          if (Number.isFinite(next) && next > 0) onCommit(next, nextUnit);
        }}
      >
        {UNITS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

function RecipeDrawer({
  recipe,
  people,
  hidden,
  onHide,
  onClose,
}: {
  recipe: Recipe;
  people: number;
  hidden: Record<string, true>;
  onHide: (src: string) => void;
  onClose: () => void;
}) {
  const photo = recipe.zdjecie_url;
  const show = photo && !hidden[photo];
  const time = [
    recipe.czas_przygotowania_min ? `${recipe.czas_przygotowania_min} min przygotowania` : null,
    recipe.czas_gotowania_min ? `${recipe.czas_gotowania_min} min gotowania` : null,
  ].filter(Boolean);
  return (
    <div className="fixed inset-0 z-30">
      <button type="button" className="absolute inset-0 bg-ink/35" aria-label="Zamknij przepis" onClick={onClose} />
      <article className="drawer absolute top-0 right-0 flex h-full w-full max-w-md flex-col overflow-auto bg-foam p-6" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
        <button type="button" className="self-start text-sm underline decoration-rule underline-offset-4" onClick={onClose} autoFocus>
          Zamknij
        </button>
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="mt-5 h-36 w-full object-cover" onError={() => onHide(photo)} />
        ) : null}
        <h2 id="recipe-title" className="mt-5 text-3xl leading-none font-semibold tracking-[-0.03em]">
          {recipe.nazwa}
        </h2>
        <p className="mt-3 text-sm">
          {recipe.porcje
            ? `Przepis jest na ${countLabel(recipe.porcje, "porcję", "porcje", "porcji")}. W planie liczymy dla ${people === 1 ? "1 osoby" : `${people} osób`}.`
            : `Baza nie podaje liczby porcji. Przyjmujemy bazę 4 i skalujemy do ${people === 1 ? "1 osoby" : `${people} osób`}.`}
        </p>
        {time.length ? <p className="mt-1 text-sm">{time.join(" · ")}</p> : null}
        <h3 className="mt-8 text-lg font-semibold">Składniki</h3>
        <ul className="mt-2">
          {recipe.skladniki.map((line, index) => (
            <li key={`${line.id}-${index}`} className="border-t border-rule py-2">
              {line.nazwa} · {measure(line)}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-lg font-semibold">Przygotowanie</h3>
        <ol className="mt-2 list-decimal space-y-3 pl-5">
          {stepsOf(recipe).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </article>
    </div>
  );
}
