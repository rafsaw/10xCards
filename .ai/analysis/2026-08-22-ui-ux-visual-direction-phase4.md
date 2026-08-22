# Raport: kierunek wizualny — Phase 4 (decyzja przed strategią C)

- **Data:** 2026-08-22
- **Repo:** 10xCards
- **Branch bazowy:** `main` po merge PR #31 (`f7fa07f`)
- **Typ:** decyzja projektowa — `src/` nietknięte, bez PR-a i bez speca. Po akceptacji kierunku sekcja manualna `.uxproof/conventions.md` została zaktualizowana o §5 (patrz „Decyzja" na końcu).
- **Wejścia:** `.ai/analysis/2026-08-21-ui-ux-discovery-phase1.md`, `.ai/analysis/2026-08-21-ui-ux-review-phase2.md`, `.ai/analysis/2026-08-21-ui-ux-redesign-strategy-phase3.md`, `.ai/specs/briefs/2026-08-21-dashboard-what-now.md`, `.uxproof/`, kod z `main`
- **Zakres świadomie pominięty:** ponowny UX review, zmiany przepływów, decyzje o zachowaniu produktu (ustalone w Phase 2/3), implementacja

---

## 0. Po co ta faza i co jest przesądzone

Phase 3 przyjęła strategię B jako pierwszy przyrost i zapisała jedno zdanie, które trzeba teraz wykonać: **„Kiedy C: wtedy, gdy zapadnie decyzja o kierunku wizualnym — nie wcześniej."** C jest jedyną strategią o **całkowitej** zależności wizualnej. Bez tej decyzji unifikacja tokenów oznacza podjęcie jej przypadkiem, w trakcie implementacji, przez agenta piszącego trzeci z kolei komponent.

Behavior jest ustalony. Tu decydujemy **wyłącznie o systemie wizualnym**: motyw, charakter, typografia, powierzchnie, gęstość, hierarchia akcji, powłoka, kolor semantyczny, formularze, stany brzegowe, dostępność.

### Stan faktyczny na dziś (zmierzony na `main`, `f7fa07f`)

| Fakt                                                         | Wartość                                          | Znaczenie dla decyzji                                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zahardkodowane klasy palety w `src/**/*.{astro,tsx}`         | **331**                                          | Rosną, nie maleją. Phase 1 mierzyła 247; PR #31 dołożył kolejne, świadomie („żeby sweep restylował dashboard razem z resztą").                                   |
| Klasy tokenowe (`bg-background`, `text-muted-foreground`, …) | **26**                                           | Stosunek ~13:1 na korzyść legacy.                                                                                                                                |
| Breakpointy w całym `src/`                                   | **12**                                           | Bez zmian od Phase 1. Pięć ekranów aplikacji ma ich zero.                                                                                                        |
| Deklaracja fontu w repo                                      | **zero**                                         | Brak `@font-face`, brak `font-family`, brak `font-sans/serif` poza dwoma `font-mono`. Typografia to **czysta karta** — jedyny wymiar o zerowym koszcie migracji. |
| Prymitywy UI                                                 | `ui/button.tsx` + nieużywany `ui/LibBadge.astro` | Brak `Card`, `PageHeader`, `Section`, `Alert`, `EmptyState`, `Input`, `Dialog`.                                                                                  |
| Pokrycie E2E                                                 | 3 specyfikacje (`review-*`, `seed`)              | Zero regresji wizualnej. Każda zmiana palety jest niezweryfikowana automatycznie.                                                                                |
| Tokeny bez zastosowania                                      | `chart-1..5` (5), `sidebar*` (8)                 | 13 z 31 tokenów kolorystycznych opisuje funkcje, których produkt nie ma.                                                                                         |
| Baner globalny                                               | jedyne scoped `<style>`, hexy w jasnej palecie   | Widoczny szew (finding 8).                                                                                                                                       |

### Trzy rzeczy, których ta decyzja nie może zrobić

1. **Nie może traktować obecnego wyglądu jako tożsamości.** Aplikacja wygląda na ciemną, bo `body` ma `bg-cosmic` ze startera, a tokeny rozwiązują się do **jasnej** palety, której nikt nie ogląda. „Ciemna" nie jest wyborem 10xCards — jest niedopatrzeniem odziedziczonym z `przeprogramowani/10x-astro-starter`. Argument „przecież apka jest ciemna" jest w tej dyskusji nieważny.
2. **Nie może wybierać po koszcie migracji.** Przy 331 wystąpieniach do przepisania różnica między kierunkami wynosi kilkanaście procent pracy, a decyzja wiąże produkt na lata.
3. **Nie może dopisywać produktowi charakteru, którego nie ma.** Bez grywalizacji, bez „vanity metrics", bez wykresów — zapisane w briefie dashboardu jako non-goal i utrzymane tutaj.

### Czym ten produkt jest — jedno zdanie, z którego wynika reszta

**10xCards to narzędzie do krótkich, powtarzanych codziennie sesji czytania własnych notatek, w którym maszyna proponuje treść, a człowiek ją zatwierdza.** Z tego zdania wynikają cztery wymagania wizualne, których żaden kierunek nie może naruszyć:

- **Treść karty jest bohaterem ekranu.** To proza, nie dane. Komfort czytania bije wszystko inne.
- **System musi mieć widoczny język zaufania.** Draft AI i zapisana karta nie mogą wyglądać tak samo — bramka jakości (finding 1) jest sednem produktu i musi być widoczna, nie tylko logiczna.
- **Powtarzalność > pierwsze wrażenie.** Ekran oglądany 300 razy w roku ma być cichy, nie efektowny.
- **Sesja to tryb skupienia.** `/review` jest najlepszym ekranem produktu (Phase 2) — system wizualny ma mu nie przeszkadzać.

---

## 1. Trzy kierunki

Kierunki różnią się **osią nośną** — tym, co niesie hierarchię, kiedy odbierze się im kolor:

|                     | **A — Papier**                              | **B — Instrument**                      | **C — Konstrukcja**                                  |
| ------------------- | ------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Nośnik hierarchii   | typografia i światło                        | kontrast walorowy i jeden akcent        | siatka, ramki, kodowanie stanu                       |
| Motyw               | light-first                                 | dark-first                              | dual-theme od pierwszego dnia                        |
| Powłoka             | minimalna, znika                            | tryb skupienia — chowa się w sesji      | trwała: sidebar + bottom tabs                        |
| Gęstość             | przewiewna                                  | skupiona                                | jednolicie zwarta                                    |
| Kolor               | prawie monochrom + jeden akcent atramentowy | monochrom + jeden żywy akcent           | pełny zestaw semantyczny jako kodowanie funkcjonalne |
| Charakter           | zeszyt do nauki, dobrze złożona książka     | precyzyjne narzędzie do jednego zadania | warsztat / system operacyjny produktu                |
| Referencja mentalna | Readwise Reader, iA Writer, Kindle          | Things 3 w dark, DAW, terminal          | Linear, GitHub, Height                               |

---

### Kierunek A — „Papier" (redakcyjny spokój, light-first)

**Teza.** Produkt jest o czytaniu własnych notatek. Interfejs ma zniknąć i zostawić tekst.

**1. Theme strategy.** **Light-first.** Jedna paleta jest kanoniczna i to jasna: ciepły, lekko odbarwiony papier (`oklch(0.985 0.004 85)`) zamiast czystej bieli, atrament w okolicy `oklch(0.22 0.01 60)` zamiast czerni. Dark istnieje jako **zarezerwowana architektura** (patrz §4), nie jako równoległy produkt.

**2. Osobowość.** Cichy, dorosły, redakcyjny. Bliżej dobrze złożonej książki niż aplikacji SaaS. Zero efektów: brak cieni, gradientów, przezroczystości, animacji dekoracyjnych. Ruch tylko funkcjonalny (odsłonięcie tyłu karty, wejście dialogu).

**3. Typografia.** **Dwie rodziny, wyraźny podział ról** — to jest oś nośna tego kierunku:

- **Treść karty i proza** — serif humanistyczny (stack systemowy `Iowan Old Style, Charter, Georgia, serif` na start, opcjonalnie jeden zmienny serif self-hosted później). Front karty **19–20 px**, interlinia 1.55, miara ograniczona do **~62–66 ch**.
- **Chrome, etykiety, przyciski, liczby** — sans systemowy (obecny stack Tailwind), cyfry tabularne w licznikach.
- **Skala: cztery rozmiary i koniec** — `32 / 20 / 16 / 13`. Hierarchia idzie rozmiarem i światłem, nie wagą i nie kolorem. `FRONT` / `BACK` to sans 12 px, uppercase, tracking `0.08em`, kolor `muted-foreground`.

**4. Powierzchnie i elewacja.** Jedna powierzchnia — papier. Karta to **nie** pudełko: to blok tekstu oddzielony światłem i **jednym włoskiem** (`1px`, ~8 % kontrastu) tam, gdzie granica jest naprawdę potrzebna. Promień `6 px` — obecny `0.625rem` schodzi do `0.375rem`. **Cień zarezerwowany wyłącznie dla warstw naprawdę unoszących się**: dialog, popover, toast. Karta w bibliotece, sekcja dashboardu, formularz — bez cienia, na zawsze.

**5. Spacing i gęstość.** Skala 4 px, ale wartości używane **przewiewne**: rytm pionowy 24/32/48, wewnątrz karty 20/24. Kolumna treści `max-w-[68ch]`, nie `max-w-3xl`. Świadomie **niska gęstość informacyjna** — na ekranie ma być mało rzeczy i mają być duże.

**6. Hierarchia akcji.** Trzy poziomy, jednoznaczne:

- **Primary** — jeden na ekran. Wypełniony atramentem (`bg-primary` = ciemny atrament, `text-primary-foreground` = papier). Ciemny przycisk na jasnym tle jest tu naturalny — to ta sama decyzja, którą shadcn ma w `:root` i której dziś nikt nie widzi.
- **Secondary** — obrys, tło papieru, tekst atramentowy.
- **Tertiary** — link tekstowy z **podkreśleniem** (`underline-offset-4`), nigdy sam kolor.

**7. Powłoka.** Cienki pasek górny, **48 px**, bez tła i bez ramki poza włoskiem dolnym. Zawartość: nazwa produktu po lewej (nie e-mail), pięć destynacji na środku/prawej, menu konta na końcu. **E-mail znika z paska** i przenosi się do menu konta — dziś jest wizualnie najważniejszym elementem nagłówka (finding 4). Aktywna pozycja: atrament + włos pod spodem, nie wypełnienie.

**8. Nawigacja mobilna.** Jeden rząd przy 390 px: nazwa produktu + przycisk konta + `Menu`. `Menu` otwiera arkusz (sheet) z pięcioma destynacjami jako listą pełnej szerokości, cele dotykowe 48 px. Zero zawijania, zero drugiego rzędu.

**9. Kolor semantyczny.** Prawie monochrom. Akcent **jeden** — stonowany atramentowy błękit-indygo (`oklch(0.45 0.12 250)`), używany **tylko** dla pierścienia focusu i linków. Semantyka: `destructive` (czerwień przygaszona), `warning` (bursztyn), `success` (zieleń butelkowa) — wszystkie w wersji „atrament na papierze": kolorowy tekst + włos + bardzo lekki tint tła, **nigdy** wypełniona kolorowa plama. Kolor nigdy nie jest jedynym nośnikiem znaczenia — zawsze słowo obok.

**10. Ikonografia.** `lucide-react` zostaje — najbardziej spójny element całego UI (Phase 1). Stroke `1.5`, rozmiar `16`/`20`, kolor dziedziczony z tekstu. Ikony **towarzyszą** etykietom, nie zastępują ich; jedyne wyjątki to zamknięcie dialogu i przełącznik hasła (oba mają `aria-label`).

**11. Formularze.** Pole to **linia bazowa, nie pudełko**: tło papieru, dolna krawędź `1px`, brak ramki dookoła, `padding` pionowy 10 px. Etykieta nad polem, sans 13 px, `muted-foreground`. Focus: pierścień 2 px w akcencie + pociemnienie krawędzi. Błąd pola: krawędź `destructive` + komunikat pod polem + `aria-invalid`. Textarea `/generate` dostaje serif (to jest treść, nie chrome) i licznik znaków jako `muted-foreground` — z tekstem **odległości do minimum**, zgodnie z findingiem 5.

**12. Alert / empty / error / read-only.** Jeden prymityw `Notice` z czterema wariantami zamiast dzisiejszych trzech niezależnych przepisów. Wzór: **włos + tint 4–6 % + tekst w kolorze roli + ikona**. Read-only przestaje być kremową wstęgą przez cały ekran — staje się paskiem w rytmie strony, o tej samej szerokości co kolumna treści, z akcją `Cancel deletion` jako linkiem tekstowym. Empty state: nagłówek + jedno zdanie + jedna akcja, wyśrodkowany, bez ilustracji. Error: `Notice` w wariancie `destructive` + zawsze pozostawione działające wyjścia (wzorzec z dashboardu po PR #31).

**13. Dostępność.** Najłatwiejszy kierunek do przeprowadzenia przez WCAG AA: atrament na papierze daje ~14:1 bez wysiłku. Trzy realne ryzyka i ich reguły: (a) serif poniżej 17 px traci czytelność → minimum dla treści karty to 19 px; (b) „cichy" interfejs zabija widoczność focusu → pierścień 2 px z offsetem 2 px, obowiązkowy na **każdym** elemencie interaktywnym; (c) linki bez podkreślenia w monochromie są niewidoczne → podkreślenie jest wymogiem systemu, nie stylem (WCAG 1.4.1). Cele dotykowe ≥ 44 px mimo przewiewności.

**14. Jak usuwa legacy startera.** `bg-cosmic` — usunięty razem z `@utility`, `body` bierze `bg-background`. Glass `bg-white/10 backdrop-blur-xl` — usunięty bez zamiennika; jego rolę (oddzielenie karty od tła) przejmuje światło i włos, bo **na papierze nie ma czego rozmywać**. Gradienty `from-blue-200 to-purple-200` — usunięte, nagłówek to zwykły atramentowy tekst; to najostrzejsze zerwanie tego kierunku, bo gradientowy nagłówek jest dziś na **każdym** ekranie.

**15. Co zachowuje z foundation.** Nazwy tokenów semantycznych shadcn (`background/foreground/card/primary/muted/accent/destructive/border/input/ring`) — **nazwy zostają, wartości pisane od zera**. Prymitywy w stylu shadcn: `cva`, `cn`, `@radix-ui/react-slot`, `data-slot`, `style: new-york`, `baseColor: neutral` — bez zmian, `button.tsx` zostaje jako wzorzec dla kolejnych prymitywów. `lucide-react`. Tailwind 4 CSS-first z `@theme inline`. **Usuwa** `chart-1..5` (5 tokenów) i `sidebar*` (8) — ten kierunek nie ma sidebaru ani wykresów.

**16. Koszt i ryzyko migracji.** Koszt **średni**. Za: usunięcie glassa i gradientów upraszcza większość klas (przepis 4-klasowy schodzi do 1–2); brak cieni i przezroczystości oznacza mniej stanów do wyważenia. Przeciw: **odwrócenie polaryzacji** — każdy ekran zmienia jasność, więc żaden zrzut referencyjny z Phase 2 nie zostaje ważny, a zero pokrycia wizualnego oznacza, że regresje wyjdą dopiero w spacerze. Drugie ryzyko, poważniejsze: **reguły miękkie są trudne do wyegzekwowania przez agenta**. „Oddzielaj światłem" nie jest lintowalne; „nie używaj cienia poza dialogiem" — jest. Stąd zasady w §5 są napisane jako zakazy, nie jako estetyka.

**17. Czego świadomie nie robi.** Nie wprowadza własnego kroju (self-hosting to osobny, późniejszy increment). Nie wprowadza ilustracji ani systemu obrazkowego. Nie robi trybu ciemnego teraz. Nie projektuje landingu marketingowego (finding 10 to praca o tożsamości, nie o systemie). Nie dotyka gęstości biblioteki na tyle, by zmieścić więcej wierszy — świadomie zmieści ich mniej.

**Najmocniejsza strona.** Jedyny kierunek, w którym **treść karty jest największym i najmocniejszym elementem ekranu** — czyli jedyny zgodny z tym, czym produkt naprawdę jest. Dodatkowo ma najniższy koszt dostępności i najmniej ruchomych części.

**Najważniejszy trade-off.** Kupujemy spokój ceną **braku wyrazistości**. Bez cieni, gradientów i koloru interfejs stoi wyłącznie na typografii i odstępach — jeśli te zostaną wykonane niedbale (a agent wykonuje odstępy niedbale najchętniej), efektem nie jest „elegancko minimalistycznie", tylko „niedokończone". Ten kierunek nie ma siatki bezpieczeństwa.

**Pasuje / nie pasuje.** Pasuje: czytanie prozy, sesje powtarzane, niski szum poznawczy, zaufanie. Nie pasuje: gdyby produkt miał kiedyś iść w stronę gęstych zestawień danych, analityki nauki albo widoku talii z dziesiątkami elementów naraz — wtedy przewiewność zaczyna przeszkadzać.

---

### Kierunek B — „Instrument" (skupione narzędzie, dark-first)

**Teza.** Produkt to codzienny, krótki rytuał wykonywany szybko i klawiaturą. Interfejs ma być matowym pulpitem, na którym świeci tylko to, co teraz ważne.

**1. Theme strategy.** **Dark-first, jako świadomy wybór, nie kontynuacja.** Neutralna, **matowa** czerń (`oklch(0.16 0 0)`) — bez niebieskiego podbicia obecnego `#0a0e1a`, bez gradientu tła. Tekst `oklch(0.92 0 0)`, **nigdy czysta biel na czystej czerni** (halacja przy astygmatyzmie). Light jako późniejszy increment.

**2. Osobowość.** Precyzja, cisza, kontrola. Bliżej Things 3 w trybie ciemnym albo edytora audio niż aplikacji webowej. Materiał: matowy, nieprzezroczysty, bez połysku. Wszystko, co dziś „szkli się", staje się nieprzezroczyste.

**3. Typografia.** Jedna rodzina — sans systemowy/Inter. Hierarchia niesiona **wagą i kontrastem**, nie rozmiarem: `600` dla nagłówków, `400` dla treści, `500` dla akcji. Skala zwarta: `24 / 18 / 15 / 13`. Cyfry tabularne wszędzie, gdzie stoi liczba (`Card 1 of 12`, licznik znaków, liczniki dashboardu) — liczba, która nie drga przy zmianie, jest tu elementem charakteru. `FRONT`/`BACK` w wersji `mono`, 11 px, uppercase.

**4. Powierzchnie i elewacja.** **Elewacja przez walor**, nie przez cień: `surface-0` = tło (0.16), `surface-1` = karta (0.20), `surface-2` = warstwa unosząca się (0.24). Ramki tylko tam, gdzie różnica waloru nie wystarcza (≤ 0.04). Zero `backdrop-blur`, zero `rgba(255,255,255,α)` jako powierzchni — bo to właśnie glass, tylko przemalowany. Promień `8 px`.

**5. Spacing i gęstość.** Skala 4 px, wartości **zwarte**: rytm 16/24/32, wnętrze karty 16/20. Gęstość średnio-wysoka wszędzie **poza `/review`**, gdzie ekran celowo się rozrzedza — to jedyne miejsce z rytmem 32/48.

**6. Hierarchia akcji.** Primary — wypełniony akcentem, tekst niemal czarny (akcent jest jasny, więc kontrast idzie w drugą stronę). Secondary — `surface-2` + ramka. Tertiary — sam tekst, bez tła, zawsze podkreślony w treści. **Destructive nigdy nie jest primary** — zawsze obrys w czerwieni, wypełnienie zarezerwowane dla potwierdzenia w dialogu.

**7. Powłoka.** Pasek górny 52 px na `surface-1`, przyklejony. Nazwa produktu + destynacje + menu konta. **Kluczowa cecha kierunku: tryb skupienia.** Na `/review` powłoka redukuje się do jednego przycisku wyjścia i wskaźnika postępu — reszta znika. Sesja dostaje cały ekran, bo to jedyny ekran, na którym użytkownik nie nawiguje.

**8. Nawigacja mobilna.** **Dolny pasek** z trzema destynacjami rdzenia (`Review`, `Generate`, `Library`) + `Więcej` (Dashboard, Settings, konto). Ikona + etykieta, zawsze obie. Podczas sesji dolny pasek **znika** — to samo skupienie co na desktopie.

**9. Kolor semantyczny.** Monochrom + **jeden** żywy akcent, np. bursztyn (`oklch(0.78 0.15 75)`) — celowo nie niebieski i nie fioletowy, żeby zerwać z paletą startera w sposób widoczny na pierwszy rzut oka. Akcent wyłącznie: primary action, focus ring, aktywna pozycja nawigacji, wskaźnik postępu. Semantyka na ciemnym tle: kolor **tekstu i ramki**, tło jako tint 8–10 %. Dwa przyciski ocen w `/review` (`Again` / `Good`) dostają rozróżnienie kształtem i etykietą, nie tylko kolorem — dziś stoją na czerwieni/zieleni.

**10. Ikonografia.** `lucide-react`, stroke `1.75` (na ciemnym tle cieńsze kreski znikają), rozmiary `16`/`20`. Ikony niosą więcej pracy niż w A — w dolnym pasku są obowiązkowe.

**11. Formularze.** Pole jako **wgłębienie**: tło `oklch(0.13 0 0)` (ciemniejsze niż powierzchnia), ramka 1 px, promień 8 px. Placeholder `muted-foreground`, nigdy jako zamiennik etykiety. Focus: ramka w akcencie + pierścień 2 px na 40 % akcentu. To najbardziej rozpoznawalny wzorzec pól w ciemnych interfejsach i wymaga najmniej wyjaśnień.

**12. Alert / empty / error / read-only.** Prymityw `Notice`: lewa **szyna 3 px** w kolorze roli + tint 8 % + tekst. Read-only rozwiązuje finding 8 najostrzej ze wszystkich kierunków — dzisiejszy problem to jasna wstęga na ciemnym; tutaj baner staje się natywnie ciemny i **przestaje być szwem**. Empty state: ikona 24 px w `muted`, nagłówek, zdanie, jedna akcja. Error: szyna `destructive` + wyjścia.

**13. Dostępność.** Trzy zobowiązania obowiązkowe: (a) nigdy `#fff` na `#000` — maksymalny kontrast tekstu ~13:1, nie 21:1; (b) akcent bursztynowy musi przejść 4.5:1 jako tekst na `surface-0` **oraz** 3:1 jako element nietekstowy (ramka, wskaźnik) — sprawdzone przed wpisaniem do tokenów; (c) ciemny motyw ukrywa słabe pierścienie focusu — pierścień musi mieć 2 px i widoczny offset na `surface-1` **i** `surface-2`. Ryzyko dodatkowe: tryb skupienia chowa nawigację, więc wyjście z sesji musi być osiągalne klawiaturą i mieć jasną etykietę.

**14. Jak usuwa legacy startera.** To najbardziej mylący kierunek pod tym względem i wymaga twardej deklaracji: **ciemność zostaje, ale nie zostaje nic innego**. `bg-cosmic` — gradient trójstopniowy zastąpiony jednym płaskim tokenem, `@utility` usunięte. Glass — usunięty co do jednego wystąpienia; `bg-white/10` jest zakazany jako powierzchnia, bo powierzchnia ma **własny walor**, a nie przezroczystą biel. Gradienty niebiesko-fioletowe — usunięte razem z całym niebieskim i fioletowym; akcent zmienia rodzinę barwną, żeby „to jest inny produkt" było widać bez porównywania.

**15. Co zachowuje z foundation.** Wszystko to, co A: nazwy tokenów, `cva`/`cn`/Slot, `button.tsx` jako wzorzec, `lucide-react`, `@theme inline`. Różnica: `.dark` staje się blokiem **kanonicznym**, a `:root` — rezerwą. Usuwa `chart-1..5` i `sidebar*`.

**16. Koszt i ryzyko migracji.** Koszt **średni, pozornie najniższy**. Polaryzacja się nie zmienia, więc zrzuty referencyjne pozostają porównywalne, a wyczucie „czy nie zrobiło się gorzej" jest łatwiejsze. **I to jest jego największe ryzyko**: kierunek, który wygląda na tani, zostanie wdrożony po łebkach. `bg-white/10 backdrop-blur-xl` → `bg-surface-1` to zamiana jeden-do-jednego, którą agent wykona bez zastanowienia — i po 331 zamianach dostaniemy ten sam starter w innych kolorach, bez rozwiązanego findingu 8. Ryzyko drugie: **odwrócenie shadcn**. Prymitywy renderują `:root`, więc każdy nowy komponent domyślnie wpadnie w jasny motyw, dopóki `.dark` nie zostanie faktycznie aplikowane — dziś dokładnie ten mechanizm produkuje czarny `<Button>` na ciemnym tle w Bibliotece.

**17. Czego świadomie nie robi.** Nie robi trybu jasnego teraz. Nie wprowadza koloru jako dekoracji. Nie dodaje animacji poza odsłonięciem karty. Nie zwiększa gęstości `/review`. Nie wprowadza sidebaru.

**Najmocniejsza strona.** **Tryb skupienia.** Jedyny kierunek, w którym powłoka ma zdefiniowane zachowanie „zejdź z drogi" — a `/review` jest najlepszym ekranem produktu i najczęściej odwiedzanym. Dodatkowo rozwiązuje finding 8 u źródła, bo cały produkt staje się natywnie ciemny łącznie z banerami.

**Najważniejszy trade-off.** Ciemny motyw jako jedyny to **zawężenie kontekstu czytania**. Produkt do czytania prozy przy dziennym świetle jest trudniejszy w dark mode dla większości użytkowników bez wady wzroku; wybieramy komfort wieczornej sesji kosztem porannej. Do tego dochodzi trade-off procesowy: nieodróżnialność „zrobione dobrze" od „przemalowane" na pierwszy rzut oka.

**Pasuje / nie pasuje.** Pasuje: klawiaturowa sesja powtórek, krótki rytuał, skupienie, wieczorna nauka. Nie pasuje: długie czytanie za dnia, pierwszy kontakt (landing, rejestracja), oraz — istotne — **charakter „AI proponuje, człowiek decyduje"**, bo ciemny, matowy, monochromatyczny interfejs najtrudniej różnicuje stan draftu od stanu zapisanego przy pomocy samego waloru.

---

### Kierunek C — „Konstrukcja" (neutralna użytkowość, dual-theme)

**Teza.** Produkt jest narzędziem pracy z zawartością, a nie doświadczeniem. Tożsamością nie jest kolor ani światło, tylko **struktura**: siatka, ramka, stała powłoka i konsekwentne kodowanie stanu.

**1. Theme strategy.** **Dual-theme od pierwszego dnia**, i to jest jego definicyjna cecha, nie dodatek. Obie palety wyprowadzone **mechanicznie z jednej rampy jasności** neutralnej (11 stopni, 0.10 → 0.99) — dark to ta sama rampa czytana od drugiego końca. Motyw wybierany przełącznikiem z zapisem preferencji + `prefers-color-scheme` jako wartość początkowa.

**2. Osobowość.** Rzeczowa, inżynierska, przewidywalna. Bliżej Linear/GitHub/Height. Nic nie jest ozdobne; wszystko jest oznaczone. Charakter bierze się z **konsekwencji**, nie z wyrazu.

**3. Typografia.** Jedna rodzina sans, skala **pięciostopniowa i płaska**: `24 / 18 / 15 / 14 / 12`. **Największy tekst w produkcie ma 24 px** — świadomie brak rozmiarów „display". Hierarchia niesiona wagą (`600`/`500`/`400`) i kolorem tekstu (`foreground` / `muted-foreground`). Cyfry tabularne. Treść karty: 16 px, waga 400 — czyli **karta nie dostaje typograficznego wyróżnienia**, dostaje je pozycją i ramką.

**4. Powierzchnie i elewacja.** **Ramka zamiast cienia — zawsze, bez wyjątku, także dla dialogów.** `border` 1 px w tokenie, promień jednolity `6 px`. Dwie powierzchnie: `background` i `card`, różniące się o jeden stopień rampy. Elewacja jako pojęcie **nie istnieje** w tym systemie — warstwy rozróżnia overlay tła, nie unoszenie.

**5. Spacing i gęstość.** Siatka 4 px egzekwowana rygorystycznie, rytm 8/12/16/24. **Gęstość wysoka i jednolita** na wszystkich ekranach — biblioteka mieści ~2× więcej wierszy niż w kierunku A. Kolumna treści `max-w-[880px]` z sidebarem po lewej.

**6. Hierarchia akcji.** Primary — wypełniony akcentem, wysokość 32 px (nie 40). Secondary — obrys. Tertiary — link. Dodatkowo, i to jest cecha tego kierunku: **akcje wierszowe** (`icon button` 28 px) jako czwarty poziom, potrzebny przy gęstej bibliotece.

**7. Powłoka.** **Trwały sidebar 240 px** na ≥ 1024 px: nazwa produktu, pięć destynacji z ikonami, konto na dole. Nagłówek strony jako pasek nad treścią z tytułem i akcjami kontekstowymi. Powłoka jest **zawsze widoczna** — również w sesji powtórek; ten kierunek nie ma trybu skupienia i uznaje to za zaletę (orientacja > zanurzenie).

**8. Nawigacja mobilna.** **Dolny tab bar** z pięcioma pozycjami, ikona + etykieta 11 px, wysokość 56 px + safe-area. Sidebar znika poniżej 1024 px. To jedyny kierunek, w którym mobilna i desktopowa powłoka to **dwa różne komponenty**, a nie jeden responsywny.

**9. Kolor semantyczny.** **Pełny, funkcjonalny zestaw** — kolor jest tu narzędziem kodowania, nie oszczędnym akcentem: `accent` (akcja/aktywne), `success` (zapisane), `warning` (oczekujące / read-only), `destructive` (usuwanie), `info` (draft AI). Każdy z nich występuje w trzech rolach: tekst, ramka, tint 10 %. **Stan karty jest kodowany kolorem szyny po lewej** — draft, zapisana, do powtórki dziś. To jedyny kierunek, w którym język zaufania (draft vs zapisane) jest wbudowany w system, a nie dopisany.

**10. Ikonografia.** `lucide-react`, stroke `2`, rozmiar `16` dominujący. Ikony są **obowiązkowe** w nawigacji, akcjach wierszowych i wszystkich `Notice` — to część kodowania, nie ozdoba. Najbardziej „ikonowy" z trzech kierunków.

**11. Formularze.** Pole z ramką, tło = `background` (nie `card`), wysokość 32 px, promień 6 px — dokładnie ten sam kształt co przycisk secondary. Etykieta nad polem, 12 px, `muted-foreground`. Pomoc kontekstowa pod polem. Focus: ramka `accent` + pierścień 2 px. Formularze są tu najbardziej „gotowe" ze wszystkich kierunków, bo są najbliżej domyślnego shadcn — to jednocześnie ich siła i słabość.

**12. Alert / empty / error / read-only.** `Notice` z szyną 3 px, ikoną i wariantem — spójny z kodowaniem stanu kart, więc użytkownik uczy się jednego języka. Read-only: pasek `warning` przyklejony pod nagłówkiem strony, z akcją `Cancel deletion` jako `Button secondary` — w obu motywach. Empty state: ramka przerywana, ikona, zdanie, akcja. Error: `Notice destructive` + wyjścia.

**13. Dostępność.** Najlepiej **dowodliwy** kierunek: paleta z jednej rampy pozwala policzyć kontrast dla każdej pary ról raz i zagwarantować go w obu motywach. Realne ryzyka to konsekwencje gęstości: (a) tekst 12 px w etykietach jest na granicy — dopuszczalny tylko dla etykiet nawigacji, nigdy dla treści; (b) akcje wierszowe 28 px **naruszają** cel dotykowy 44 px → na mobile muszą urosnąć do 44 px albo przenieść się do menu; (c) kodowanie kolorem szyny wymaga dublowania słowem — inaczej daltonista traci połowę informacji, którą ten system uznał za nośną.

**14. Jak usuwa legacy startera.** `bg-cosmic` — usunięty, tło z rampy w obu motywach. Glass — usunięty; przezroczystość nie ma tu żadnej roli, bo warstwy rozróżnia ramka. Gradienty — usunięte, a wraz z nimi **cała kategoria „tekst kolorowany gradientem"**; nagłówki są jednobarwne, bo w dual-theme gradient trzeba by utrzymać w dwóch wersjach i w żadnej nie przejdzie kontrastu na pewno.

**15. Co zachowuje z foundation.** Zachowuje **najwięcej**: nazwy tokenów, `cva`/`cn`/Slot, `button.tsx`, `lucide-react`, `@theme inline` — i jako jedyny **zatrudnia 8 osieroconych tokenów `sidebar*`**, które w kierunkach A i B idą do usunięcia. Usuwa tylko `chart-1..5`. Jest też jedynym kierunkiem, w którym wartości `:root`/`.dark` z shadcn są sensownym **punktem startowym** (choć neutralna szarość wymaga docieplenia).

**16. Koszt i ryzyko migracji.** Koszt **najwyższy**, i to niemal dwukrotnie. Powody: (a) każdy z ~30 plików musi być poprawny w **dwóch** paletach, przy zerowym pokryciu regresji wizualnej i trzech specyfikacjach E2E; (b) powłoka to dwa osobne komponenty (sidebar + tab bar) plus przełącznik motywu z persystencją — to trzy nowe rzeczy do zbudowania, zanim jakikolwiek ekran zostanie przepisany; (c) sesja powtórek wymaga przeprojektowania pod stałą powłokę. Ryzyko główne: **podwojenie powierzchni poprawności w tym samym momencie, w którym wyciągamy pierwsze komponenty współdzielone** — czyli dwa źródła niepewności naraz.

**17. Czego świadomie nie robi.** Nie robi trybu skupienia. Nie różnicuje typograficznie treści karty od chrome. Nie dodaje wykresów mimo posiadania tokenów `chart-*`. Nie wprowadza ilustracji. Nie optymalizuje pod długie czytanie.

**Najmocniejsza strona.** **Jest najbardziej wykonalny przez agenta.** Wszystkie jego reguły są binarne i lintowalne: „ramka, nie cień", „wszystko na siatce 4", „każdy kolor z rampy", „każdy stan ma szynę i słowo". Przy pipelinie, w którym implementację prowadzi model, kierunek o twardych regułach wygrywa z kierunkiem o dobrym guście. Drugi atut: jako jedyny ma **wbudowany język zaufania** dla draftów AI.

**Najważniejszy trade-off.** Gęstość i neutralność kupują spójność ceną **charakteru i komfortu czytania**. Karta 16 px w gęstej siatce, z powłoką zawsze na ekranie, to interfejs do zarządzania kartami — a nie do ich czytania. Produkt zaczyna wyglądać jak panel administracyjny własnej talii.

**Pasuje / nie pasuje.** Pasuje: biblioteka, triaż draftów, ustawienia, orientacja, przewidywalność, dostępność dowodliwa. Nie pasuje: `/review` — czyli ten ekran, na którym użytkownik spędza najwięcej czasu i który Phase 2 wskazała jako wzorzec, do którego reszta ma dorównać.

---

## 2. Zestawienie decydujące

| Kryterium (waga)                                   | A — Papier | B — Instrument | C — Konstrukcja |
| -------------------------------------------------- | ---------- | -------------- | --------------- |
| Komfort czytania treści karty (wysoka)             | **★★★**    | ★★             | ★               |
| Jakość ekranu `/review` (wysoka)                   | ★★         | **★★★**        | ★               |
| Widoczny język zaufania draft vs zapisane (wysoka) | ★★         | ★              | **★★★**         |
| Niski szum poznawczy (wysoka)                      | **★★★**    | ★★★            | ★★              |
| Wykonalność przez pipeline agentowy (wysoka)       | ★          | ★★             | **★★★**         |
| Dowodliwość dostępności (średnia)                  | ★★★        | ★★             | **★★★**         |
| Zerwanie z legacy widoczne gołym okiem (średnia)   | **★★★**    | ★★             | ★★★             |
| Jakość biblioteki i triażu (średnia)               | ★          | ★★             | **★★★**         |
| Koszt migracji (niższy = lepiej)                   | ★★         | **★★★**        | ★               |
| Ryzyko wdrożenia „po łebkach" (niższe = lepiej)    | ★★         | ★              | **★★★**         |

---

## 3. 🎯 Rekomendacja: **kierunek A — „Papier"**, z dwoma przeszczepami z C

**Decydujący argument.** Kryteria o najwyższej wadze wynikają z jednego zdania o produkcie, a nie z kodu: to jest narzędzie do **czytania własnych notatek**. Karta jest prozą i jest oglądana setki razy w roku. Tylko kierunek A czyni z niej największy i najmocniejszy element ekranu. B optymalizuje pod skupienie kosztem komfortu czytania za dnia; C optymalizuje pod zarządzanie kartami kosztem ich czytania. Obie te optymalizacje są sensowne dla innych produktów.

**Drugi argument — negatywny, ale ważny.** Kierunek B jest wyborem, który _wyglądałby_ najrozsądniej i którego nie wolno zrobić z tego powodu. Zachowanie ciemnego motywu byłoby dziś nie decyzją, tylko brakiem decyzji — obecna ciemność to `bg-cosmic` ze startera, przy tokenach rozwiązujących się do jasnych. Gdyby dark-first wygrał, musiałby wygrać jako **odwrócenie** obecnego wyglądu (matowa neutralna czerń, bursztyn zamiast błękitu i fioletu, zero glassa), a nie jako jego kontynuacja — i wtedy jego rzekoma taniość znika.

**Trzeci argument — o ryzyku, nie o guście.** Jedyną poważną przewagą C jest wykonalność: reguły binarne wygrywają z gustem, gdy implementację prowadzi model. Ta przewaga jest realna i nie odrzucam jej — **przenoszę ją**. Stąd dwa jawne przeszczepy:

**Przeszczep 1 — jedna rampa jasności zamiast dwóch palet pisanych ręcznie.** Paleta A powstaje jako 11-stopniowa rampa ciepłej neutralnej (`hue ≈ 60–85`, `chroma ≤ 0.012`), a wszystkie role (`background`, `card`, `border`, `muted-foreground`, `foreground`) są **przypisaniami stopni rampy**, nie osobnymi kolorami. Skutki: kontrast policzalny raz dla wszystkich par ról; dark mode staje się później **odwróceniem przypisań**, a nie nową paletą; recenzja może sprawdzić „czy ten kolor jest stopniem rampy" mechanicznie.

**Przeszczep 2 — separacja ramką i światłem, cień wyłącznie dla warstw unoszących się.** Reguła C w wersji z jednym wyjątkiem (dialog/popover/toast). Jest binarna, lintowalna i eliminuje najczęstszy sposób, w jaki „minimalistyczny" projekt cicho zamienia się w stertę pudełek.

**Czego z C świadomie nie bierzemy.** Gęstości (karta ma oddychać), stałej powłoki na `/review`, płaskiej skali typograficznej bez rozmiarów treściowych, i dual-theme jako pracy MVP (§4).

**Czego z B świadomie nie bierzemy — poza jednym.** Bierzemy **tryb skupienia na `/review`** jako zachowanie powłoki: podczas sesji nawigacja redukuje się do wyjścia i wskaźnika postępu. To najsilniejsza cecha B i jest niezależna od motywu — jasny interfejs skupia się dokładnie tak samo dobrze. Reszta B odpada wraz z decyzją o motywie.

### Co ten wybór oznacza dla findingów Phase 2

| Finding                                         | Rozstrzygnięcie w kierunku A                                                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3** — przepełnienie `/review` przy 390 px     | Prymityw treści karty ma `break-words` i miarę w `ch`. Naprawiony raz, dla wszystkich ekranów. Nadal **nie powinien czekać** na C — Phase 3 słusznie wypycha go poza ścieżkę redesignu. |
| **4** — 18 % ekranu na e-mail i zawinięte linki | E-mail wychodzi z paska do menu konta; powłoka to jeden rząd 48 px + arkusz na mobile.                                                                                                  |
| **8** — dwa języki wizualne, baner jako szew    | `Banner` traci scoped `<style>` i hexy, staje się prymitywem `Notice` na tokenach. Szew znika, bo nie ma już dwóch języków.                                                             |
| **10** — landing sprzedaje starter              | Kierunek daje system, ale nie tożsamość. Landing to osobna praca (nazwa, `title`, copy) — nie należy jej wciągać do C.                                                                  |
| **1** — bramka jakości AI                       | System dostarcza **wizualny język draftu** (zasada 7 w §5). Zachowanie bramki pozostaje pracą strategii A z Phase 3, nieodblokowaną tą decyzją.                                         |

---

## 4. Rozstrzygnięcie motywu

### Light-first vs dark-first vs dual-theme

**Decyzja: light-first.** Uzasadnienie w trzech punktach, w kolejności ważności:

1. **Charakter produktu.** Główna czynność to czytanie prozy w krótkiej sesji, często za dnia. Jasne tło jest tu domyślnie właściwe, a ciemne jest preferencją kontekstową — nie odwrotnie.
2. **Sesja jest krótka.** Argument „dark mode do wieczornej nauki" jest prawdziwy, ale dotyczy 2–10 minut dziennie, nie godzin pracy. To uzasadnia **increment**, nie fundament.
3. **Dopiero na trzecim miejscu — koszt.** Jedna paleta to jedna powierzchnia poprawności przy zerowym pokryciu regresji wizualnej i trzech specyfikacjach E2E. Gdyby dwa pierwsze punkty wypadły inaczej, ten by ich nie przeważył.

**Dual-theme odrzucone jako praca MVP, nie jako cel.** Kluczowe rozróżnienie: odrzucamy **utrzymywanie dwóch palet naraz**, nie odrzucamy trybu ciemnego. Argument „przecież `.dark` już jest w `global.css`, to prawie darmowe" jest **fałszywy** i warto go zapisać, bo wróci:

- wartości w bloku `.dark` to niezmienione domyślne shadcn `neutral`, nie wybrana paleta;
- klasa `.dark` nie jest nigdzie w `src/` aplikowana, więc **żaden ekran nigdy nie wyrenderował się w tym motywie**;
- `.uxproof/tokens.json` zapisał wartości `.dark` jako „paletę produktu" (deduplikacja po nazwie), co jest już odnotowane w sekcji manualnej jako nieścisłość — dual-theme dziś istnieje wyłącznie w pliku, którego nikt nie renderuje.

### Czy dark mode to praca MVP visual-system, czy późniejszy increment

**Późniejszy increment.** Konkretnie:

- **Jest pracą MVP:** ograniczenia, które czynią dark możliwym później. Każdy kolor przez token roli; zero surowych hexów i zero skal Tailwind w `src/`; nazwy tokenów po **roli**, nigdy po wartości (`surface-raised`, nie `gray-50`); paleta wyprowadzona z jednej rampy, tak by dark był przypisaniem stopni w drugą stronę; blok `.dark` **przepisany uczciwie z tej samej rampy** i utrzymywany równolegle, nawet gdy nie jest aplikowany — token dodany tylko do jednego bloku to finding.
- **Nie jest pracą MVP:** przełącznik, persystencja preferencji, obsługa `prefers-color-scheme`, przejście bez błysku (FOUC) przy SSR Astro, weryfikacja ~30 plików w drugim motywie, drugi spacer przeglądarkowy.
- **Kiedy:** jako osobny increment po tym, jak wszystkie ekrany są na tokenach — czyli po zamknięciu C, nie w jego trakcie. Warunek wejścia: `0` zahardkodowanych kolorów w `src/`. Dopóki jest ich 331, przełącznik motywu przełącza jedną trzecią interfejsu.
- **Warunek dodatkowy:** increment dark mode kończy się spacerem przeglądarkowym w **obu** motywach. Phase 2 zaraportowała przejście dark/light jako **nieprzeprowadzone** — ta luka nie może się powtórzyć przy wdrożeniu, które ją wreszcie umożliwia.

**Ostrzeżenie o istniejącej pułapce.** `button.tsx` zawiera już warianty `dark:` (`dark:bg-input/30`, `dark:hover:bg-accent/50`, `dark:bg-destructive/60`). Dopóki `.dark` nie jest aplikowane, są martwe; w chwili włączenia przełącznika **ożyją bez recenzji**. Increment dark mode musi je przejrzeć jawnie, a nie odkryć.

---

## 5. Zasady wizualne — propozycja do sekcji manualnej `.uxproof/conventions.md`

Osiem zasad, sformułowanych jako **rozstrzygalne zakazy i wymogi**, nie jako estetyka — bo sekcja manualna jest powierzchnią, według której recenzja wydaje findingi, a implementację prowadzi model. Każda zasada mówi, co jest findingiem.

> **Uwaga: niniejszy plik niczego nie zmienia w `.uxproof/`.** Poniższe wchodzi do `conventions.md` dopiero jako osobny krok, po akceptacji kierunku.

**1. Atrament na papierze, nie światło na szkle.**
Tło strony to jeden płaski token powierzchni. Zakazane w `src/`: `bg-cosmic` i jakikolwiek gradient jako tło lub wypełnienie, `backdrop-blur-*`, `bg-white/N` i `bg-black/N` jako powierzchnia. Każde wystąpienie jest findingiem — także w kodzie nietkniętym przez daną zmianę, jeśli zmiana ten plik i tak przepisuje.

**2. Każdy kolor pochodzi z tokenu roli, a role pochodzą z jednej rampy.**
Zero surowych hexów, `rgb()`, `oklch()` i zero skal Tailwind (`blue-500`, `white/10`, `red-900/30`) w `src/`. Tokeny nazywane po roli, nigdy po wartości. `:root` i `.dark` deklarują **ten sam zestaw nazw** wyprowadzony z jednej rampy jasności — token obecny tylko w jednym bloku jest findingiem, nawet gdy `.dark` nie jest aplikowane.

**3. Treść jest bohaterem; chrome się cofa.**
Na każdym ekranie tekst treści (front/tył karty, tekst źródłowy, treść draftu) jest największym i najbardziej kontrastowym elementem. Jeśli nagłówek, przycisk lub powłoka przeważają wizualnie nad treścią — ekran jest zrobiony źle. Nagłówki są jednobarwne: **tekst kolorowany gradientem jest zakazany w całym produkcie**. Miara tekstu treści ograniczona do ~66 ch i zawsze łamiąca długie ciągi.

**4. Separacja włoskiem i światłem — nigdy cieniem.**
Jeden token ramki, jedna skala promienia. `shadow-*` dozwolone **wyłącznie** dla warstw naprawdę unoszących się: `Dialog`, `Popover`, `Tooltip`, `Toast`. Cień na karcie, sekcji, panelu, przycisku lub polu formularza jest findingiem.

**5. Jedna akcja główna na ekran.**
Dokładnie jeden wypełniony przycisk na widok. Wszystko inne to obrys albo podkreślony link tekstowy. Akcja destrukcyjna nigdy nie jest akcją główną — wypełnienie w kolorze `destructive` zarezerwowane dla potwierdzenia w dialogu. Link musi być rozpoznawalny bez koloru (WCAG 1.4.1), czyli podkreślony.

**6. Kolor semantyczny oznacza stan, nie ozdobę.**
Akcent służy wyłącznie akcji głównej, pierścieniowi focusu i pozycji aktywnej w nawigacji. `destructive` / `warning` / `success` występują tylko dla, odpowiednio, usuwania, stanu oczekującego lub read-only, i potwierdzenia. Kolor **nigdy nie jest jedynym nośnikiem znaczenia** — zawsze towarzyszy mu słowo, a tam, gdzie system je przewiduje, ikona. Dwa przyciski ocen w `/review` muszą różnić się etykietą i kształtem, nie samym kolorem.

**7. Draft jest widocznie tymczasowy.**
Treść wygenerowana przez AI i niezapisana **nigdy** nie wygląda tak samo jak zapisana karta: inne traktowanie powierzchni plus jawna etykieta stanu. Ekran, na którym draft i karta z biblioteki są nieodróżnialne, jest findingiem — bramka „AI proponuje, człowiek decyduje" musi być widoczna, nie tylko zaimplementowana.

**8. Jedna powłoka, jeden szkielet strony.**
Każdy ekran składa się z prymitywów z rejestru (`PageHeader`, `Section`, `Card`, `Notice`, `EmptyState`, `Field`). Strona, która powtarza inline przepis na kartę, nagłówek, komunikat błędu lub stan pusty, jest findingiem — nawet jeśli wynik wygląda poprawnie. Powłoka mieści się w jednym rzędzie przy 390 px, `scrollWidth` nigdy nie przekracza szerokości okna na żadnym ekranie i przy żadnej treści, a podczas sesji powtórek powłoka redukuje się do wyjścia i wskaźnika postępu.

---

## 6. Co ta decyzja odblokowuje, a czego nie

**Odblokowuje.** Strategię C w całości: rampa i role → prymitywy (`Notice`, `Card`, `PageHeader`, `EmptyState`, `Field`) → powłoka i nawigacja mobilna → migracja ekranów → wycofanie landingu startera. Kolejność ma znaczenie: **tokeny przed prymitywami, prymitywy przed ekranami** — odwrotna kolejność produkuje trzeci równoległy język wizualny.

**Nie odblokowuje i nie przesądza.** Zachowania bramki jakości AI (strategia A z Phase 3 — nadal zależy od wyniku testu pętli przechwytywania, nie od tej decyzji). Tożsamości produktu: nazwy, `title`, favicony, copy landingu. Własnego kroju pisma — start na stackach systemowych, self-hosting to osobny increment. Trybu ciemnego — §4.

**Otwarte pytanie do rozstrzygnięcia w pierwszym incremencie C, nie tutaj.** Czy `/review` w trybie skupienia chowa również baner read-only. Argument za: sesja ma być pusta. Argument przeciw: read-only blokuje ocenianie, więc ukrycie wyjaśnienia zostawia użytkownika przed martwym ekranem. Rozstrzygnięcie wymaga sprawdzenia, co dziś renderuje `/review` w stanie read-only — czyli spaceru, nie deliberacji.

---

## Decyzja

**Kierunek: A — „Papier"**, light-first, z przeszczepem rampy jasności i reguły „ramka zamiast cienia" z kierunku C oraz trybu skupienia na `/review` z kierunku B.

**Dark mode: późniejszy increment**, po zamknięciu migracji tokenów; ograniczenia umożliwiające go są częścią pracy MVP.

**Status: przyjęty 2026-08-22.** `src/` nietknięte, brak PR-a, brak speca.

**Wykonane po akceptacji:** osiem zasad z §5 wpisane do sekcji manualnej `.uxproof/conventions.md` jako sekcja `Visual direction — decided 2026-08-22`. Przy okazji zaktualizowano tam dwie rzeczy, które stały się nieprawdziwe: sekcja `Light/dark drift` przestała mówić, że motyw jest pytaniem otwartym (teraz: light-first, plus ostrzeżenie o martwych wariantach `dark:` w `button.tsx`), a licznik legacy w `Legacy starter styling` dostał pomiar z 2026-08-22 (331 vs 26) obok pierwotnego (247 vs 4).

**Następny krok:** `om-ux-shape` w trybie Handoff dla **pierwszego incrementu strategii C**. Rekomendowany zakres, zgodnie z kolejnością z §6 („tokeny przed prymitywami, prymitywy przed ekranami"): rampa jasności i przypisanie ról w `src/styles/global.css` — bez migracji żadnego ekranu. Uzasadnienie: to jedyny krok, po którym każdy następny ma czym się posługiwać, i jedyny, który nie wymaga rozstrzygania niczego o układzie.
