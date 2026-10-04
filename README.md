# Nakrycie

Showcase planu posiłków na danych z paczki testowej. Next.js, TypeScript, Tailwind. Bez bazy i bez wołania modelu.

Plan układa kod. Ceny biorą się z `dane_aplikacji.json`: pełne opakowanie, gdy katalog podaje gramaturę, w pozostałych wypadkach stawka za 100 g. Brak ilości nie dostaje wymyślonej ceny.

```bash
npm install
npm test
npm run dev
```

Klucz z `.env.example` nie jest używany.
