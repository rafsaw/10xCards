# Raport: strategie redesignu — Phase 3

- **Data:** 2026-08-21
- **Repo:** 10xCards
- **Branch bazowy:** `main` (czysty, `dfaace0`)
- **Typ:** decyzja strategiczna — bez implementacji, bez speca, bez PR-a, `src/` nietknięte
- **Wejścia:** `.ai/analysis/2026-08-21-ui-ux-discovery-phase1.md`, `.ai/analysis/2026-08-21-ui-ux-review-phase2.md`, `.uxproof/`
- **Zakres świadomie pominięty:** estetyka, decyzja jasny/ciemny/przełącznik, szczegóły implementacyjne

---

## Punkt wyjścia

Phase 2 zakończyła się werdyktem **simplify** i dziesięcioma findingami uszeregowanymi przez wpływ × częstotliwość × zasięg. Kluczowa obserwacja operacyjna: **dziewięć z dziesięciu findingów da się naprawić bez decydowania o kierunku wizualnym**.

Phase 2 wskazała pętlę przechwytywania AI jako rekomendowany pierwszy obszar. Phase 3 traktuje tę wskazówkę jako **najlepszy dotychczasowy zakład, a nie kierunek wybrany z góry** — ponieważ finding #1 zawiera jawne założenie („brak edycji draftów realnie kosztuje użytkownika"), dla którego nie ma danych użytkowników.

---

## Trzy strategie

Każda zaczyna od **innego problemu**, opiera się na **innym rodzaju dowodu** i ma **inną zależność od decyzji wizualnej**. To nie są warianty tego samego układu — wybór między nimi jest wyborem tezy o tym, co jest dziś wąskim gardłem produktu.

|                                | **A — Naprawić bramkę**                                           | **B — Odpowiedzieć „co teraz?"**                  | **C — Jeden produkt, jedna powierzchnia**             |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Pierwszy problem               | Obietnica „AI proponuje, człowiek decyduje" nie jest egzekwowalna | Produkt nigdy nie mówi, w jakim stanie jest nauka | Produkt czyta się jak starter z doklejonymi funkcjami |
| Findings                       | 1, 5, 7, 9                                                        | 2, pośrednio 9 i 10                               | 4, 8, 10, ubocznie 3                                  |
| Siła dowodu                    | **Słaba w kluczowym punkcie** — #1 to założenie                   | **Mocna** — nie wymaga żadnego założenia          | Mocna co do faktów, słaba co do pilności              |
| Zależność od decyzji wizualnej | Brak                                                              | Brak                                              | **Całkowita**                                         |
| Koszt                          | Średni                                                            | Niski                                             | Wysoki                                                |
| Zasięg naprawy                 | Ścieżka AI                                                        | Każda sesja, każdy użytkownik                     | Każdy ekran                                           |
| Czego uczy o użytkownikach     | Najwięcej                                                         | Umiarkowanie, ale ciągle                          | Prawie nic                                            |
| Największe ryzyko              | Zbudujemy kontrolę, której nikt nie użyje                         | Poprawi samopoczucie, nie rdzeń                   | Zablokowana decyzją, którą odłożono                   |

---

### Strategia A — Naprawić bramkę (Generate → Draft Review → Save)

