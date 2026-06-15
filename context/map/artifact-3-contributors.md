# Artifact 3 — Mapa kontrybutorów (kto wie co i o co go zapytać)

> Trzeci artefakt serii. Opozycja do Artifact 1 (gdzie projekt **żył**) i Artifact 2
> (jak jest **zbudowany**): tu chodzi o to, **kto trzyma wiedzę** i gdzie jej
> koncentracja jest ryzykiem dla nowego maintainera. Źródło: `git log`, okno 12 mies.
> = cała historia repo (181 commitów, 2026-05-20 → 2026-06-15).

## 0. Zakres, metoda i filtr autorstwa

- **Jeden człowiek-autor.** `git shortlog -sne` zwraca **jednego** kontrybutora:
  **Rafal S** — autor **wszystkich 181 commitów**. Zero botów, zero innych ludzi.
- **AI jako narzędzie, nie kontrybutor.** 78 commitów (43%) ma trailer
  `Co-Authored-By: Claude …`. Zgodnie z briefem (odfiltruj agentów bez wyraźnego
  autorstwa człowieka) **nie liczę Claude'a jako osoby** — każdy taki commit ma
  jawnego ludzkiego autora (Rafal), więc filtr **nie usuwa nic z rankingu osób**.
  Sygnał AI traktuję inaczej: jako **wskaźnik, gdzie rozumowanie powstało w sesji
  z modelem**, a nie „w głowie" autora — to ma znaczenie dla trwałości wiedzy (§3).
- **Rozkład modeli-par (kontekst, nie autorstwo):** Opus 4.7 (1M) — 35,
  Opus 4.8 (1M) — 16, Opus 4.8 — 24, Opus 4.7 — 2. Różne obszary „pamięta" inna
  wersja modelu (§2) — kontekst sesji nie jest współdzielony między wersjami.
- **Konsekwencja:** klasyczna „mapa kontrybutorów" (kto z kim, kto ekspert) jest
  zdegenerowana — **bus factor = 1 wszędzie**. Wartościowa analiza to nie „kto",
  tylko **gdzie wiedza jest skoncentrowana, świeża/zwietrzała i jak ryzykowna**
  przy przejęciu. Tak też czytam brief.

## 1. TOP 5 obszarów wymagających kontaktu z „kontrybutorem"

Wybór = przecięcie **blast radius** (Artifact 2) × **gęstość/świeżość historii**
(Artifact 1 + git) × **udziału AI** (ile rozumowania zostało poza kodem).

| # | Obszar | Dlaczego trzeba pytać | Do kogo / co | Blast radius |
|--:|---|---|---|---|
| 1 | **Supabase / DB + RLS** | Hub kodu (fan-in 16), migracje + RLS robione wcześnie i **rzadko ruszane** (5 commitów, ostatni 2026-06-02). Korekta sesji/typów/RLS rozjeżdża middleware + **każdy** endpoint. | Rafal (pair: Opus 4.7) | **16** |
| 2 | **Account-retention / write-lock** | Inwariant przecinający **wszystkie zapisy** (fan-in 6), a historia to **2 commity w jeden dzień**. Maksimum zasięgu przy minimum śladu. | Rafal (pair: Opus 4.7) | **6** |
| 3 | **Observability / Sentry** | **Najmłodsza i najbardziej chaotyczna** warstwa (6 commitów, wszystkie 2026-06-06; „temp check", „deploy verification"). Wiedza plemienna: wymóg Cloudflare Build Variable, „swallow fix". | Rafal (pair: Opus 4.8) | 2 (kod) / wysoki operacyjnie |
| 4 | **Generowanie + AI (OpenRouter)** | Headline-feature, **9/9 commitów z AI**. Strukturalnie wąski (fan-in 2 — dobrze), ale ścieżki błędu LLM (timeout/odmowa) **nieprzetestowane** (Artifact 2 §5). | Rafal (pair: Opus 4.7→4.8) | 2 |
| 5 | **Reviews / SRS (Leitner)** | **Ukryte sprzężenie przez granicę** klient↔serwer: zmiana interwałów wymaga ręcznej synchronizacji `ReviewSession.tsx` ↔ `reviews.ts`. 8/8 commitów z AI. | Rafal (pair: Opus 4.7) | 3 |

## 2. Linia wsparcia — kto pracował przy obszarze (12 mies.)

