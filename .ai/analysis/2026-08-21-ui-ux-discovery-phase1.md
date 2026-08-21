# Raport: UI/UX discovery — Phase 1 (stan UI + dostępne skills)

- **Data:** 2026-08-21
- **Repo:** 10xCards
- **Branch bazowy:** `main` (czysty, `4a601cd`)
- **Typ:** analiza read-only — nic nie zaimplementowano, nic nie uruchomiono
- **Cel:** odpowiedzieć na dwa pytania przed jakąkolwiek decyzją o redesignie: (1) jak wygląda obecna architektura UI/UX 10xCards, (2) które dostępne w repo skills UI/UX rzeczywiście mogą pomóc ją ulepszyć
- **Zakres świadomie pominięty:** propozycje wyglądu, strategie redesignu (Phase 3), jakiekolwiek zmiany w `src/`

---

## 1. Architektura UI/UX — stan faktyczny

### 1.1 Warstwa techniczna

| Element       | Stan faktyczny                                                                                                                     | Źródło                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Renderowanie  | Astro 6, strony `.astro` SSR + wyspy React 19, wszystkie na `client:load`                                                          | `src/pages/`, `package.json`            |
| Styling       | Tailwind 4 przez `@tailwindcss/vite` (CSS-first, brak `tailwind.config`)                                                           | `package.json`, `src/styles/global.css` |
| Design system | shadcn/ui **skonfigurowany** (`style: new-york`, `baseColor: neutral`, `cssVariables: true`), ale zainstalowany **jeden** prymityw | `components.json`, `src/components/ui/` |
| Tokeny        | Pełny zestaw shadcn: `:root` (light) + `.dark` + mapowanie `@theme inline`                                                         | `src/styles/global.css`                 |
| Ikony         | `lucide-react` w 10 komponentach — najbardziej spójny element całego UI                                                            | `src/components/**`                     |
| Narzędzia     | `cva`, `clsx`, `tailwind-merge` (`cn`) — obecne, użyte prawie wyłącznie w `button.tsx`                                             | `package.json`, `src/lib/utils.ts`      |
| Layout        | Jeden `Layout.astro` → `Banner` (config errors) + `Topbar` (tylko gdy user) + `RetentionBanner` + `<slot/>`                        | `src/layouts/Layout.astro`              |
| Nawigacja     | `Topbar.astro`: 5 linków + email + Sign out, wrapping flex row, `aria-current` na aktywnym                                         | `src/components/Topbar.astro`           |

### 1.2 Cztery twarde ustalenia (mierzone)

**(1) Design system istnieje i jest omijany.**

Policzone w `src/**/*.{astro,tsx}`:

- **4** wystąpienia klas tokenowych (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, …)
- **247** wystąpień zahardkodowanej palety (`bg-white/10`, `text-blue-100/70`, `border-red-500/30`, `bg-purple-600`, …)

`Button` — jedyny komponent tokenowy — jest importowany w 3 miejscach (`auth/SubmitButton.tsx`, `library/CardRow.tsx`, `settings/DeleteAccountButton.tsx`), a w `src/components/auth/SubmitButton.tsx:23` jego wariant jest natychmiast nadpisany `className="... bg-purple-600 ..."`. Design system jest obchodzony dokładnie tam, gdzie został użyty.

Rozkład hardkodowanych kolorów per plik (top): `review/ReviewSession.tsx` 19, `pages/library.astro` 15, `Welcome.astro` 14, `generate/DraftReviewList.tsx` 11, `pages/settings.astro` 8, `Topbar.astro` 8.

**(2) Tokeny i faktyczny wygląd są w sprzeczności.**

`body` ma `class="bg-cosmic"` — hardkodowany ciemny gradient (`#0a0e1a → #0f1529 → #0a0e1a`, `@utility bg-cosmic` w `global.css`). Klasa `.dark` **nie jest nigdzie w `src/` aplikowana** (jedyne trafienia to warianty `dark:` wewnątrz `button.tsx`). Efekt: aplikacja wygląda na ciemną, a tokeny rozwiązują się do palety **jasnej**. `<Button>` w Library renderuje się jako `bg-primary` = prawie czarny przycisk na ciemnym tle, podczas gdy reszta UI używa własnych „szklanych" klas.

To nie jest kwestia gustu — to dwa systemy kolorów działające przeciwko sobie.

**(3) Brak komponentów współdzielonych na poziomie layoutu — jest copy-paste.**

