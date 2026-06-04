# M3L2 Notes – Risk-Driven Testing (Cross User Isolation)

## Cel ćwiczenia

W tej lekcji celem nie było po prostu napisanie większej liczby testów.

Celem było nauczenie się procesu:

```text
Ryzyko biznesowe
    ↓
Research
    ↓
Plan
    ↓
Implementacja testów
    ↓
Udokumentowanie wzorca
```

Najważniejsza lekcja:

> Nie zaczynaj od pliku ani funkcji. Zacznij od ryzyka, które może zaszkodzić użytkownikowi lub biznesowi.

---

# Krok 1 – Wybór ryzyka

Z test-plan.md wybraliśmy jedno z najważniejszych niepokrytych ryzyk:

## R2 – Cross User Isolation

Scenariusz:

```text
User A posiada swoje fiszki.
User B nie powinien móc:
- odczytać danych User A
- zmienić danych User A
- usunąć danych User A
```

To jest klasyczny problem bezpieczeństwa typu:

```text
IDOR
(Insecure Direct Object Reference)
```

Przykład:

```text
User B zna ID karty User A
i próbuje ją zmodyfikować.
```

---

# Krok 2 – Research

Zamiast od razu pisać testy wykonaliśmy research.

Pytanie:

```text
Co naprawdę chroni użytkowników?
```

Początkowo można było założyć:

```text
.eq("user_id")
```

w endpointach.

Po analizie okazało się jednak, że prawdziwa odpowiedź brzmi:

```text
RLS (Row Level Security)
```

w Supabase.

Najważniejsze odkrycia:

* aplikacja używa tylko anon client
* nie istnieje service_role client
* wszystkie polityki RLS bazują na auth.uid()
* to właśnie RLS jest ostatnią linią obrony

Wniosek:

```text
Nie testujemy endpointów.
Testujemy skuteczność izolacji użytkowników.
```

---

# Krok 3 – Wybranie właściwego rodzaju testu

Nie każde ryzyko wymaga tego samego typu testu.

Odkryliśmy:

## R2 wymaga prawdziwej bazy

Dlaczego?

Ponieważ chcieliśmy przetestować:

```text
auth.uid()
RLS
```

Tego nie da się wiarygodnie zamockować.

Powstał więc osobny zestaw testów:

```bash
npm run test:integration
```

który:

* używa prawdziwej bazy Supabase
* tworzy dwóch użytkowników testowych
* korzysta z prawdziwych tokenów JWT
* uruchamia prawdziwe polityki RLS

---

# Krok 4 – Zbudowanie harnessu testowego

Powstał tzw. test harness.

Co robi?

```text
Tworzy User A
Tworzy User B

Tworzy dane User A
Tworzy dane User B

Pozwala wykonywać akcje jako:
- User A
- User B
```

Dzięki temu możemy testować prawdziwe scenariusze bezpieczeństwa.

---

# Krok 5 – Testy R2 (Cross User Isolation)

Przetestowaliśmy:

## reviews.ts

Scenariusz:

```text
User B próbuje wykonać review
na karcie należącej do User A
```

Sprawdzamy:

```text
operacja zostaje odrzucona
dane User A nie zmieniają się
```

Najważniejsza asercja:

```text
owner row unchanged
```

Nie interesuje nas tylko kod HTTP.

Interesuje nas:

```text
czy dane User A są nadal takie same
```

---

## cards PATCH

Scenariusz:

```text
User B próbuje edytować kartę User A
```

Sprawdzamy:

```text
brak zmian
```

---

## cards DELETE

Scenariusz:

```text
User B próbuje usunąć kartę User A
```

Sprawdzamy:

```text
karta nadal istnieje
```

---

# Krok 6 – R4 Retention Write Lock

Drugie ryzyko:

## Konto oznaczone jako read-only

Scenariusz:

```text
użytkownik jest zablokowany
```

Powinien mieć możliwość:

```text
czytać dane
```

ale nie powinien móc:

```text
zapisywać danych
```

Przetestowaliśmy wszystkie 7 endpointów zapisujących dane.

Dla każdego:

```text
isReadOnly = true
```

oczekiwaliśmy:

```text
403 account_read_only
```

oraz:

```text
brak próby zapisu do bazy
```

Dodatkowo sprawdziliśmy wyjątki:

```text
account/cancel
account/delete
```

które zgodnie z projektem mają pozostać dostępne.

---

# Krok 7 – R5 Validation Parity

Trzecie ryzyko:

## Nie ufamy danym przesłanym przez klienta

Przykład ataku:

```json
{
  "user_id": "admin",
  "status": "approved"
}
```

Serwer nigdy nie powinien ufać takim polom.

