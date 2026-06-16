# Self-perception vs evidence — 10xCards

> Konfrontuje **to, co właściciel prawdopodobnie uważa za ważne/ryzykowne** w 10xCards
> z tym, co pokazują **dowody z repo**: historia gita, file churn, współzmiany, huby
> zależności, testy, koncentracja autorstwa. Synteza z [repo-map.md](repo-map.md) oraz
> trzech artefaktów ([1-territory](artifact-1-territory.md), [2-structure](artifact-2-structure.md),
> [3-contributors](artifact-3-contributors.md)).
>
> **Znaczniki dowodu:** **[historia]** git log / churn / współzmiany · **[graf]**
> dependency-cruiser (tylko TS/TSX) · **[testy]** guardraile i testy integ. ·
> **[autor]** koncentracja kontrybutorów · **[unknown]** poza zasięgiem narzędzi.
>
> **Zakres:** cała historia repo = ~26 dni (178–181 commitów, 2026-05-20 → 06-15).
> To koncentracja wczesnego developmentu, nie wzorzec długiego utrzymania.

## Założona self-perception (wejściowa)

1. Główna wartość produktu to **generowanie fiszek (AI)**.
2. Ryzykowne części to **AI/OpenRouter i integracja Supabase**.
3. Testy dodano głównie, by **spełnić wymóg kursu/testowania**.
4. Projekt jest **dość mały, by zrozumieć go ręcznie**.

---

## 1. Zaskoczenia (gdzie dowód najmocniej rozjeżdża się z intuicją)

| # | Zaskoczenie | Dowód |
|--:|---|---|
| 1 | **Centrum grawitacji to infrastruktura, nie AI.** Hub kodu to `src/lib/supabase.ts` (fan-in 16: middleware + **każdy** endpoint). „AI" (`openrouter.ts`) jest wąską szprychą (fan-in 2, jeden konsument). | **[graf]** A2 §1 |
| 2 | **`account-retention.ts` to ukryty globalny inwariant zapisu** (fan-in 6, wpięty w *każdy* mutujący endpoint), a w mapie domeny to drobne „usuwanie konta". Nazwa folderu ukrywa cross-cutting concern. Ślad historii: **2 commity w jeden dzień**. | **[graf]** A2 §6 · **[historia]** A3 §1 |
| 3 | **Testy nie są kosmetyką — kodują najryzykowniejsze inwarianty.** `retention-write-lock.test.ts` (kontraktowy, fan-out 9), two-user isolation, `no-service-role-in-src`. To **jedyna wiedza w repo niezależna od pamięci autora**. | **[testy]** A2 §5 · A3 §5 |
| 4 | **`leitner.ts` ma ciche sprzężenie przez granicę klient↔serwer.** Niski fan-in (3), ale zmiana interwałów wymaga **ręcznej** synchronizacji `ReviewSession.tsx` ↔ `reviews.ts` — nigdzie nie wymuszonej mechanicznie. | **[graf]** A2 §4/§6 |
| 5 | **Najgorętszy realny obszar to `src/pages/api` (25 zmian), nie warstwa AI.** Backend sterowany feature'ami; epicentrum logiki biznesowej rozłożone na wiele endpointów + rdzeń lib. | **[historia]** A1 §1 |
| 6 | **Dwie trzecie churnu to szum AI-workflow** (`context/`, `.claude/`). Bez filtrowania `src/` znika w statystykach — intuicja „gdzie była praca" jest zafałszowana. | **[historia]** A1 §1 |

## 2. Potwierdzone założenia

| Założenie | Werdykt | Dowód |
|---|---|---|
| **Supabase to ryzykowna część** | ✅ **Potwierdzone — i to najmocniej** | Hub fan-in 16; RLS = subtelna poprawność bezpieczeństwa; migracje **remote-only** (nieodwracalne błędy); kontekst zwietrzały (projektowane wcześnie). **[graf + historia]** A2 §1, A3 §4 |
| **AI/OpenRouter wymaga uwagi** | ⚠️ **Częściowo** — ale inaczej niż się wydaje | Jako *kod* jest bezpieczny (świetna izolacja, fan-in 2). Realne ryzyko to **nieprzetestowane ścieżki błędu LLM** (timeout/odmowa) — *do weryfikacji* inspekcją testów, nie założenie. **[graf]** A2 §5 |
| **Generowanie to istotny feature** | ✅ jako wartość produktu — tak | Headline-feature, świeży, 9/9 commitów z AI. Ale „istotny dla użytkownika" ≠ „centralny strukturalnie" (patrz Fałszywe §1). **[historia]** A3 §2 |

## 3. Fałszywe założenia

