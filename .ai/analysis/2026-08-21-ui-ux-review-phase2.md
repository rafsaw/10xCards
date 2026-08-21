# Raport: UI/UX review — Phase 2 (`om-ux-shape`, tryb Review)

- **Data:** 2026-08-21
- **Repo:** 10xCards
- **Branch bazowy:** `main` (czysty, `4dded8b`)
- **Typ:** review read-only — nie zmieniono `src/`, nie utworzono PR-a ani speca
- **Skill:** `om-ux-shape` w trybie Review, nad całym produktem
- **Wejścia:** `.ai/analysis/2026-08-21-ui-ux-discovery-phase1.md`, `.uxproof/`, kod z `main`, browser walk
- **Materiał dowodowy:** `.ai/qa/artifacts_uxwalk-20260821210548/` (39 zrzutów, `walk-log.json`, skrypty sond) — katalog gitignorowany
- **Zakres świadomie pominięty:** kierunek wizualny, decyzja jasny/ciemny/przełącznik, strategie redesignu (Phase 3)

---

## 🔍 Werdykt: **simplify** — nie rethink, nie rewrite

10xCards ma działający, kompletny rdzeń: generacja AI kończy się w **4 sekundy**, sesja powtórek jest dobrze zaprojektowana, biblioteka ma search, paginację i edycję inline, a stan read-only konta jest obsłużony na każdym ekranie i odwracalny jednym kliknięciem. Żadnej z tych rzeczy nie należy przepisywać.

Podstawowy problem nie leży w wyglądzie. Leży w tym, że **produkt nie mówi użytkownikowi, co ma teraz zrobić, i nie pozwala mu poprawić tego, co AI zaproponowało**. Ekran po zalogowaniu jest pusty. Bramka, która miała chronić bibliotekę przed słabymi kartami AI, jest domyślnie otwarta i nie zawiera edycji. To są problemy strukturalne i żaden z nich nie wymaga rozstrzygnięcia, czy aplikacja ma być jasna czy ciemna.

---

## ✅ Co działa i powinno być punktem odniesienia

**Sesja powtórek to najlepszy ekran w produkcie.** Postęp „Card 1 of 2", wyraźne etykiety FRONT/BACK, dwa jednoznacznie rozróżnione przyciski oceny, widoczne podpowiedzi klawiszowe przygasające, gdy nie są aktywne, `aria-keyshortcuts` na przyciskach i blokada podwójnego wysłania (`lockRef`). Ten ekran wie, w jakim jest stanie, i mówi to użytkownikowi.

**Biblioteka radzi sobie z treścią, której nie kontroluje.** `CardRow` łamie długie słowa (`break-words`), ma edycję w miejscu z Save/Cancel, potwierdzenie przed kasowaniem i komunikaty błędów per wiersz.

**Jakość generacji jest dobra.** 12 wygenerowanych kart z dwóch wklejek to sensowne pytania i zwięzłe odpowiedzi, bez halucynacji względem źródła. Licznik „Generating… 3s" na przycisku to uczciwy sygnał postępu.

**Stan read-only jest przemyślany.** Baner z datą, „Cancel deletion" bezpośrednio w banerze na każdej stronie, akcje wyłączone na czterech ekranach z wyjaśnieniem zamiast pustego miejsca. Odwracalność zweryfikowana w spacerze: po Cancel konto wraca do normy.

---

## 🔍 Findings — najgorsze najpierw

Ranking według **wpływu × częstotliwości × zasięgu**, nie według łatwości naprawy.

### 1. Bramka jakości AI jest domyślnie otwarta i nie da się w niej nic poprawić

**Gdzie:** `/generate`, lista draftów — north star produktu.

**Dowód:** wszystkie drafty startują z decyzją `accept` (`init[d.id] = "accept"` w `DraftReviewList.tsx`), nagłówek pokazuje „12 to save · 0 to discard", a inwentarz przycisków ze spaceru to `["Keep all", "Discard all", "Keep", "Save changes", "Generate"]` — **nie ma „Edit"**. Ścieżka najmniejszego oporu prowadzi do zapisania dwunastu nieprzeczytanych kart. Poprawa prawie dobrej karty wymaga zapisania jej, przejścia do biblioteki i odnalezienia. `[PRODUCT]`

**Dlaczego pierwsze:** roadmapa nazywa ten przepływ „gated generation" (S-01, S-02) — bramka jest głównym uzasadnieniem, że AI nie zanieczyści talii. Bramka domyślnie przepuszczająca wszystko i bez możliwości korekty nie jest bramką. Zła karta w talii kosztuje wielokrotnie, bo wraca w każdej sesji. Odrzucona dobra karta kosztuje raz i jest odtwarzalna w 4 sekundy. Produkt myli się dziś w droższą stronę. `[RESEARCH]` — Microsoft HAI wytyczna 9 (tania korekta); Google PAIR, funkcja nagrody.