Jedna osoba, więc „support line" = **Rafal**, a różnicuje go **wersja modelu-para**
(czyj kontekst sesji) i **świeżość** (jak bardzo model mentalny zwietrzał).
„AI" = liczba commitów ze śladem Claude / wszystkie commity obszaru.

| Obszar | Commity | AI-assist | Pierwszy | Ostatni | Świeżość | Para (model) | O co pytać Rafala |
|---|--:|--:|---|---|---|---|---|
| **Deploy / Infra** | 12 | 7/12 | 05-21 | **06-15** | świeża | mieszana | Cloudflare Workers, `wrangler`, **remote-only Supabase**, deploy dev→main, sekrety w CF/GH |
| **Library / Cards** | 10 | 9/10 | 06-01 | 06-06 | świeża | 4.7/4.8 | CRUD kart, atomic-save do decka, RLS per-user |
| **Generowanie + AI** | 9 | **9/9** | 05-28 | 06-06 | świeża | 4.7→4.8 | OpenRouter, gating generacji, obsługa błędów LLM |
| **Reviews / SRS** | 8 | **8/8** | 05-31 | 06-06 | świeża | 4.7 | algorytm Leitnera, sesja powtórek, **sync klient↔serwer interwałów** |
| **Auth** | 6 | 5/6 | **05-21** | 06-02 | **zwietrzała** | 4.7 | `middleware.ts` + `PROTECTED_ROUTES`, CSRF/Origin, blok domeny GoTrue |
| **Observability** | 6 | 4/6 | 06-06 | 06-06 | jednodniowa | **4.8** | seam „swallow fix", **Cloudflare Build Variable**, init Sentry client/server |
| **Supabase / DB** | 5 | 4/5 | 05-21 | 06-02 | **zwietrzała** | 4.7 | schema, migracje, **RLS**, scheduled hard-delete sweep |
| **Testing** | 4 | 3/4 | 06-03 | 06-06 | świeża | **4.8** | po co istnieją guardraile: service-role guard, two-user isolation, write-lock |
| **Account-retention** | 2 | **2/2** | 06-02 | 06-02 | jednodniowa | 4.7 | dlaczego **każdy** zapis musi respektować write-lock |

> Czytanie tabeli: obszary **świeże** (deploy, library, generowanie) → Rafal odtworzy
> kontekst z pamięci. Obszary **zwietrzałe** (auth, schema/RLS — dotykane ostatnio
> ~2 tyg. temu, a zaprojektowane na samym początku) → model mentalny już osłabł,
> a rozumowanie często powstało w sesji z Opus **4.7**, której kontekstu bieżąca
> para (4.8) **nie ma**. To realna luka, mimo „jednego kontrybutora".

## 3. Silosy wiedzy i bus factor

- **Bus factor = 1 w całym repo.** Każdy obszar ma dokładnie jednego człowieka.
  Nie ma drugiej osoby do code-review, nie ma świadka decyzji architektonicznych.
- **Wiedza dwumiejscowa: kod + sesja AI.** 43% commitów powstało w parze z modelem.
  Tam, gdzie udział AI = 100% (generowanie 9/9, reviews 8/8, retention 2/2),
  **rozumowanie „dlaczego tak" żyło w oknie czatu**, nie w głowie autora ani w docs.
  Po wygaśnięciu sesji ta warstwa „dlaczego" znika — zostaje sam wynik w kodzie.
- **Rozjazd wersji modelu = rozjazd kontekstu.** Fundament (auth, schema, SRS,
  generowanie) niesie **Opus 4.7**; najnowsza warstwa (observability, testing) —
  **Opus 4.8**. Pytając dziś model o decyzje z auth/RLS, pytasz inną wersję niż ta,
  która je podejmowała. Kontekst nie jest przenośny.
