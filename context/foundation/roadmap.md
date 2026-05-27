---
project: 10xCards
version: 1
status: draft
created: 2026-05-26
updated: 2026-05-26
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: 10xCards

> Powstała z `context/foundation/prd.md` (v1) oraz automatycznie zinwentaryzowanego baseline kodu (2026-05-26).
> Edytuj in-place; archiwizuj gdy zdezaktualizowana.
> Slice'y poniżej są ułożone w kolejności zależności. Tabela "At a glance" jest indeksem.

## Vision recap

Samouk-technik czyta gęsty materiał (AI, software engineering) i chce zachować wiedzę w spaced repetition, ale ręczne pisanie kart Q/A w trakcie czytania przerywa flow wystarczająco mocno, żeby to pomijał. AI może zdjąć tę friction — pod warunkiem, że człowiek pozostaje autorytetem decydującym, co trafia do talii.

Wedge produktu — jedna cecha, której odjęcie sprawia, że produkt staje się nieodróżnialny od generycznego "AI wrzuca karty do decka" — to ręczne akceptuj-lub-odrzuć każdego kandydata wygenerowanego przez AI, zanim wyląduje w bibliotece użytkownika. v1 jest wielo-użytkownikową aplikacją web z twardą izolacją danych per user, mimo że dzień pierwszy obsługuje wyłącznie autora w trybie dogfood — tak żeby wielo-użytkownikowość była wbudowana, a nie doszywana.

## North star

**S-02: użytkownik kończy pierwszą sesję powtórek SRS na kartach zaakceptowanych z AI** — domknięcie pełnej pętli end-to-end (zaloguj → wklej → wygeneruj → zaakceptuj → zapisz → powtórzenie → ocena) to validation milestone (kamień walidacji) dowodzący PRD Primary Success Criterion: karty z AI są na tyle użyteczne, że użytkownik wybiera workflow AI zamiast manualnego.

> "North star" oznacza tu najmniejszy slice end-to-end, którego dostarczenie udowadnia główną tezę produktu — umieszczony tak wcześnie, jak pozwalają Prerequisites, bo cała reszta ma sens dopiero, gdy on działa. Auth i deploy są już wdrożone (patrz `## Baseline`), więc pełna ścieżka staje się przechodnia w momencie wyjścia S-02 na produkcję.

## At a glance

| ID    | Change ID                                  | Outcome (użytkownik może …)                                                                                                                                              | Prerequisites    | PRD refs                                            | Status   |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- | -------- |
| F-01  | cards-schema-and-rls                       | (foundation) tabela kart z Row-Level Security izolującą dane każdego użytkownika od pozostałych na poziomie bazy danych                                                  | —                | Access Control, NFR (izolacja cross-user), Guardrails | ready    |
| S-01  | ai-candidate-generation-with-accept-reject | wkleić fragment tekstu, zobaczyć karty-kandydatów z AI, zaakceptować lub odrzucić każdego niezależnie — zaakceptowane lądują w bibliotece, odrzucone znikają bez zapisu | F-01             | US-01, FR-004, FR-005, FR-006, FR-007, FR-008       | proposed |
| S-02  | srs-review-session                         | rozpocząć sesję powtórek i oceniać karty due jako dobrze/źle; daty kolejnej powtórki aktualizują się i są trwałe między sesjami (north star)                            | F-01, S-01       | US-02, FR-013, FR-014, FR-015                       | proposed |
| S-03  | manual-card-creation                       | otworzyć formularz "Utwórz kartę", wpisać front i back, zapisać kartę do biblioteki                                                                                       | F-01             | US-03, FR-009                                       | proposed |
| S-04  | card-library-browse-edit-delete            | przeglądać bibliotekę, edytować front/back zapisanej karty, na twardo skasować kartę                                                                                      | F-01, S-01       | FR-010, FR-011, FR-012                              | proposed |

## Streams

Pomoc nawigacyjna — grupuje elementy dzielące łańcuch Prerequisites. Kanoniczna kolejność wciąż żyje w grafie zależności poniżej; ta tabela to proponowana kolejność czytania równoległych torów. Przy `top_blocker: time` praca równoległa ma znaczenie: Stream A i Stream B mogą posuwać się różnymi wieczorami.

