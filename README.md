# O.A.C. — Observação de Atos e Condições · Serena Energia

App web (PWA) para registro de OAC em campo, com sincronização em uma **planilha do Excel** via
**Power Automate**. Funciona offline: a observação é salva no aparelho e sobe quando há internet.

---

## 1. Arquitetura (como a conexão acontece)

O HTML **não fala direto com o Excel**. Não é possível: um arquivo estático não tem como autenticar
no Microsoft 365 com segurança. Quem faz a ponte é o Power Automate.

```
┌──────────────────┐   POST (text/plain)    ┌────────────────────────┐  conector    ┌──────────────────────┐
│  index.html      │ ─────────────────────► │ Flow "Receber          │ ───────────► │ OAC_Observacoes.xlsx │
│  (celular/PC)    │                        │ Observacao"            │ Excel Online │                      │
│                  │ ◄───────────────────── │ (gatilho HTTP)         │              │  aba: Observacoes    │
│  localStorage    │   {"ok": true}         └────────────────────────┘              │  Tabela: Observacoes │
│  (offline)       │                                                                │                      │
│                  │   POST (text/plain)    ┌────────────────────────┐              │  OneDrive ou         │
│  Painel Geral    │ ─────────────────────► │ Flow "Listar           │ ───────────► │  SharePoint/Teams    │
│  (PIN)           │ ◄───────────────────── │ Observacoes"           │ ◄─────────── │                      │
└──────────────────┘   [ "{json}", ... ]    └────────────────────────┘              └──────────────────────┘
```

- **Fluxo de gravação** — recebe o JSON e adiciona uma linha na Tabela.
- **Fluxo de leitura** — devolve todas as observações para o Painel Geral.
- **A autenticação real fica dentro do Flow**, na conexão de quem o criou. O HTML só conhece a URL
  assinada do gatilho.