**Kryterium akceptacji:** użytkownik poprawia treść karty na `/generate` i zapisuje poprawioną wersję do talii, nie odwiedzając biblioteki.

**Znane założenie:** że brak edycji realnie kosztuje użytkownika, a nie że ludzie klikają „Keep all" i nigdy nie poprawiają. Brak analityki i realnych użytkowników — patrz sekcja „Następny test".

### 2. Ekran po zalogowaniu nie odpowiada na pytanie „co teraz?"

**Gdzie:** `/dashboard` — cel przekierowania po każdym logowaniu (`index.astro:5`).

**Dowód:** zrzut `05-desktop-dashboard-default.png` — 1280×800 z jedną kartą: nagłówek, e-mail i zdanie „Use the navigation above…". Zero danych. W momencie zrzutu na koncie czekało **12 niezapisanych draftów i karty gotowe do powtórki** — dashboard nie wspomniał o żadnej z tych rzeczy. `[PRODUCT]`

Aplikacja te dane ma: `library.astro` liczy karty (`count: "exact"`), `review.astro` odpytuje o due, `generate.astro` o drafty.

**Kryterium akceptacji:** użytkownik wchodzi z dashboardu w sesję powtórek bez korzystania z górnej nawigacji.

### 3. Sesja powtórek rozjeżdża się w poziomie na telefonie

**Gdzie:** `/review` przy 390 px.

**Dowód — zmierzony:**

| Trasa                                                                   | viewport | scrollWidth | przepełnia |
| ----------------------------------------------------------------------- | -------- | ----------- | ---------- |
| `/`, `/auth/signin`, `/dashboard`, `/generate`, `/library`, `/settings` | 390      | 390         | nie        |
| **`/review`**                                                           | **390**  | **1148**    | **TAK**    |

Sprawca: `<p class="mt-1 text-lg font-medium text-white">` (front karty) — `scrollWidth 1082` przy `clientWidth 258`. Pomiar powtórzony po usunięciu Astro Dev Toolbar: wynik identyczny. Ta sama karta w `/library` **nie** przepełnia layoutu, bo `CardRow` używa `break-words`, a `ReviewSession` nie. `[PRODUCT]` — repo zna rozwiązanie i stosuje je niekonsekwentnie.

**Uczciwie o częstotliwości:** wyzwolone kartą z nieprzerwanym 120-znakowym ciągiem. Że użytkownicy trafią w to URL-ami czy identyfikatorami z kodu — `[ASSUMPTION]`. Sam defekt jest faktem.

**Kryterium akceptacji:** `/review` przy 390 px nigdy nie przekracza szerokości okna, niezależnie od treści karty.

### 4. Na telefonie 18% ekranu zajmuje adres e-mail i zawinięta lista linków

**Gdzie:** globalna powłoka, każdy ekran.

**Dowód:** zrzut `22-narrow-dashboard-default.png` — pasek zajmuje ~150 z 844 px. E-mail jest wizualnie najważniejszym elementem nagłówka i łamie się na dwie linie; nawigacja zawija się na dwa rzędy (pole nawigacji 324×68). Brak menu mobilnego. Kontekst z Phase 1: 12 breakpointów w całym `src/`, z czego 6 w starterowym landingu. `[HEURISTIC]`

**Kryterium akceptacji:** przy 390 px powłoka zajmuje jeden rząd, a pięć miejsc docelowych jest osiągalnych bez przewijania nagłówka.

### 5. Główny przycisk na `/generate` jest martwy poniżej 200 znaków i nie mówi dlaczego

**Dowód:** `disabled={submitting || tooShort}`. Licznik pokazuje `9 / 8000` — **maksimum, nigdy minimum**. Placeholder z „(200–8000 characters)" znika po rozpoczęciu pisania. Spacer wywrócił się z komunikatem `locator resolved to <button disabled ...>`. Komunikat, który kod ma — _„Please paste at least 200 characters of source text."_ — jest **nieosiągalny**, bo przycisku nie da się kliknąć w stanie, który go wyzwala. `[RESEARCH]` — HAI wytyczna 7.

**Kryterium akceptacji:** poniżej minimum użytkownik widzi, ilu znaków brakuje.

### 6. „Restart" obiecuje cofnięcie, którego nie wykonuje

