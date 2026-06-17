Tak — to jest ważne, bo wcześniej skupiliśmy się tylko na setupie CLI, a **prawdziwy workflow kursowy to init → shape → prd**.

Zróbmy finalną wersję tak, żebyś za 2 tygodnie nie musiał tego odtwarzać 😄

# 10xDevs workflow — nowy projekt (final version)

## 1. Przejdź do katalogu bazowego

```powershell
cd C:\Users\rafal\repos\10xDevs3
```

---

## 2. Utwórz nowy folder projektu

Przykład:

### Codex

```powershell
mkdir m1l1-auth-codex
```

### Claude

```powershell
mkdir m1l1-auth-claude
```

### Cursor

```powershell
mkdir m1l1-auth-cursor
```

---

## 3. Wejdź do folderu

Przykład:

```powershell
cd .\m1l1-auth-codex
```

---

## 4. Pobierz lesson artifacts

### Codex

```powershell
10x get m1l1 --tool codex
```

### Claude

```powershell
10x get m1l1 --tool claude-code
```

### Cursor

```powershell
10x get m1l1 --tool cursor
```

### Gemini

```powershell
10x get m1l1 --tool gemini
```

---

## 5. Sprawdź setup

```powershell
10x doctor
```

Powinno być same zielone checki.

---

## 6. Przygotuj swój input (pomysł)

Stwórz plik np.:

```powershell
initial-notes.md
```

wrzuć tam swój messy pomysł na appkę:

Przykład:

```markdown
I want to build an app that helps users track habits.

Not sure yet if it should be mobile or web.

Core idea:
- daily tracking
- reminders
- streaks
- maybe AI suggestions later

Target users:
people trying to build routines
```

To jest input dla `/10x-shape`.

---

## 7. Uruchom agenta

### Codex

```powershell
codex
```

### Claude

```powershell
claude
```

### Cursor

```powershell
cursor-agent
```

---

# 8. INIT PROJECT

To tworzy:

```text
/context
```

---

### Claude / Cursor

```text
/10x-init
```

---

### Codex

Codex nie wspiera slash commands.

Wpisz:

```text
Read AGENTS.md and execute the 10x-init workflow.
Initialize this project.
```

---

# 9. SHAPE (najważniejszy etap)

Tu przekazujesz swój pomysł.

To generuje:

```text
context/foundation/shape-notes.md
```

---

### Claude / Cursor

jeśli masz plik:

```text
initial-notes.md
```

to:

```text
/10x-shape use initial-notes.md as input
```

albo:

```text
/10x-shape @initial-notes.md
```

---

### Codex

```text
Read the 10x-shape workflow instructions.
Use initial-notes.md as input.
Run the planning/session workflow and produce shape-notes.md.
```

---

## Greenfield flow

Jeśli to nowy projekt:

agent powinien:

* doprecyzować pomysł
* pytać o usera
* problem
* MVP
* first workflow
* business logic
* non-goals
* success criteria

Ty odpowiadasz.

Efekt:

```text
context/foundation/shape-notes.md
```

---

## Brownfield flow

Jeśli istniejący projekt:

powiedz agentowi, że to existing project.

Shape przełączy się na:

* current pain points
* minimal valuable change
* compatibility constraints

---

# 10. PRD

To generuje:

```text
context/foundation/prd.md
```

---

### Claude / Cursor

```text
/10x-prd
```

---

### Codex

```text
Read the 10x-prd workflow instructions.
Generate PRD from context/foundation/shape-notes.md
```

---

# 11. Verify output

Powinieneś mieć:

```text
context/
  foundation/
    shape-notes.md
    prd.md
```

---

# Final expected artifacts

### shape-notes.md

z sesji planningowej

### prd.md

powinno zawierać:

✅ user
✅ problem
✅ first workflow
✅ business logic
✅ MVP scope
✅ explicit non-goals
✅ success criteria

---

# Example full Codex flow

```powershell
cd C:\Users\rafal\repos\10xDevs3

mkdir m1l1-auth-codex

cd .\m1l1-auth-codex

10x get m1l1 --tool codex

10x doctor

notepad initial-notes.md

codex
```

Then:

### INIT

```text
Read AGENTS.md and execute the 10x-init workflow.
```

### SHAPE

```text
Read the 10x-shape workflow.
Use initial-notes.md as input.
Run the planning workflow.
```

### PRD

```text
Generate PRD from shape-notes.md using 10x-prd instructions.
```

---

To jest **pełny kursowy workflow**, nie tylko CLI setup 👍