Ten sam przepis powtarza się dosłownie w `dashboard` / `generate` / `library` / `review` / `settings` / `auth/signin`:

- karta: `rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl`
- nagłówek: `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text ... text-transparent`
- powrót: `← Dashboard`
- błąd: `rounded-lg border border-red-500/30 bg-red-900/30 ... text-red-300`
- read-only: `rounded-lg border border-amber-500/30 bg-amber-900/20 ... text-amber-200`

Nie istnieje `Card`, `PageHeader`, `Section`, `Alert`, `EmptyState`, `Input` ani `Dialog`. Jedyne „prymitywy" to `Button` oraz nieużywany starterowy `ui/LibBadge.astro`.

Powtarza się też wzorzec logiczny: mapa `FALLBACK_MESSAGES` (kod błędu → komunikat) jest zduplikowana w 5 komponentach. To realna konwencja repo, ale bez właściciela.

**(4) Responsywność praktycznie nie istnieje poza landingiem.**

Całe `src/` ma **12** użyć breakpointów: `Welcome.astro` 6, `button.tsx` 2, `Layout.astro` 1, `Topbar.astro` 1 (+2 pozostałe). Czyli `dashboard`, `generate`, `library`, `review` i `settings` mają **zero** reguł responsywnych — trzymają się na `max-w-3xl` + `flex-wrap`. Brak nawigacji mobilnej: 5 linków + email + Sign out zawijają się w wiersz.

### 1.3 Stan per-ekran

| Ekran          | Ustalenie                                                                                                                                                                                                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (landing)  | Wciąż strona marketingowa startera: tytuł „10x Astro Starter", copy o „cosmic developer experience", trzy karty „Authentication Ready / Modern Stack / Developer Experience" (mówiące o Astro 5, gdy w repo jest Astro 6), inline SVG zamiast lucide, cosmic orbs + star field. Nowy użytkownik nie dowiaduje się, czym jest 10xCards. |
| `Layout.astro` | Domyślny `title` = `"10x Astro Starter"`; `package.json → name` = `10x-astro-starter`                                                                                                                                                                                                                                                  |
| `/dashboard`   | Statyczna karta z emailem + „Use the navigation above". Zero danych produktowych (brak liczby due, rozmiaru biblioteki, wejścia w sesję). Jest to ekran docelowy redirectu po logowaniu (`index.astro:5`).                                                                                                                             |
| `/generate`    | Sensowna logika (walidacja 200–8000 znaków, licznik elapsed, trwałe drafty). UI: dwie „szklane" sekcje; Draft Review renderuje się **nad** formularzem generowania.                                                                                                                                                                    |
| `/library`     | Najbogatszy ekran: search (GET form), paginacja server-side z clampem, inline edit. Mutacje kończą się `window.location.assign("/library")` — pełne przeładowanie. Delete przez natywny `window.confirm()`.                                                                                                                            |
| `/review`      | Najlepiej dopracowany ekran: skróty klawiszowe z widocznymi `<kbd>`, `aria-keyshortcuts`, guard na double-submit (`lockRef`), trzy osobne stany końcowe. Wzorzec, nie problem.                                                                                                                                                         |
| `/settings`    | Wyłącznie Danger zone (delete / cancel). Brak innych ustawień.                                                                                                                                                                                                                                                                         |
| `/auth/*`      | Spójne wewnętrznie: wąska karta `max-w-sm`, lucide, `PasswordToggle`, `ServerError`, `FormField`.                                                                                                                                                                                                                                      |
| `Banner.astro` | Jedyny komponent ze scoped `<style>` i hardkodowanymi hexami w **jasnej** palecie (`#dbeafe`, `#fef3c7`, `#fee2e2`). Jedzie na nim `RetentionBanner`, więc globalny baner read-only wygląda obco na każdym ekranie.                                                                                                                    |

### 1.4 Dostępność — baseline

`eslint-plugin-jsx-a11y` aktywny. W kodzie: `aria-current` na nawigacji, `aria-keyshortcuts` na przyciskach review, `<label htmlFor>` na inputach, `aria-label="Library pagination"`, `role="alert"` / `role="status"` w `Banner`. Baseline jest przyzwoity. Wyjątek: akcje destrukcyjne idą przez natywny `window.confirm()` (`CardRow.tsx`, `DeleteAccountButton.tsx`) zamiast przez prymityw dialogu.

### 1.5 Co to znaczy dla redesignu

Logika biznesowa jest czysto odseparowana: `lib/leitner.ts`, `lib/review-shortcuts.ts` (czyste, testowane jednostkowo), `lib/parse-error.ts`, endpointy w `src/pages/api/`. Komponenty UI to cienka warstwa nad `fetch()`.