**Dowód:** komentarz w `ReviewSession.tsx`: _„Pure client-state reset: ratings already POSTed stay persisted, so the schedule is untouched (no refetch)"_. Na ekranie „Restart" i „Restart session". Pomyłka klawiszem — `1` i `2` sąsiadują — zmienia harmonogram karty bez drogi powrotnej. `[HEURISTIC]` — Nielsen 3.

**Kryterium akceptacji:** albo etykieta przestaje obiecywać reset, którego nie robi, albo ostatnia ocena da się cofnąć w obrębie sesji.

### 7. Nieodwracalny krok opisany jest przyciskiem, który nie istnieje

**Dowód:** dialog „Discard all" mówi `You'll still need to "Save to deck" to apply.`, a przycisk nazywa się **„Save changes"**. Osobno: „Save changes" to słaba nazwa dla operacji zapisującej N kart i **trwale kasującej** M. `[PRODUCT]` — sprzeczność w jednym pliku.

### 8. Dwa języki wizualne zderzają się, a baner read-only jest widocznym szwem

**Dowód:** zrzut `27-desktop-dashboard-readonly-banner.png` — kremowa jasna wstęga (`#fef3c7` / `#78350f`, jedyne scoped `<style>` w produkcie) przez ciemną aplikację. Do tego pomiar z Phase 1: 247 zahardkodowanych klas wobec 4 tokenowych, a `<Button>` renderuje `bg-primary` (niemal czarny) w ciemnym interfejsie. `[PRODUCT]` — sekcja manualna `.uxproof/conventions.md`.

Zgodnie z regułą kontraktu podniesione **raz**, nie 247 razy. Legacy startera jest oznaczone jako _do not extend_, nie jako zaległy stos usterek. Nie przesądza niczego w kwestii jasny/ciemny/przełącznik.

### 9. Zatwierdzenie partii draftów leży pod 2196 pikselami przewijania

**Dowód:** zmierzona wysokość strony 2196 px przy oknie 800 px. „Save changes" renderuje się po ostatnim drafcie; podsumowanie decyzji jest na górze, ~1400 px od przycisku. Formularz generowania jest **pod** listą draftów. `[HEURISTIC]`

### 10. Drzwi wejściowe produktu wciąż sprzedają starter

**Dowód:** log spaceru, linia pierwsza: `{"title":"10x Astro Starter","h1":"10x Astro Starter"}`. Trzy karty funkcji mówią o uwierzytelnianiu, narzędziach i DX; copy wymienia Astro 5, gdy repo stoi na Astro 6. `[PRODUCT]` Zasięg wąski (ruch niezalogowany), stąd ostatnia pozycja mimo oczywistości.

---

## 📋 Strukturalne kontra wizualne

| Rodzaj                                              | Findings         | Blokuje je decyzja o motywie?                                     |
| --------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| **Strukturalne** — co produkt robi i czego nie mówi | 1, 2, 5, 6, 7, 9 | **Nie.** Zachowanie, treść, układ.                                |
| **Defekty układu** — realna awaria, nie estetyka    | 3, 4             | **Nie.** 3 to poprawka błędu; 4 to struktura powłoki, nie paleta. |
| **System wizualny** — jedno pęknięcie, nie lista    | 8                | **Tak.** Wymaga decyzji jasny/ciemny/przełącznik.                 |
| **Pozycjonowanie i treść**                          | 10               | Nie, choć skorzysta na wspólnej tożsamości.                       |

**Dziewięć z dziesięciu findingów da się naprawić bez decydowania o kierunku wizualnym.** To najważniejszy wniosek operacyjny Phase 2.

---

## 📋 Rekomendowany pierwszy obszar: pętla przechwytywania AI

**Zakres: `/generate` od wklejenia do zapisu w talii** — findings 1, 5, 7, 9.

- To **north star produktu** — roadmapa nazywa S-02 „validation milestone PRD Primary Success Criterion".
- To **jedno zadanie od początku do końca**: wklejam → dostaję kandydatów → decyduję i poprawiam → mam karty w talii.
- Mieści **najpoważniejszą lukę kontroli** (finding 1) razem z trzema tańszymi poprawkami na tej samej powierzchni.
- **Nie wymaga decyzji o motywie.**
- Dotyka **dwóch istniejących plików** (`PasteAndGenerateForm.tsx`, `DraftReviewList.tsx`); logika API i schemat zostają nietknięte.