| Stream | Theme                              | Chain                          | Note                                                                                                                                      |
| ------ | ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Pętla podstawowa (ścieżka północna) | `F-01` → `S-01` → `S-02`       | Sztywna ścieżka po PRD must-have FR pod `main_goal: speed`; idź w tej kolejności, żeby najszybciej dotrzeć do north star.                  |
| B      | Kompletność biblioteki              | `S-03` → `S-04`                | Równolegle z Stream A po wylądowaniu `F-01`; zamyka FR-009 / FR-010 / FR-011 / FR-012. `S-04` zależy też od `S-01` (dołącza do Stream A). |

## Baseline

Co jest już w kodzie na 2026-05-26 (zinwentaryzowane automatycznie + potwierdzone przez użytkownika).
Foundations poniżej zakładają obecność poniższych warstw i NIE budują ich na nowo.

- **Frontend:** obecny — Astro 6 + React 19 + Tailwind 4; routing plikowy w `src/pages/`; komponenty auth w `src/components/auth/`; prymitywy UI w `src/components/ui/`.
- **Backend / API:** częściowy — istnieją tylko `src/pages/api/auth/{signin,signup,signout}.ts`. Endpointy dla kart / generacji / powtórek nieobecne.
- **Dane:** częściowe — klient Supabase podłączony (`@supabase/ssr`, `@supabase/supabase-js`); zmienne env (`SUPABASE_URL` / `SUPABASE_KEY`) typowane (per `astro.config.mjs`). Brak schematu, brak migracji, brak tabel kart. `supabase/config.toml` ma migracje wyłączone.
- **Auth:** obecny — rejestracja, logowanie, wylogowanie i potwierdzenie e-mail działają na produkcji (`https://10x-cards.rafsaw.workers.dev`); `src/middleware.ts` wymusza ochronę `/dashboard` przez sesję Supabase. **Pokrywa FR-001 (rejestracja), FR-002 (logowanie), FR-003 (wylogowanie)** — żaden slice ich nie odbudowuje.
- **Deploy / infra:** obecny — Cloudflare Workers przez `@astrojs/cloudflare` v13.5; `wrangler.jsonc` z `nodejs_compat` + `compatibility_date: 2026-05-08`; auto-deploy z gałęzi `main` przez Cloudflare Workers Builds; `wrangler rollback` przećwiczony (patrz `context/deployment/deploy-plan.md` §Phase 6).
- **Observability:** częściowa — blok observability w `wrangler.jsonc` włączony (linie 12–14); free-plan Workers Logs trzyma logi ~3 dni. Brak Sentry / OTel / zewnętrznego error trackingu.

## Foundations

### F-01: Schemat kart + RLS

- **Outcome:** (foundation) istnieje tabela `cards` z właścicielem per-user (`user_id` jako klucz obcy do `auth.users`), polami front/back i polami harmonogramu wymaganymi przez prosty model SR; polityki Row-Level Security sprawiają, że każdy odczyt i zapis wiersza, którego `user_id` różni się od zalogowanego użytkownika, kończy się błędem. Izolacja cross-user jest wymuszana w bazie danych, nie tylko w warstwie aplikacji.
- **Change ID:** `cards-schema-and-rls`
- **PRD refs:** Access Control (izolacja per-user, brak admina, brak sharingu), NFR ("no path through the product surfaces another user's data, ever"), Guardrails ("cross-user data leakage is ship-blocking even if everything else works")
- **Unlocks:** S-01 (zapisuje zaakceptowane karty), S-02 (czyta karty due + aktualizuje daty kolejnej powtórki), S-03 (zapisuje karty wpisane ręcznie), S-04 (lista / edycja / kasowanie kart). Również redukuje ship-blocking Unknown dotyczący izolacji cross-user — gdy RLS trzyma na poziomie DB, każdy kolejny slice dziedziczy gwarancję bez ponownego dowodu.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Źle skonfigurowana polityka RLS przy choćby jednej tabeli/operacji w cichy sposób przecieka dane między userami — a PRD §Guardrails nazywa to wprost ship-blocking. Sekwencjonowane jako pierwsze, bo każdy inny slice zapisuje lub czyta karty; zrobienie RLS dobrze raz na poziomie DB jest tańsze niż weryfikacja izolacji per slice.
- **Status:** ready

## Slices

### S-01: Generacja kandydatów z AI z akceptacją / odrzuceniem