| # | Założenie | Dlaczego fałszywe | Dowód |
|--:|---|---|---|
| 1 | **„Główna wartość = AI generowanie" ⇒ AI jest sednem systemu** | Myli *wartość produktową* ze *strukturalną centralnością*. Realne centrum to infrastruktura dostępu do danych; „AI" jest peryferyjny i dobrze odizolowany. Ryzyko leży gdzie indziej (Supabase, retention). | **[graf]** A2 §6/§7 |
| 2 | **„Ryzyko = AI/OpenRouter + Supabase" (tylko te dwa)** | Pomija **dwa niedoceniane ryzyka**: cross-cutting write-lock retencji oraz ciche sprzężenie interwałów Leitnera przez granicę. OpenRouter jest zaś *najbezpieczniejszy* do zmiany. | **[graf]** A2 §4, repo-map §4 |
| 3 | **„Testy = wymóg kursu"** | Testy celowo pilnują najryzykowniejszych inwariantów (RLS, izolacja użytkowników, write-lock). To nie compliance — to **jedyny mechaniczny zapis wiedzy** w repo. Meta-ryzyko: kto nie rozumie *po co* istnieją, może je osłabić i nie zauważyć regresji. | **[testy]** A2 §5, A3 §5 |
| 4 | **„Projekt mały, zrozumiały ręcznie"** | Prawda *dziś* (jeden autor, 26 dni), ale wiedza jest podzielona między **kod i wygasłe sesje AI** (różne wersje modelu: fundament 4.7, hardening 4.8). **Bus factor = 1 wszędzie**; „dlaczego" wielu decyzji nie jest w repo. Już nieodtwarzalny w pełni z samego kodu. | **[autor]** A3 §2/§3 |
| 5 | **„Backend zorganizowany per feature" (jak komponenty)** | Frontend tnie pionowo (per funkcja), ale **API jest płaskie** pod `pages/api/`, a sprzężenie idzie przez warstwę lib. „Cała funkcja review" w UI to folder; na serwerze rozsmarowana: `reviews.ts` + supabase + retention + leitner. | **[graf]** A2 §6 |

## 4. Obszary do rewizji przed kontynuacją M4/M5

Uporządkowane wg ryzyka × dźwigni. Każdy = konkretne pytanie do zamknięcia, nie ogólnik.

1. 🔴 **Pokrycie ścieżek błędu OpenRouter w `generations.ts`.** Sprawdź faktycznie
   (timeout / odmowa modelu / rate-limit) — repo-map oznacza je jako *„wyglądają na
   słabo pokryte, do weryfikacji"*, nie potwierdzone. To pierwszy kandydat do testu E2E
   w M4/M5, bo to jedyny styk z zewnętrznym LLM-em. **[graf]** A2 §5
2. 🔴 **Synchronizacja interwałów Leitnera klient↔serwer.** Ustal *które* interwały są
   źródłem prawdy i czy `reviews.integration.test.ts` testuje **te same** wartości, których
   używa `ReviewSession.tsx`. Sprzężenie nie jest wymuszone mechanicznie — kandydat na test
   kontraktowy. **[graf]** A2 §4/§5
3. 🔴 **Inwariant write-lock retencji jako wymóg każdej nowej ścieżki zapisu.** Zanim
   dodasz endpoint mutujący w M4/M5, potwierdź, że respektuje `account-retention` —
   `retention-write-lock.test.ts` to wymusi, ale tylko jeśli nowy endpoint zostanie objęty.
   Spisz *dlaczego* (silos: 2 commity). **[graf + testy]** A2 §6, A3 §3
4. 🟡 **Supabase/RLS — kontekst zwietrzały, migracje remote-only.** Przed zmianami schematu
   odśwież model mentalny RLS i potwierdź ścieżkę rollbacku (brak lokalnej bazy). Guardrail
   `no-service-role-in-src` i two-user isolation pomagają, ale nie zastąpią zrozumienia RLS.
   **[graf + historia]** A3 §4
5. 🟡 **Observability/Sentry — odtwarzalność lokalna.** Jeśli M4/M5 ma polegać na telemetrii,
   udokumentuj wymóg **Cloudflare Build Variable** i sposób lokalnego repro; dziś to wiedza
   plemienna z jednego dnia. Ryzyko operacyjne (utrata telemetrii), nie produktowe. **[historia]** A3 §4
6. 🟡 **Brama CI nie chroni `main`.** Workflow odpala na `master`, gałąź robocza to `main` —
   **brak zielonej bramki**. Przed serią zmian M4/M5 albo napraw trigger, albo świadomie
   traktuj lint/build/testy jako lokalną dyscyplinę. **[historia + config repo]** repo-map §4
7. 🟡 **Spisanie „dlaczego" przy bus factor = 1.** Cztery luki wiedzy (write-lock, Sentry
   build-var, źródło prawdy Leitnera, wybór remote-only Supabase) żyją tylko w głowie /
   wygasłych sesjach. To pierwsze kandydatury do utrwalenia, nim M4/M5 doda warstwę zależną
   od tych decyzji. **[autor]** A3 §5

---

*Synteza z [repo-map.md](repo-map.md) i artefaktów A1–A3 (historia gita, dependency-cruiser,
autorstwo). Okno = cała historia repo (~26 dni). Artefakty źródłowe niezmienione.
Skróty: A1 = artifact-1-territory, A2 = artifact-2-structure, A3 = artifact-3-contributors.*