Dlaczego nie powłoka (4 + 8), mimo największego zasięgu: jest zablokowana otwartą decyzją wizualną. Dlaczego nie dashboard (2), mimo niskiego kosztu: to inne zadanie („co teraz?") — doskonały **drugi** cel.

**Osobno i natychmiast, poza ścieżką redesignu:** finding 3 to błąd łamania tekstu; poprawka mieści się w jednej klasie CSS i nie powinna czekać.

---

## 📋 Prostszy przepływ — zachowanie i treść, nie wygląd

**Stan wyjściowy `/generate`.** Licznik pokazuje odległość do progu, nie do sufitu: `Jeszcze 191 znaków do minimum` zamiast `9 / 8000`; po przekroczeniu progu przełącza się na `686 / 8000`. Dopóki tekst jest za krótki, obok przycisku stoi powód.

**Stan generowania.** Zostaje bez zmian: `Generating… 4s` z tykającym licznikiem.

**Stan triażu.** Nagłówek `Przejrzyj 12 kandydatów`, pod nim `Do zapisania: 12 · Do odrzucenia: 0`. Każdy kandydat ma trzy kontrolki zamiast jednej: `Zachowaj` / `Odrzuć` / **`Popraw`**. `Popraw` otwiera edycję w miejscu — tę, która działa w bibliotece. Podsumowanie i przycisk zatwierdzający pozostają dostępne w trakcie przeglądania partii. Przycisk nazywa konsekwencję: `Zapisz 12 do talii i odrzuć 0`. Dialog potwierdzenia mówi o kontrolce istniejącej na ekranie.

**Domyślna decyzja to świadome pytanie.** Dziś wszystko startuje jako `Zachowaj`; czy tak ma zostać, to decyzja o tym, którą pomyłkę produkt woli.

**Czego ten przepływ nie robi:** nie dodaje czatu, regeneracji pojedynczej karty, oceniania jakości kandydatów; nie zmienia modelu ani promptu.

---

## 🧪 Następny test

**Najbardziej ryzykowne przekonanie:** że brak edycji w triażu realnie kosztuje użytkownika. Cały ranking opiera się na tym założeniu i **nie ma na nie danych** — produkt nie ma analityki ani realnych użytkowników.

**Najtańszy test:** jedno prawdziwe przechwycenie od początku do końca na własnym materiale — wklejenie, triaż, zapis, sesja powtórek następnego dnia. Liczymy: ile kart chciało się poprawić w triażu i ile w sesji okazało się słabych na tyle, że przeszkadzały.

**Co oznacza wynik:** trzy lub więcej poprawek z dwunastu → finding 1 zostaje pierwszy, pętla przechwytywania jest właściwym celem. Zero poprawek i brak zgrzytów w sesji → ranking się zmienia, pierwszym celem powinien być dashboard.

---

## ⚠️ Czego nie sprawdzono

- **Przejście dark/light nie zostało wykonane.** Aplikacja nie ma przełącznika motywu, a motywy sterowane klasą ignorują emulację ustawień systemowych — raportowane jako nieprzeprowadzone, nie pominięte. Wartości w `tokens.json` niosą blok `.dark`, którego runtime nie renderuje.
- **Potwierdzenie e-mail (`/auth/confirm-email`) i pełna rejestracja** — wymagałyby prawdziwego tokenu i konta poza efemerycznym użytkownikiem QA.
- **Brak danych o użytkownikach.** Każde twierdzenie o częstotliwości jest założeniem i jest tak oznaczone. Trzy z dziesięciu findingów opierają się głównie na heurystykach.
- **Astro Dev Toolbar był obecny** (tryb dev), wykluczony ze wszystkich pomiarów; nagłówek „Featured integrations" w DOM `/generate` pochodzi z toolbara, nie z produktu.
- **Wyzwalacz długiej treści był syntetyczny** (nieprzerwany ciąg 120 znaków).
- **Dostępność sprawdzona strukturalnie** — etykiety, `aria-pressed`, `aria-current`, `aria-keyshortcuts`. Bez czytnika ekranu i pomiaru kontrastu.
- **Pierwsza wersja spaceru dała fałszywe wyniki** (locator `/password/i` trafiał też w przycisk „Show password", więc zrzuty „zalogowane" były ekranem logowania). Tamte artefakty odrzucono w całości.
- **Poza zakresem:** wydajność, Sentry, pakiet `packages/code-reviewer`.

---

## 📋 Co zostało sprawdzone

Bramka zasadności AI: uruchomiona — generacja kart z dowolnej prozy to realne zastosowanie generowania; poziom „AI proponuje, człowiek decyduje" właściwy dla stawki, ale kontrola po stronie człowieka niepełna (finding 1). Lista kontrolna człowiek-AI: przejrzana, uchybienia przy wytycznych 1, 2, 9. Pytanie o preferowaną pomyłkę: nierozstrzygnięte przez produkt. Miary wartości: skuteczność zadania i korekta. Kontrakt projektowy: wczytany — 67 tokenów, 15 komponentów, 0 archetypów, sekcja manualna uszanowana. Rubryka jakości: zaliczona.