- **Najgłębsze silosy (jedno źródło, mało śladu, duży zasięg):**
  1. **Write-lock retencji** — globalny inwariant zapisu opisany w **2 commitach**.
     Nazwa folderu („usuwanie konta") **ukrywa**, że to cross-cutting concern.
  2. **Wymóg Cloudflare Build Variable dla Sentry** — żyje w treści commita i docs
     z 06-06, nie w żadnym oczywistym configu. Klasyczna wiedza plemienna deployu.
  3. **Synchronizacja interwałów Leitnera klient↔serwer** — nigdzie nie wymuszona
     mechanicznie; „wiesz albo psujesz" (Artifact 2 §4, §6).

## 4. Ryzyko dla nowego maintainera (ranking)

| Ryzyko | Obszar | Co boli przy przejęciu | Co je łagodzi |
|---|---|---|---|
| 🔴 **Wysokie** | **Supabase/DB + RLS** | Hub fan-in 16, RLS to subtelna poprawność bezpieczeństwa, migracje **pushowane na remote** (remote-only) — łatwo o nieodwracalny błąd. Model mentalny zwietrzały. | Guardrail `no-service-role-in-src`, testy izolacji two-user |
| 🔴 **Wysokie** | **Account-retention / write-lock** | Każda **nowa** ścieżka zapisu musi respektować write-lock, co jest nieoczywiste z nazw folderów; ślad historii = 2 commity. | ✅ `retention-write-lock.test.ts` (kontraktowy, fan-out 9) — **wymusza** inwariant |
| 🔴 **Wysokie** | **Observability / Sentry** | Najmłodsza, najmniej dojrzała warstwa; działanie zależy od **build-time configu Cloudflare**, trudne do odtworzenia lokalnie; historia z „temp checkami". | Decyzja udokumentowana w commit/docs z 06-06 |
| 🟡 **Średnie** | **Generowanie + AI** | Zależność od zewnętrznego LLM; **ścieżki błędu (timeout/odmowa) nieprzetestowane**. | ✅ świetna izolacja (fan-in 2), `openrouter.test.ts` mockuje klienta |
| 🟡 **Średnie** | **Reviews / SRS** | Ciche sprzężenie interwałów przez granicę klient/serwer — zmiana w jednym miejscu po cichu rozjeżdża drugie. | ✅ `leitner.ts` czysty i unit-testowalny |
| 🟡 **Średnie** | **Testing (meta-ryzyko)** | Guardraile kodują **najbardziej ryzykowne inwarianty** (RLS, izolacja, write-lock). Nowy maintainer, który nie rozumie **po co** istnieją, może je osłabić/usunąć i nie zauważyć regresji. | Testy są, ale brak „dlaczego" w samych testach |
| 🟡 **Średnie** | **Deploy / Infra** | Cloudflare Workers + remote-only Supabase + **CI nie bramkuje `main`** (gałąź ≠ `master`) → brak zielonej bramki, łatwo wpuścić błąd. | Najświeższy obszar (06-15), Rafal pamięta |
| 🟢 **Niskie** | **Auth** | Foundational, stabilny, ale model mentalny zwietrzały; wiedza plemienna (CSRF/Origin, blok domeny GoTrue). | Dojrzały, mało zmienny; `middleware.ts` mała powierzchnia |
| 🟢 **Niskie** | **Library / Cards** | Standardowy CRUD, dobrze ograniczony per-feature. | Najwięcej commitów, świeży, czytelne granice |

## 5. Gdzie wiedza już jest zapisana (i gdzie jej brakuje)

- **Zapisana mechanicznie (najlepszy rodzaj):** inwarianty RLS/izolacji/retencji
  są zakute w testach (`retention-write-lock`, two-user isolation, service-role
  static guard) oraz w regułach `.dependency-cruiser.cjs` (8 reguł boundaries).
  To **jedyna wiedza w repo niezależna od pamięci autora** — i celowo pilnuje
  najryzykowniejszych obszarów z §4.
- **Zapisana w prozie:** `AGENTS.md` / `CLAUDE.md` (tripwires: CI nie bramkuje
  `main`, husky re-staging, nienadpisywanie `context/`).
- **Luki (wiedza tylko „w głowie / w wygasłej sesji"):** *dlaczego* write-lock
  obejmuje wszystkie zapisy; *jak* odtworzyć Sentry lokalnie bez build-var
  Cloudflare; *które* interwały Leitnera są źródłem prawdy przy rozjeździe
  klient/serwer; *dlaczego* wybrano remote-only Supabase. To pierwsze kandydatury
  do spisania, gdyby projekt miał zyskać drugiego maintainera.

---

*Wygenerowano z historii gita (`git log`/`shortlog`/trailers, okno 12 mies. = cała
historia repo, 181 commitów, 1 człowiek-autor, 78 commitów w parze z Claude).
Komplementarne do Artifact 1 (historia) i Artifact 2 (struktura). Następny krok
serii: synteza do `repo-map.md` (jeszcze nie tworzony).*