- **Outcome:** zalogowany użytkownik wkleja fragment tekstu źródłowego, aplikacja zwraca zestaw kart-kandydatów (front / back), użytkownik akceptuje lub odrzuca każdego niezależnie. Zaakceptowani kandydaci zapisują się do biblioteki i znikają z listy kandydatów; odrzuceni są odrzucani bez zapisu.
- **Change ID:** `ai-candidate-generation-with-accept-reject`
- **PRD refs:** US-01, FR-004, FR-005, FR-006, FR-007, FR-008
- **Prerequisites:** F-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Klucz OpenRouter (lub równoważny LLM gateway) jeszcze nie wpięty — `context/deployment/deploy-plan.md` §Out of scope wprost odracza `OPENROUTER_API_KEY` do momentu pojawienia się kodu AI. Trzeba `npx wrangler secret put OPENROUTER_API_KEY` + lokalny wpis w `.dev.vars` zanim ten slice ruszy end-to-end. — Owner: user. Block: no (drobny setup, nie blokuje planowania).
  - Wybór modelu LLM + sufit kosztowy per request. — Owner: TBD. Block: no (rozstrzygnięte w `/10x-plan`).
- **Risk:** Opóźnienia OpenRouter, rate-limity lub dryf outputu sprawiają, że generacja wygląda na zepsutą; FR-008 + Guardrails wymagają, by wklejony przez użytkownika tekst źródłowy przeżył dowolną awarię bez konieczności ponownego wklejenia. Kontrakt "retry bez re-paste" łatwo nieświadomie złamać, jeśli stan żyje w URL-u albo w formularzu, z którego nawigujemy gdzie indziej — najprostszy poprawny kształt to trzymać tekst źródłowy w stanie komponentu aż *wszyscy* kandydaci zostaną rozstrzygnięci, a nie tylko do powrotu odpowiedzi.
- **Status:** proposed

### S-02: Sesja powtórek SRS (north star)

- **Outcome:** zalogowany użytkownik rozpoczyna sesję powtórek, widzi karty due jeden po drugim, odsłania back, ocenia recall jako "dobrze" lub "źle" (binarnie, per FR-014), a data kolejnej powtórki karty się aktualizuje i jest trwała między sesjami. Sesja trwa aż wszystkie due karty zostaną zrecenzowane lub użytkownik wyjdzie.
- **Change ID:** `srs-review-session`
- **PRD refs:** US-02, FR-013, FR-014, FR-015
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Dokładna formuła harmonogramowania dla prostego modelu. PRD §Non-Goals wprost zabrania zaawansowanej optymalizacji; *co* to "prosty model", a *który* prosty model (boxy Leitnera, stałe mnożniki itd.) nie jest dookreślone. — Owner: TBD. Block: no (rozstrzygnięte w `/10x-plan`).
- **Risk:** Wyrafinowane algorytmy SR są explicit non-goal — ryzyko leży po stronie over-engineeringu, nie under-engineeringu. PRD Guardrails definiują kontrakt fallbacku: gdy podstawowa logika wyboru due-card zawiedzie z dowolnego powodu, sesja spada na "najstarsza due-card pierwsza". Domyka pętlę walidacyjną, do której zmierza cała roadmapa; brak tego slice'a = PRD Primary Success Criterion jest nieweryfikowalny.
- **Status:** proposed

### S-03: Ręczne tworzenie karty

- **Outcome:** zalogowany użytkownik otwiera formularz "Utwórz kartę", wpisuje niepusty front i niepusty back, zatwierdza, a karta zapisuje się do biblioteki. Ręcznie utworzona karta wchodzi w cykl SRS tak samo, jak karta zaakceptowana z AI.
- **Change ID:** `manual-card-creation`
- **PRD refs:** US-03, FR-009
- **Prerequisites:** F-01
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najmniejszy slice w roadmapie; nośne ryzyko to ścieżka manual-create omijająca gwarancje RLS z F-01 — np. zapis przez klucz service-role albo przez ścieżkę serwerową gubiącą kontekst zalogowanego użytkownika. Trzymać się user-scoped klienta Supabase, żeby RLS pozostał ostateczną instancją.
- **Status:** proposed

### S-04: Biblioteka kart — przeglądanie, edycja, kasowanie