**Pierwszy problem.** Produkt obiecuje, że AI tylko proponuje, a decyduje człowiek — na tej obietnicy stoi roadmapa (S-01, S-02 „gated generation"). Dziś obietnicy nie da się dotrzymać: wszystkie drafty startują jako `accept`, edycji nie ma, a przycisk zatwierdzający leży pod dwunastoma kartami. Najtańsza ścieżka prowadzi do zapisania partii, której nikt nie przeczytał.

**Findings:** 1, 5, 7, 9.

**Najmniejszy spójny zakres.** Jedno zadanie od wklejenia do talii: informacja o odległości do minimum zamiast licznika do sufitu; edycja w miejscu na liście kandydatów, oparta na wzorcu z `CardRow`; podsumowanie decyzji i kontrolka zatwierdzająca dostępne w trakcie przeglądania partii; nazwa przycisku mówiąca, co się stanie. Powierzchnia: `PasteAndGenerateForm.tsx`, `DraftReviewList.tsx`, przyjęcie poprawionej treści w `/api/generations/save`.

**Czego świadomie nie robi.** Bez czatu, bez regeneracji pojedynczej karty, bez oceniania jakości kandydatów, bez zmian modelu, promptu i schematu. Nie dotyka dashboardu, powłoki ani palety.

**Ryzyko i koszt.** Koszt średni. Dwa realne ryzyka: (1) **kluczowe założenie jest niezweryfikowane** — jeśli nikt nie chce poprawiać kart, powstanie kontrola bez użytkowników; (2) to **jedyna strategia dotykająca kontraktu z gwarancją** — atomowość accept/reject z S-02 jest pokryta testami integracyjnymi i była walidacyjnym kamieniem milowym PRD.

**Zależność wizualna:** żadna.

**Czego nauczymy się po pierwszym przyroście.** Najwięcej z trzech: ile kart człowiek faktycznie poprawia. Ta liczba przesądza, czy 10xCards jest produktem, w którym AI się recenzuje, czy takim, w którym AI się akceptuje.

**Trade-off.** Najwyższa wartość informacyjna na jednostkę pracy — kupiona za oparcie się na najsłabiej udowodnionym przekonaniu i dotknięcie najwrażliwszego kontraktu.

---

### Strategia B — Odpowiedzieć „co teraz?" (Dashboard / orientacja)

**Pierwszy problem.** Produkt w żadnym momencie nie mówi użytkownikowi, w jakim stanie jest jego nauka. Ekran po każdym logowaniu pokazuje własny adres e-mail i zdanie „użyj nawigacji powyżej". W chwili zrzutu z Phase 2 na koncie czekało dwanaście niezapisanych draftów i karty gotowe do powtórki — dashboard nie wspomniał o żadnej z nich. Aplikacja te dane już liczy, tylko na innych stronach.

**Findings:** 2 bezpośrednio; pośrednio łagodzi 9 (zalegające drafty przestają być niewidoczne) i daje 10 miejsce na to, czym produkt jest.

**Najmniejszy spójny zakres.** `/dashboard` przestaje być kartą powitalną, a staje się stanem i następnym krokiem: ile kart czeka na powtórkę i wejście prosto w sesję; czy wiszą nieprzejrzane kandydatury i wejście prosto w triaż; jak duża jest biblioteka. Trzy zapytania zliczające, wzorzec z `library.astro`. Jeden plik strony.

**Czego świadomie nie robi.** Żadnych wykresów, serii, statystyk nauki ani grywalizacji. Nie zmienia przepływów, w które linkuje. Nie dotyka powłoki, palety ani ścieżki AI.

**Ryzyko i koszt.** Koszt najniższy, zmiana w pełni odwracalna. Ryzyko innego rodzaju niż przy A: **daje najwięcej satysfakcji przy najmniejszej zmianie istoty** — produkt zacznie sprawiać wrażenie skończonego, podczas gdy bramka jakości AI nadal będzie domyślnie otwarta. Drugie ryzyko to pełzanie zakresu; dashboard jest ekranem, na którym najłatwiej dokleić wykres.

**Zależność wizualna:** żadna dla danych. Zastrzeżenie: dashboard jest ekranem najbardziej kuszącym do projektowania wizualnego i zrobiony przed decyzją o motywie zostanie później przestylowany — to praca kosmetyczna do powtórzenia, nie zmarnowana logika.

**Czego nauczymy się po pierwszym przyroście.** Czy orientacja była prawdziwą blokadą — widać po tym, czy sesje zaczynają się z dashboardu zamiast z nawigacji. Dodatkowo: **czy drafty w ogóle zalegają** — tani instrument pomiarowy dla otwartego założenia strategii A.

**Trade-off.** Jedyna strategia, której problem nie wymaga żadnego założenia. Pewność i niski koszt kupione za nietknięcie rdzenia produktu.

---

### Strategia C — Jeden produkt, jedna powierzchnia (powłoka i spójność)

**Czy dowody uzasadniają ją jako osobną alternatywę: tak.** Findings 4, 8 i 10 nie są obsługiwane ani przez A, ani przez B, a pomiary z Phase 1 są jednoznaczne: 247 zahardkodowanych klas kolorystycznych wobec 4 tokenowych, 12 breakpointów w całym `src/` (6 w starterowym landingu), zero komponentów współdzielonych na poziomie strony.

**Pierwszy problem.** Produkt czyta się jak starter z doklejonymi funkcjami, bo nim technicznie jest: każdy ekran powtarza ręcznie ten sam przepis na kartę, nagłówek i komunikat błędu; powłoka zabiera na telefonie ~18% ekranu na adres e-mail i zawiniętą listę linków; jedyny globalny baner mówi jasną paletą przez ciemną aplikację.

**Findings:** 4, 8, 10; ubocznie 3 — wspólny komponent treści karty rozwiązuje łamanie długich słów raz, zamiast per ekran.

**Najmniejszy spójny zakres.** Wyciągnięcie powtarzanego szkieletu strony do komponentów współdzielonych (nagłówek strony, sekcja/karta, komunikat, stan pusty), przepięcie ich na tokeny, przebudowa powłoki pod wąskie ekrany, wycofanie starterowego landingu.

**Czego świadomie nie robi.** Nie zmienia przepływów, nie dodaje danych, nie dotyka AI ani harmonogramu powtórek.

**Ryzyko i koszt.** Koszt najwyższy, największy zasięg rażenia — dotyka każdego ekranu przy pokryciu E2E ograniczonym do trzech specyfikacji. Najpoważniejsze ryzyko: **strategia jest dziś zablokowana**. Nie da się ujednolicić tokenów bez rozstrzygnięcia jasny/ciemny/przełącznik, a ta decyzja została świadomie odłożona i zapisana w kontrakcie jako otwarta. Start bez niej oznacza podjęcie jej przypadkiem, w trakcie implementacji.

**Zależność wizualna: całkowita.** Jedyna z trzech, która **wymusza** decyzję o kierunku wizualnym zamiast ją omijać.

**Czego nauczymy się po pierwszym przyroście.** O użytkownikach prawie nic; o własnej prędkości sporo. To inwestycja, nie eksperyment.

**Trade-off.** Największa dźwignia długoterminowa i jedyna droga do celu „spójna i nowoczesna aplikacja". Cena: decyzja wizualna musi zapaść teraz, a pierwszy przyrost nie przyniesie informacji o użytkownikach.

---

## 🎯 Rekomendacja: **strategia B jako pierwszy przyrost**

**Decydujący argument.** Dowody dla A są słabe dokładnie w punkcie, na którym A stoi. Reguła frameworku użytego w Phase 2 jest jednoznaczna: _gdy dowody są słabe, wybierz najmniejsze odwracalne zobowiązanie_. B jest jedyną z trzech, której problem nie wymaga żadnego założenia — dashboard jest mierzalnie pusty, a dane, których nie pokazuje, są już liczone w kodzie obok.

**Drugi argument.** B jest tanim instrumentem pomiarowym dla A. Gdy zalegające kandydatury i karty do powtórki staną się widoczne przy każdym wejściu, codziennie widać, czy drafty się piętrzą i czy triaż jest realnym krokiem, czy formalnością.

### ⚠️ A nie jest automatycznie drugim krokiem

To zastrzeżenie jest częścią rekomendacji, nie przypisem. **Pozycja strategii A w kolejce zależy od wyniku realnego testu pętli przechwytywania**, nie od rankingu z Phase 2.

Test nie wymaga ani linijki kodu: jedno prawdziwe przechwycenie na własnym materiale — wklejenie, triaż, zapis, sesja powtórek następnego dnia — i policzenie, ile kart chciało się poprawić w triażu oraz ile w sesji okazało się słabych na tyle, że przeszkadzały.

- **Trzy lub więcej poprawek z dwunastu** → A staje się drugim przyrostem.
- **Zero poprawek i brak zgrzytów w sesji** → założenie findingu #1 upada, A spada w kolejce, a drugim przyrostem powinno być co innego — najpewniej C, jeśli decyzja o motywie zapadnie, albo dalsza praca nad orientacją.

Dopóki ten test nie zostanie wykonany, każde zdanie o „A jako następnym kroku" jest przewidywaniem, nie planem.

### Niezależnie od kolejności strategii

Finding 3 — przepełnienie `/review` w poziomie na telefonie — to zwykły błąd łamania tekstu, którego poprawka mieści się w jednej klasie CSS, a wzorzec jest już w `CardRow`. Nie powinien czekać na żadną ścieżkę projektową ani na PR redesignowy.

### Kiedy C

Wtedy, gdy zapadnie decyzja o kierunku wizualnym — nie wcześniej. Do tego czasu każdy ekran ruszany w A i B warto robić tak, by nie utrudniał późniejszej unifikacji: bez rozszerzania legacy startera, zgodnie z regułą _do not extend_ z `.uxproof/conventions.md`.

### Co zmieniłoby tę rekomendację

Rozstrzygnięcie motywu w najbliższym czasie odblokowuje C i czyni ją realną alternatywą dla B jako pierwszego przyrostu — ma pełny zasięg i usuwa przyczynę, a nie objaw.

---

## Decyzja

**Przyjęto strategię B** jako pierwszy przyrost (2026-08-21). Następny krok: `om-ux-shape` w trybie Handoff dla zakresu B.