Przetestowaliśmy:

## cards.ts

Serwer zawsze używa:

```text
locals.user.id
status = saved
```

niezależnie od tego co przesłał klient.

---

## reviews.ts

Sprawdziliśmy, że klient nie może:

```text
podmienić ownera
podmienić statusu
```

przez manipulację requestem.

---

# Krok 8 – Architectural Guardrail

Powstał dodatkowy test:

```text
no-service-role-in-src.test.ts
```

Cel:

```text
wykryć pojawienie się service_role client
```

Dlaczego to ważne?

Jeżeli ktoś doda:

```text
service_role
```

to:

```text
RLS przestaje chronić dane
```

Taki jeden błąd mógłby unieważnić wszystkie gwarancje bezpieczeństwa.

Test skanuje katalog:

```text
src/
```

i failuje jeśli znajdzie:

```text
service_role
SERVICE_ROLE
```

---

# Krok 9 – Dokumentacja wzorca

Na końcu zaktualizowaliśmy:

```text
context/foundation/test-plan.md
```

Dodając:

## Kiedy używać testów hermetycznych

```text
npm test
```

dla logiki aplikacji.

## Kiedy używać testów integracyjnych

```text
npm run test:integration
```

dla:

```text
RLS
auth.uid()
prawdziwej bazy
```

oraz pełny przepis budowy testów izolacji użytkowników.

---

# Najważniejsze lekcje

## 1. Testuj ryzyko, nie plik

Źle:

```text
Przetestuj reviews.ts
```

Dobrze:

```text
User B nie może zmienić danych User A
```

---

## 2. Najtańszy test nie zawsze jest najlepszy

Mock Supabase byłby tańszy.

Ale nie testowałby:

```text
RLS
auth.uid()
```

więc dawałby fałszywe poczucie bezpieczeństwa.

---

## 3. Szukaj prawdziwego oracle

Najważniejsze odkrycie:

```text
Oracle R2 = RLS
```

Nie:

```text
.eq(user_id)
```

---

## 4. Nie wszystkie testy muszą być integracyjne

Finalny podział:

```text
R2 -> real DB integration

R4 -> hermetic tests

R5 -> hermetic tests

Guardrail -> static test
```

Każde ryzyko dostało najtańszy test,
który nadal daje wiarygodny sygnał.

---

# Efekt końcowy

Powstał kompletny zestaw testów chroniących:

* izolację danych użytkowników
* blokadę zapisów dla kont read-only
* ochronę przed fałszowaniem pól ownership/status
* architektoniczne założenie braku service_role

## Co zostaje na przyszłość

Po tym ćwiczeniu mamy nie tylko nowe testy, ale również sprawdzony sposób pracy z ryzykami w projekcie.

Przy każdej nowej funkcjonalności lub zmianie warto przejść przez ten sam proces:

### 1. Zacznij od ryzyka biznesowego

Nie:

```text
Przetestuj endpoint X
```

Tylko:

```text
Jakie ryzyko chcemy wykryć lub przed czym chcemy się zabezpieczyć?
```

Przykład:

```text
User B nie może zmienić danych User A
```

### 2. Zrób research

Znajdź prawdziwy mechanizm ochrony.

Zadaj sobie pytanie:

```text
Co naprawdę chroni system?
```

W naszym przypadku odpowiedzią było:

```text
RLS (Row Level Security)
```

a nie filtry w kodzie endpointów.

### 3. Znajdź oracle

Oracle to obserwowalne zachowanie, które udowadnia, że system działa poprawnie.

Przykład:

Dobre oracle:

```text
Dane User A nie zostały zmienione
```

Słabe oracle:

```text
Endpoint zwrócił 404
```

Status HTTP może się zmienić. Niezmienione dane użytkownika są prawdziwym celem biznesowym.

### 4. Wybierz najtańszy wiarygodny test

Nie każdy problem wymaga integracji z bazą.

Przykłady z projektu:

```text
R2 Cross User Isolation
→ Real DB Integration Test

R4 Retention Lock
→ Hermetic Test

R5 Validation Parity
→ Hermetic Test

Architectural Guardrail
→ Static Test
```

Najtańszy test nie zawsze jest najlepszy. Ważne jest znalezienie najtańszego testu, który nadal daje wiarygodny sygnał.

### 5. Dopiero wtedy pisz testy

Najpierw:

```text
Ryzyko
→ Research
→ Oracle
→ Typ testu
```

Dopiero na końcu:

```text
Implementacja testów
```

## Najważniejsza lekcja z M3L2

Nie testujemy plików ani funkcji.

Testujemy ryzyka biznesowe i mechanizmy ochrony, które mają zapobiegać problemom w produkcji.