- **Outcome:** zalogowany użytkownik widzi listę swoich zapisanych kart, edytuje front i back karty i na twardo kasuje kartę. Po kasacji karta znika — brak soft-delete, brak undo (per FR-012).
- **Change ID:** `card-library-browse-edit-delete`
- **PRD refs:** FR-010, FR-011, FR-012
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kasowanie jest hard-delete per FR-012, więc przypadkowe skasowanie niszczy postęp nauki, którego nie da się odzyskać — UI musi wystawiać jednoznaczny krok potwierdzenia (PRD FR-012 Socratic dopuszcza to w implementacji bez rozszerzania zakresu). Również: edycja i kasowanie muszą iść przez user-scoped klienta Supabase, żeby RLS z F-01 trzymał.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                                  | Suggested issue title                                                   | Ready for `/10x-plan` | Notes                                       |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| F-01       | cards-schema-and-rls                       | Schemat kart + polityki RLS dla izolacji per-user                       | yes                   | Uruchom `/10x-plan cards-schema-and-rls`    |
| S-01       | ai-candidate-generation-with-accept-reject | Generacja kandydatów AI z akceptem / odrzutem per karta                | no                    | Zablokowane na F-01                         |
| S-02       | srs-review-session                         | Sesja powtórek SRS (north star — domyka pętlę podstawową)               | no                    | Zablokowane na F-01, S-01                   |
| S-03       | manual-card-creation                       | Formularz ręcznego tworzenia karty                                      | no                    | Zablokowane na F-01                         |
| S-04       | card-library-browse-edit-delete            | Biblioteka kart: przeglądanie, edycja, hard-delete                      | no                    | Zablokowane na F-01, S-01                   |

## Open Roadmap Questions

1. **Czy podczas MVP będą się rejestrować realni (nie-autor) użytkownicy, czy v1 to ściśle dogfood autora?** Per `context/deployment/deploy-plan.md` lessons, Supabase free-tier shared SMTP ma cap ~3–4 mailów potwierdzających na godzinę — w porządku do dogfood, łamie się przy jakimkolwiek realnym ruchu rejestracyjnym. Jeśli realni użytkownicy mają się rejestrować przed zamknięciem v1, własne SMTP (Resend / SendGrid / SES) staje się twardym prerequisitem launchu. — Owner: user. Block: roadmap-wide (dotyka gotowości do launchu, nie planów per slice).

## Parked

- **Zaawansowana inżynieria algorytmu spaced repetition** — PRD §Non-Goals: v1 używa celowo prostego modelu harmonogramowania; sofistykacja to dźwignia na v2.
- **Wielo-formatowy import (PDF, DOCX, EPUB, web URL-e)** — PRD §Non-Goals: w v1 wyłącznie wklejanie czystego tekstu.
- **Współdzielenie kart lub talii między użytkownikami** — PRD §Non-Goals: single-tenant per user; wprost zamyka funkcje społecznościowe / zespołowe.
- **Natywne aplikacje mobilne (iOS, Android)** — PRD §Non-Goals: tylko web. Użyteczność na mobilnej przeglądarce w zakresie jako baseline (per NFR), ale bez natywnych shelli.
- **Reset hasła i flow weryfikacji e-mail** — PRD §Non-Goals: w v1 auth ograniczone do signup / login / logout / session handling. Tylko ręczne recovery.
- **Integracje z innymi platformami (Anki export, Quizlet sync, LMS)** — PRD §Non-Goals: produkt samowystarczalny.
- **Edycja kandydatów z AI przed zapisem** — PRD §Non-Goals: kandydaci są tylko accept-or-reject; refinement dzieje się po zapisie przez surface edycji z FR-011.
- **Custom SMTP w Supabase** — Wymagane dla jakichkolwiek niezerowych rejestracji nie-autora (per lekcja SMTP rate-limit w deploy-plan). Odroczone pod `main_goal: speed`; pojawia się w Open Roadmap Question #1.
- **Sentry / zewnętrzny error tracking** — Wbudowana observability Cloudflare Workers + `wrangler tail` wystarcza do solo dogfoodu; odroczyć aż pojawią się realni użytkownicy uzasadniający dodatkowy surface.
- **Gate CI w GitHub Actions** — `.github/workflows/ci.yml` triggeruje wyłącznie na `master` (gałąź robocza to `main`), więc CI obecnie nie chodzi. Per AGENTS.md Agent Tripwires jest to znane i akceptowane; lint + build odpalamy lokalnie przez `npm run lint` / `npm run build`. Wrócić, jeśli zechcemy pre-deploy gate.

## Done

(Pusta przy pierwszej generacji. `/10x-archive` dopisuje wpisy tutaj — i przełącza `Status` pasującego elementu na `done` — gdy change o `Change ID` zgodnym z elementem roadmapy zostaje zarchiwizowany. NIE wypełniać z góry.)
