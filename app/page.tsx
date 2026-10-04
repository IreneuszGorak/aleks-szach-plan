import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { AppData, Product, Recipe } from "@/lib/types";

function loadData(): AppData {
  const file = path.join(process.cwd(), "public", "dane_aplikacji.json");
  return JSON.parse(readFileSync(file, "utf8")) as AppData;
}

function formatPln(value: number) {
  return (
    value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł"
  );
}

function catalogue(data: AppData) {
  const picked: Product[] = [];
  const seen = new Set<string>();
  for (const product of Object.values(data.produkty)) {
    if (!product?.nazwa || !(product.cena > 0) || seen.has(product.nazwa)) continue;
    seen.add(product.nazwa);
    picked.push(product);
    if (picked.length === 5) break;
  }
  const grosze = picked.reduce((sum, product) => sum + Math.round(product.cena * 100), 0);
  return { picked, total: grosze / 100 };
}

function example(data: AppData) {
  const breakfasts = data.przepisy.filter((recipe) => recipe.kategoria === "Śniadanie");
  const lunches = data.przepisy.filter((recipe) => recipe.kategoria === "Kurczak");
  return [
    { day: "Poniedziałek", breakfast: breakfasts[0], lunch: lunches[0] },
    { day: "Wtorek", breakfast: breakfasts[1], lunch: lunches[3] },
  ];
}

function packLabel(product: Product) {
  const amount = Number(product.ilosc);
  const shown = Number.isInteger(amount)
    ? amount.toLocaleString("pl-PL")
    : amount.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  return `${shown} ${product.jednostka}`;
}

function Shot({ recipe }: { recipe: Recipe }) {
  if (!recipe.zdjecie_url) return <span className="thumb block bg-rule" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={recipe.zdjecie_url} alt="" className="thumb" />
  );
}

export default function HomePage() {
  const data = loadData();
  const slip = catalogue(data);
  const days = example(data);

  return (
    <main>
      <section className="awning bg-awning text-foam">
        <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
          <div className="max-w-xl">
            <p className="text-lg font-semibold tracking-tight">Nakrycie</p>
            <h1 className="mt-10 max-w-[12ch] text-[clamp(2.7rem,6.4vw,4.7rem)] leading-[0.96] font-semibold tracking-[-0.03em] text-balance">
              Plan na tydzień, z rachunkiem zanim pójdziesz do Lidla.
            </h1>
            <p className="mt-6 max-w-[38rem] text-lg leading-snug text-mist">
              Wybierasz osoby, dni i budżet. Dostajesz przepisy z bazy i listę zakupów. Tam, gdzie
              katalog podaje opakowanie, liczymy pełne sztuki. Reszta ma stawkę za 100 g i jest tak
              podpisana. Ceny nie odświeżają się same.
            </p>
            <Link href="/plan/" className="btn btn-light mt-8">
              Zaplanuj mój tydzień
            </Link>
          </div>
          <aside className="ticket ticket-hero max-w-sm justify-self-start lg:justify-self-end" aria-label="Wycinek katalogu">
            <p className="font-mono text-sm tracking-[0.08em]">LIDL</p>
            <p className="mt-1 text-sm text-ticket-soft">Wycinek katalogu, nie Twój koszyk.</p>
            <ul className="mt-5">
              {slip.picked.map((product) => (
                <li key={product.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-dashed border-[#d9d0bc] py-2 font-mono text-[0.92rem]">
                  <span>
                    {product.url ? (
                      <a href={product.url} target="_blank" rel="noreferrer" className="underline decoration-[#d9d0bc] underline-offset-4">
                        {product.nazwa}
                      </a>
                    ) : (
                      product.nazwa
                    )}
                    <span className="mt-0.5 block text-xs text-ticket-soft">
                      {packLabel(product)}
                      {product.promocja?.aktywna ? " · promocja" : ""}
                    </span>
                  </span>
                  <span>{formatPln(product.cena)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-baseline justify-between font-mono text-lg">
              <span>RAZEM</span>
              <span>{formatPln(slip.total)}</span>
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
        <h2 className="max-w-[16ch] text-4xl leading-none font-semibold tracking-[-0.03em]">
          Od osób przy stole do listy, którą da się kupić.
        </h2>
        <ol className="mt-10 max-w-3xl text-2xl leading-snug">
          <li className="border-t border-rule py-4">Mówisz, dla ilu osób, w które dni i ile posiłków.</li>
          <li className="border-t border-rule py-4">Przepisy pochodzą tylko z dostarczonej bazy.</li>
          <li className="border-t border-rule py-4">Budżet sprawdza kod, po ułożeniu dań i zsumowaniu składników.</li>
          <li className="border-t border-rule border-b py-4">
            Opakowanie z katalogu wchodzi w całości. 700 g przy paczce 500 g to dwie paczki.
          </li>
        </ol>
      </section>

      <section className="bg-foam">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <h2 className="text-4xl leading-none font-semibold tracking-[-0.03em]">Tak wygląda tydzień w bazie.</h2>
          <p className="mt-4 max-w-xl text-lg">To ilustracja nazw z danych, nie plan wygenerowany dla Ciebie.</p>
          <div className="mt-10 grid gap-12 md:grid-cols-2">
            {days.map((day) => (
              <article key={day.day}>
                <h3 className="text-2xl font-semibold">{day.day}</h3>
                <div className="meal">
                  <Shot recipe={day.breakfast} />
                  <p>
                    <span className="block text-sm">Śniadanie</span>
                    <span className="text-xl">{day.breakfast.nazwa}</span>
                  </p>
                </div>
                <div className="meal">
                  <Shot recipe={day.lunch} />
                  <p>
                    <span className="block text-sm">Obiad</span>
                    <span className="text-xl">{day.lunch.nazwa}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
          <Link href="/plan/" className="btn mt-12">
            Zaplanuj mój tydzień
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm leading-relaxed lg:px-8">
        Ceny katalogowe pochodzą z dostarczonej paczki Lidla. Pozostałe stawki to cennik budżetowy za
        100 g. To nie jest kasa na żywo i nie jest gwarancją, że produkt leży dziś na półce.
      </footer>
    </main>
  );
}
