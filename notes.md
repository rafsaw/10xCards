## 1

npx @przeprogramowani/10x-cli@latest auth
zapisuje do C:\Users\rafal\AppData\Roaming\10x-cli\auth.json

## 2 - tego bedziesz uzywac do kazdej lekcji ze zmienna mXlY

npx @przeprogramowani/10x-cli@latest get m1l1 
to tu sie wybiera CLI (claude or cursor or codex) i to idzie do  
C:\Users\rafal\AppData\Roaming\10x-cli\config.json
i potem projekt uzywaja tego jako wybrany CLI !!!!

```json
{
  "tool": "claude-code"
}
```

CLI pobiera skille z serwera i zapisuje je w twoim projekcie. Dla Claude Code lądują w .claude/skills/, dla Cursora w .cursor/skills/, dla Copilota w .github/skills/.

Komenda: npx @przeprogramowani/10x-cli@latest doctor albo 10x doctor
sprawdza te wszystkie konfiguracje uzyj zeby pomoc ci rozwiazac problemy

## 3

CLI dostarcza też [helper skille](https://github.com/przeprogramowani/10x-cli/tree/master/skills), które uczą twojego agenta, jak pracować z tym narzędziem. Na starcie najważniejszy jest **10x-cli-setup**, skill, który przeprowadzi cię (a właściwie twojego agenta) przez instalację, autentykację i konfigurację CLI pod wybrane narzędzie AI. Jeśli coś nie zadziała przy **auth** albo **get**, agent z tym skillem potrafi zdiagnozować problem i poprowadzić cię do rozwiązania.

Zainstaluj go przez **npx skills**:

```bash
npx skills add przeprogramowani/10x-cli

```

Jeśli chcesz, żeby helper skille były dostępne we wszystkich twoich projektach, dodaj flagę **g**:

```bash
npx skills add przeprogramowani/10x-cli -g

```

Globalnie zainstalowane sa zapisane w C:\Users\rafalagents\ wiec nie pokaze folder 
.agents\skills\10x-cli-guide 
.agents\skills\10x-cli-setup 
w projekcie bo odwoluje sie do global location
Jak uruchomie command: npx skills add przeprogramowani/10x-cli bez " -g" to wtedy zapisze te skills dla tego projektu.    

Jak sie odpali npx skills add przeprogramowani/10x-cli -g albo w czasie instalacji wybierze global to potem claude nie widzi tych komend pomocniczych /10x-..... jak /10x-cli-setup 

Jak masz problemy sprawdz: C:\Users\rafal\AppData\Roaming\10x-cli\config.json albo Komenda: npx @przeprogramowani/10x-cli@latest doctor

  
m1l2

/10x-tech-stack-selector @context/foundation/[prd.md](http://prd.md)  