**Redesign może być zmianą wyłącznie prezentacyjną** — bez dotykania API, schedulera SRS i RLS. To istotnie obniża ryzyko.

Kontekst roadmapy: slice **S-06 „Usprawnienia UX" ma status `done`** (2026-06-02 — bulk actions, reset sesji, loading states, post-login redirect, paginacja + search). Polish funkcjonalny już był. To, co zostało, jest **strukturalne**, nie kosmetyczne: brak systemu, brak responsywności, tożsamość startera.

---

## 2. Skills UI/UX dostępne w repo

**Lokalizacja:** skills OM **nie są** w `.claude/skills/` — siedzą w `.agents/skills/` (36 sztuk). Trzy dotyczą UX; przeczytane w całości.

### 2.1 `om-ux-setup` — ekstrakcja kontraktu designu

Tworzy `.uxproof/` przez `npx uxproof@0.3.1 init --no-skills` (wersja przypięta celowo — `@latest` wykonywałby nieprzejrzany zdalny kod przy każdym uruchomieniu; `--no-skills`, bo workflow agentowy daje kolekcja).

Zawartość kontraktu:

- `contract.json` — framework, system stylowania, korzenie komponentów, odpowiedniki elementów natywnych, archetypy ekranów z przykładami, liczniki
- `tokens.json` — każdy token z rodzajem i plikiem źródłowym
- `components.json` — rejestr komponentów
- `conventions.md` — reguły domu, z **sekcją manualną**, która przeżywa każdą regenerację i **wygrywa z regułami generowanymi** przy konflikcie (to jest powierzchnia lokalnego override'u honorowana przez pozostałe skille UX)

**Stan: `.uxproof/` w repo nie istnieje.** Dwa pozostałe skille UX nie mają dziś według czego sądzić — jadą na uniwersalnych tierach dowodowych zamiast na naszym systemie.

Skill degraduje się uczciwie: gdy repo nie ma systemu designu, zapisuje ten fakt i proponuje de-facto paletę wyprowadzoną z kolorów, których kod już używa. W naszym przypadku sytuacja jest inna i bardziej użyteczna: system **jest**, ale kod go nie używa — kontrakt zamienia to w mierzalny rozjazd zamiast opinii.

Czego **nie** robi: niczego nie recenzuje (żadnych findings, werdyktów, list „co jest źle"); nie ocenia plików projektowych względem kontraktu — SKILL.md mówi wprost, że nie pokrywa tego żaden skill w kolekcji.

### 2.2 `om-ux-shape` — decyzja produktowa, nie wygląd

Trzy tryby: **Shape** (mglisty pomysł), **Review** (istniejący koncept / flow / cały moduł / obszar produktu), **Handoff** (kierunek zdecydowany, brakuje detalu implementacyjnego).

Dla oceny całego 10xCards właściwy jest **Review** — `om-ux-review-pr` sam tu odsyła, gdy przedmiotem jest moduł, a nie increment PR-a.

Produkuje:

- diagnozę jednym zdaniem (odróżniającą realną przeszkodę od żądanej funkcji)
- **ledger dowodowy**: fakt / wniosek / założenie / niewiadoma, z zakazem wymyślania badań, cytatów i metryk
- jeden podstawowy outcome behawioralny + prawdopodobny efekt biznesowy + guardrail przeciw szkodliwej optymalizacji
- 2–3 **istotnie różne** mechanizmy, z rekomendacją i decydującym trade-offem
- najmniejszy spójny zakres z jawnym podziałem **now / later / not-doing**
- konkretny kontrakt interakcji: nazwane ekrany, nazwane komponenty z rejestru, **prawdziwe labelki, nagłówki, zdania empty state i komunikaty błędów** — nie ich opisy

Kryterium ukończenia jest twarde: _„jeśli czytelnik nie mógłby tego zbudować lub narysować z twojego outputu, krok nie jest skończony"_. W trybie Review findings rankowane są przez impact × frequency × reach, nigdy przez łatwość naprawy.

Shape **Handoff** jest zaprojektowany, by karmić skille implementujące kolekcji — wpina się w istniejący pipeline (`om-auto-create-pr` / `om-auto-implement-spec`).

### 2.3 `om-ux-review-pr` — review UI w prawdziwej przeglądarce

Recenzuje user-facing rezultat PR-a. Dyscyplina: każda rekomendacja niesie **cztery części** — dowód, wzorzec, trade-off, kryterium akceptacji. Finding bez którejś części „nie jest gotowy, żeby go wypowiedzieć". Opinie są dozwolone, ale etykietowane jako opinie.

Kroki istotne dla nas:

- **3. „Walk, do not glance"** — wykonuje zadania użytkownika (create, edit, link, delete), nie ogląda ekranów. Pusta baza nie jest blokerem: tworzenie danych przez UI _jest_ testem flow tworzenia.
- **4. Macierz stanów** — default, empty, loading, error, no-permission, long-content, **narrow viewport**. Brakujący stan jest findingiem. Dla motywów używa własnego togglera aplikacji (motywy klasowe ignorują emulację `prefers-color-scheme`); gdy togglera nie ma, **raportuje dark mode jako nieprzeprowadzony** zamiast po cichu pominąć.
- **5. Zgodność z kontraktem** — hardkodowane kolory tam, gdzie istnieją tokeny; surowe elementy tam, gdzie rejestr ma komponent domu; ekrany ignorujące własny archetyp repo. To jest dokładnie diagnoza z §1.2, tyle że wypowiadana automatycznie i z dowodami.
- **6. Humane gate** — kto korzysta na danym wyborze projektowym.

Dwie ścieżki wykonania: **tracker** (numer PR → jeden idempotentny komentarz ze screenshotami, przez marker) albo **local** (brak PR → ten sam raport zwrócony do użytkownika, screenshoty lokalnie, zero operacji na trackerze). Skill jest **doradczy**: nie nakłada labeli, nie zmienia kodu źródłowego, nie blokuje merge'a.

### 2.4 Czy istnieje wyższy orchestrator? — NIE

Weryfikacja: `grep -rn "om-ux" .agents/skills/om-pr-autopilot/` → **pusto**.

`om-pr-autopilot` („diagnose → classify → chain → report") dispatchuje wyłącznie: `om-auto-continue-pr`, `om-auto-continue-pr-loop`, `om-auto-fix-pr`, `om-auto-review-pr`, `om-auto-qa-pr`, `om-followup-issue-from-pr`, `om-approve-merge-pr`.

Trójka `om-ux-*` występuje tylko w liście instalacyjnej `om-setup-agent-pipeline/references/skill-coverage.md` (ROSTER) oraz we własnych referencjach.

**Konsekwencja praktyczna: UX review nie wydarzy się samo w naszym pipeline.** Musi zostać świadomie wpięte jako osobny krok obok `om-auto-review-pr` / `om-auto-qa-pr`.

### 2.5 Czego te skills NIE zrobią

1. **Nie wyprodukują wyglądu.** Żaden z trzech nie generuje wizualnego designu, mockupów ani systemu wizualnego. `om-ux-shape` decyduje o zachowaniu produktu i interakcji, nie o estetyce.
2. **Nie ocenią plików projektowych.** `om-ux-setup` mówi wprost, że review designów względem kontraktu „nie jest pokryte przez żaden skill w tej kolekcji" i każe to powiedzieć zamiast improwizować.
3. **Nie zrobią regresji wizualnej.** Brak visual diff / pixel regression. To zostaje po stronie Playwrighta (`toMatchSnapshot`) — zgodnie z tym, co `CLAUDE.md` mówi już w kontekście `/10x-e2e`.
4. **`om-auto-qa-pr` to nie jest UX review.** To QA funkcjonalne (czy działa + screenshoty jako dowód, read-only na kodzie). Ocena jakości designu leży poza jego zakresem. Środowisko jest gotowe: `.ai/qa/test-env.json`, `.ai/scripts/test-env-up.ps1`, `.ai/browsers/playwright.md`.
5. **Nie zdecydują za nas kierunku.** Rekomendację dają; wybór strategii pozostaje decyzją człowieka.

Poza repo istnieją narzędzia komplementarne (skill `design` do canvasu mockupów, plugin `frontend-design` w oficjalnym marketplace) — odnotowane, nieproponowane na tym etapie.

---

## 3. Wnioski Phase 1 (trzy zdania)

Aplikacja ma **kompletny design system, którego nie używa**: 4 klasy tokenowe na 247 hardkodowanych, tokeny w palecie jasnej pod ciemnym `bg-cosmic`, jeden zainstalowany prymityw shadcn i pięć ekranów bez ani jednego breakpointu.

Tożsamość jest wciąż starterowa — landing, domyślny `<title>` i nazwa pakietu mówią „10x Astro Starter".

Logika jest czysto odseparowana, więc redesign da się przeprowadzić jako zmianę wyłącznie prezentacyjną, przyrostowo, bez ruszania API i schedulera.

---

## 4. Następny krok — decyzja otwarta

**Rekomendacja: `om-ux-setup` jako pierwszy krok**, przed jakąkolwiek oceną i projektowaniem.

Powód nie jest proceduralny: bez `.uxproof/` zarówno `om-ux-shape` (Review), jak i `om-ux-review-pr` sądzą według reguł uniwersalnych zamiast naszych, a najcenniejszy check — „hardkodowane kolory tam, gdzie istnieją tokeny" — wymaga kontraktu, żeby w ogóle mógł się odpalić. Skill nie zmienia ani jednej linii `src/`.

Do zaakceptowania przed uruchomieniem:

- uruchamia `npx uxproof@0.3.1` — zdalny pakiet, wersja przypięta, flaga `--no-skills`
- zapisuje nowy katalog `.uxproof/` w repo (skill rekomenduje go zacommitować); `context/` i `.claude/settings.local.json` pozostają nietknięte
- w kroku 4 zadaje 2–3 pytania o rzeczy, których skaner nie wywnioskuje (konwencje nazewnicze, wzorce zakazane, ton, świadomie utrzymywane wyjątki) — wymaga odpowiedzi człowieka

### Warianty

| Wariant                                           | Opis                                                                                                                                                                                                         | Koszt / ryzyko                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — `om-ux-setup` → Phase 2** _(rekomendowany)_ | Kontrakt najpierw, ocena z dowodami potem. Phase 2 = `om-ux-shape` w trybie **Review** nad całym produktem, z browser walkiem po `http://127.0.0.1:4321` jako materiałem dowodowym (środowisko QA już stoi). | Jeden dodatkowy krok; efekt: ocena wskazująca konkretne pliki i rozjazdy zamiast „jest niespójnie"                                                                        |
| **B — Phase 2 od razu, bez kontraktu**            | Szybciej o jeden krok.                                                                                                                                                                                       | Tracimy check zgodności z kontraktem i sekcję manualną (miejsce na decyzje typu „`bg-cosmic` zostaje / odchodzi"); prawdopodobny powrót po kontrakt przed pierwszym PR-em |
| **C — sam browser walk**                          | Podniesienie aplikacji i przejście wszystkich flow w Playwrighcie ze screenshotami stanów.                                                                                                                   | Czysty materiał wizualny, zero artefaktów w repo; dobre, jeśli najpierw chcemy _zobaczyć_ aplikację przed wyborem metody                                                  |

**Phase 3 (strategie redesignu) świadomie odłożona** — bez oceny z Phase 2 byłaby zgadywaniem.

---

## 5. Wynik runu `om-ux-setup` (wariant A, 2026-08-21)

Wykonany wariant A. Nic nie zacommitowano; `src/`, `context/` i `.claude/settings.local.json` nietknięte.

### 5.1 Wygenerowane artefakty

`npx uxproof@0.3.1 init --no-skills` → `.uxproof/` (4 pliki):

| Plik              | Zawartość                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `contract.json`   | stack, korzenie komponentów, `nativeEquivalents`, `archetypes: []`, `warnings: []`, liczniki |
| `tokens.json`     | 67 tokenów (31 color + 32 alias + 3 other + 1 size), wszystkie z `src/styles/global.css`     |
| `components.json` | 15 komponentów, wyłącznie `.tsx`                                                             |
| `conventions.md`  | reguły generowane + sekcja manualna (wypełniona, patrz §5.4)                                 |

Liczniki ekstraktora: `tokens: 67`, `colorTokens: 62`, `components: 15`, `proposedColors: 0`, `warnings: []`.

`proposedColors: 0` oznacza, że ścieżka „zaproponuj de-facto paletę" się nie uruchomiła — repo **ma** zadeklarowane tokeny. Skutek uboczny korzystny: `bg-cosmic` i paleta blue/purple **nie weszły** do kontraktu jako reguła.

### 5.2 Poprawnie wykryty foundation

- **Semantyczny zestaw tokenów** w `src/styles/global.css` — kompletny, `oklch`, pary light/dark, mapowanie `@theme inline`. Realna podstawa, ale **niezabrandowana**: to domyślna paleta shadcn `neutral` (kolory bazowe mają chromę 0; kolorowe są tylko `destructive` i `chart-*`).
- **`Button` + `cn()` + `cva` + `lucide-react`** — prawdziwe prymitywy; `nativeEquivalents` poprawnie zapisał `<button>` → `<Button>`.
- **Struktura komponentów** — foldery domenowe (`auth/`, `generate/`, `library/`, `review/`, `settings/`, `ui/`), nazwy `PascalCase.tsx`, zgodne z `AGENTS.md`.
- **Reguła „kolory pochodzą z tokenów"** — właściwa; fakt, że kod łamie ją 247× (§1.2), czyni ją użyteczną, a nie nieważną.

### 5.3 Ograniczenia ekstraktora

1. **Ślepota na Astro.** Framework wykryty jako `react`; rejestr obejmuje wyłącznie `.tsx`. Poza zasięgiem zostaje 15 plików: 5 komponentów `.astro` (`Topbar`, `Banner`, `RetentionBanner`, `Welcome`, `ui/LibBadge`), `layouts/Layout.astro` i 9 stron z `src/pages/`. **Pokrycie rejestru ≈ 50% plików UI.** Stąd `archetypes: []` — brak kanonicznego przykładu ekranu, do którego można porównać nowy widok.
2. **Contamination z `packages/code-reviewer/`.** `workspace: true` i `validation: zod` pochodzą z tego pakietu (CLI do AI code review, AI SDK + OpenRouter + zod). Root `package.json` nie ma pola `workspaces`; aplikacja webowa nie używa `zod` i nie ma go w `src/`.
3. **`tokens.json` niesie wartości z bloku `.dark`.** Ekstraktor deduplikuje po nazwie i zostawia ostatnią deklarację, więc zapisane jest `background = oklch(0.145 0 0)`. Runtime rozwiązuje `:root` (paleta jasna), bo `.dark` nie jest nigdzie w `src/` aplikowana, a tłem steruje hardkodowany `bg-cosmic`. **Nazwy tokenów są wiarygodne, wartości opisują gałąź, której aplikacja nie renderuje.**
4. Dodatkowo: 13 z 31 tokenów kolorystycznych (`sidebar*` ×8, `chart-1…5` ×5 = 42%) opisuje funkcje, których produkt nie ma — osad shadcn/startera.

Test higieny samego ekstraktora wypadł czysto (`warnings: []`) — wszystkie tokeny pochodzą z jednego realnego pliku, nie ze scratch/generated. Punkty 1–4 wykryto poza jego testem.

### 5.4 Trzy decyzje zapisane w sekcji manualnej

Sekcja manualna `conventions.md` przeżywa `uxproof sync` i wygrywa z regułami generowanymi przy konflikcie. Zapisano:

1. **Legacy styling startera** (`bg-cosmic`, glass `white/10`, gradienty blue/purple) → **legacy, nie rozszerzać**. Wprost: _„Frequency is not intent"_ (247 vs 4). Zakaz cytowania wzorca jako przykładu do naśladowania **oraz** zakaz zalewania review jedną uwagą na wystąpienie.
2. **Rozjazd light/dark** → **znany, nierozstrzygnięty**, z trzema faktami (wartości `.dark` w `tokens.json`, runtime na `:root`, tło poza tokenami) i ostrzeżeniem, by nie traktować wartości w `tokens.json` jako opisu tego, co się renderuje.
3. **Zanieczyszczenia** → **opisane**, bez zmian w `src/` i `package.json`: zakres kontraktu = aplikacja webowa, `zod`/`workspace` jako przeciek z `packages/`, pokrycie rejestru ≈50%, `sidebar*`/`chart-*` jako nieużywany osad.

Przeniesiono też bez pytania konwencje nazewnicze i formatowania z `AGENTS.md` (skill każe je przenieść, nie odkrywać na nowo).

### 5.5 Status `.uxproof/` — czym ten kontrakt jest, a czym nie

`.uxproof/` jest **repo-grounded opisem stanu zastanego**: tego, co kod dziś deklaruje i robi.

**Nie jest** docelowym design systemem 10xCards, nie jest akceptacją obecnego wyglądu i nie przesądza przyszłego kierunku wizualnego. Częstotliwość wzorca w kodzie nie jest dowodem intencji zespołu — sekcja manualna mówi to wprost, żeby przyszłe review nie broniło startera.

**Otwarte i celowo nierozstrzygnięte na tym etapie:** strategia motywu (dark-first / light + toggler / inna) oraz kierunek wizualny i tożsamość produktu. Obie rzeczy należą do Phase 2 (`om-ux-shape` w trybie Review), nie do ekstrakcji kontraktu.
