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

### Duas decisões técnicas que explicam o código

**Por que `Content-Type: text/plain`?** Com `application/json` o navegador dispara um *preflight*
`OPTIONS` antes do POST, e o endpoint do Power Automate não responde a `OPTIONS` — dá erro de CORS
("Failed to fetch"). Com `text/plain` a requisição é "simples" e vai direto. O Flow reconverte com
`json(string(triggerBody()))`.

**Por que Excel e não uma lista do SharePoint?** Praticidade: um `.xlsx` no OneDrive ou numa pasta
que você já pode escrever dispensa permissão para criar listas em um site, e o conector Excel Online
é padrão, não premium. As limitações e o caminho de migração estão em
`alternativas/lista-sharepoint/`.

---

## 2. Conteúdo da pasta

```
oac-serena/
├── index.html                            ← o app (único arquivo que o usuário abre)
├── manifest.json                         ← permite "instalar" no celular (PWA)
├── sw.js                                 ← service worker: instalação + funcionamento offline
├── icon-192.png / icon-512.png           ← ícones: símbolo oficial da Serena sobre coral
├── README.md                             ← este guia
├── instalar-no-celular.md                ← publicar em HTTPS e instalar no aparelho
├── planilha/
│   └── OAC_Observacoes.xlsx              ← banco de dados, com a Tabela já formatada
├── power-automate/
│   ├── 01-preparar-planilha.md           ← onde salvar e as regras que não podem ser quebradas
│   ├── 02-flow-receber-observacao.md     ← fluxo de gravação, expressão por expressão
│   ├── 03-flow-listar-observacoes.md     ← fluxo de leitura (Painel Geral)
│   └── schema-trigger.json               ← contrato do payload (documentação)
├── teste/
│   ├── payload-exemplo.json              ← observação de teste pronta para enviar
│   └── testar-flows.md                   ← testar sem abrir o app
└── alternativas/
    └── lista-sharepoint/                 ← caminho de migração, quando o Excel apertar
        ├── LEIA-ME.md
        ├── 01-lista-sharepoint.md
        ├── 02-flow-receber-observacao.md
        ├── 03-flow-listar-observacoes.md
        └── criar-lista-pnp.ps1
```

---

## 3. Roteiro de implantação

| # | Etapa | Onde | Tempo |
|---|-------|------|-------|
| 1 | Conferir licença e definir o dono dos fluxos | Power Platform | 5 min |
| 2 | Subir a planilha na pasta escolhida | Teams / OneDrive | 10 min |
| 3 | Criar o fluxo de gravação | Power Automate | 20 min |
| 4 | Testar o fluxo com o payload de exemplo | Terminal / Postman | 5 min |
| 5 | Criar o fluxo de leitura | Power Automate | 15 min |
| 6 | Colar as 2 URLs no `index.html` e trocar o PIN | Editor de texto | 5 min |
| 7 | Publicar o app e testar de ponta a ponta | Hospedagem | 20 min |
| 8 | Ajustes de conteúdo (empresas, locais, checklist) | `index.html` | conforme |
| 9 | Combinados de uso e governança | equipe | 15 min |

### Etapa 1 — Pré-requisitos

- **Licença Power Automate Premium** para quem criar os fluxos. O gatilho
  *"Quando uma solicitação HTTP é recebida"* é conector premium — é o **único** ponto do sistema que
  exige isso. A ação do Excel é padrão.
- **Defina o dono dos fluxos.** A conexão com o Excel é dele; se a conta for desativada, o sistema
  para. O ideal é uma **conta de serviço** (ex.: `svc-sst@...`) ou fluxos com co-proprietários.

### Etapa 2 — Planilha

Siga `power-automate/01-preparar-planilha.md`. Resumo: suba o `planilha/OAC_Observacoes.xlsx` numa
pasta de canal do Teams (preferível) ou no seu OneDrive. Não renomeie a aba, a Tabela nem as colunas.

### Etapa 3 — Fluxo de gravação

Siga `power-automate/02-flow-receber-observacao.md`. **Salve o fluxo antes de procurar a URL** — ela
só é gerada no primeiro salvamento. E não pule a política de nova tentativa exponencial.

### Etapa 4 — Testar o fluxo isolado

Antes de mexer no HTML, garanta que o fluxo funciona: `teste/testar-flows.md` traz um `curl` que
envia o `payload-exemplo.json`. Se a linha aparecer na planilha, a metade difícil está pronta.

### Etapa 5 — Fluxo de leitura

Siga `power-automate/03-flow-listar-observacoes.md`. Os dois pontos que decidem se funciona:
**paginação ativada** e o **`Filtrar matriz`** descartando linhas vazias.

### Etapa 6 — Configurar o `index.html`

Abra em qualquer editor de texto e procure por `ÚNICO BLOCO QUE VOCÊ PRECISA EDITAR`
(por volta da linha 360):

```js
const SYNC_SAVE_URL = "https://...";   // URL do Flow "OAC - Receber Observacao"
const SYNC_LIST_URL = "https://...";   // URL do Flow "OAC - Listar Observacoes"
const ADMIN_PIN     = "SST2026";       // PIN de acesso ao Painel Geral
```

- Cole a URL de cada gatilho entre as aspas.
- **Troque o `ADMIN_PIN`.** Ele está em texto claro no arquivo — evita que qualquer observador entre
  no painel consolidado por curiosidade, mas não é proteção de verdade.
- Deixando `SYNC_SAVE_URL = ""`, o app volta a funcionar 100% local, sem sincronizar. Útil para
  liberar o app antes de os fluxos estarem prontos: as observações ficam pendentes e sobem depois,
  todas de uma vez.

> As URLs que já estão no arquivo vieram do seu HTML original. Se aqueles fluxos não existirem mais,
> substitua — a assinatura `sig=` é única por fluxo.

### Etapa 7 — Publicar o app

O app é um site estático (3 arquivos + ícones):

| Opção | Como | Observação |
|---|---|---|
| **GitHub Pages** | Repositório → Settings → Pages → branch `main` / raiz | **Use repositório privado**, ou as URLs dos fluxos ficam públicas |
| **Azure Static Web Apps** | Plano gratuito, deploy pelo GitHub | Permite exigir login do Entra ID — a opção mais segura |
| **SharePoint** | Suba os arquivos e incorpore numa página com o web part **Incorporar** | HTML em biblioteca do SharePoint normalmente é **baixado**, não renderizado; só funciona apontando para uma URL hospedada |

Suba na raiz: `index.html`, `manifest.json`, `sw.js`, `icon-192.png` e `icon-512.png`. As pastas de
documentação não precisam ir.

Depois é só abrir o endereço `https://...` no celular e instalar — passo a passo, teste offline e
orientações para a equipe em **`instalar-no-celular.md`**.

> ⚠️ **Ao editar o `index.html`, suba a `VERSAO` no `sw.js`** (`oac-v1` → `oac-v2` → ...). Sem isso
> os celulares podem continuar abrindo a versão antiga, guardada em cache.

Teste de ponta a ponta: preencha uma observação real → salve → confira a linha na planilha → abra o
Painel Geral com o PIN. Depois teste em modo avião, para validar o uso em campo.

### Etapa 8 — Ajustes de conteúdo no `index.html`

Tudo editável direto no arquivo, sem programar:

| O que | Onde (aprox.) | Formato |
|---|---|---|
| Lista de empresas | `const EMPRESAS` — linha ~305 | array de textos |
| Lista de locais/parques | `const LOCAIS` — linha ~304 | array de textos |
| Itens do checklist (35 itens, 7 seções) | `const SECTIONS` — linha ~249 | seções com `items` |
| Categorias de ativadores | `const ATIVADORES` — linha ~295 | objeto por categoria |
| Roteiro do "coach" | `const COACH_SECTIONS` — linha ~308 | seções com `items` |

⚠️ **Cuidado com o `SECTIONS`:** os IDs dos itens são gerados pela posição (`"2.3"` = terceira
pergunta da segunda seção). **Inserir ou remover** um item no meio faz os registros antigos
apontarem para perguntas diferentes. Para preservar o histórico, **acrescente ao final da seção** e
evite remover.

Se você mudar o checklist, **não precisa mexer na planilha**: o `PayloadJSON` guarda as respostas
com seus IDs, e as colunas planas continuam iguais.

### Etapa 9 — Combinados de uso e governança

Esta etapa é conversa com a equipe, não configuração. É o que faz a variante Excel durar:

- **Para consultar, use o Excel no navegador** (*Abrir → Abrir no navegador*), que salva
  continuamente e não mantém bloqueio exclusivo. **Evite o Excel do desktop**: enquanto o arquivo
  estiver aberto lá com alterações não salvas, a gravação do fluxo falha.
- **Para analisar, use uma cópia ou o Power BI.** Nunca monte tabela dinâmica dentro do arquivo que
  recebe as gravações — atualizar exige abrir o arquivo, que é justamente o que trava a escrita.
- **Explique o "pendente" aos observadores.** Se a gravação falhar, nada é perdido: o registro fica
  no aparelho e sobe no próximo toque em sincronizar. Sem esse aviso, o ícone de pendente gera
  chamado.
- **Ninguém limpa dados do navegador** no celular, e vale usar o botão de exportar como backup
  semanal enquanto a base é pequena.
- **A URL do gatilho é a senha.** Quem tiver a URL grava na planilha. Não divulgue, não publique em
  repositório público. Se vazar, não há como regenerar a assinatura: é preciso recriar o fluxo e
  atualizar o `index.html`.
- **LGPD:** a planilha guarda nome de observador e empresa terceirizada. Defina retenção e quem
  acessa a pasta. Evite registrar nome de colaborador observado no campo de comentário livre.

---

## 4. O que mudou em relação ao seu `Serena_OAC.html` original

| Mudança | Motivo |
|---|---|
| `Content-Type` do envio: `application/json` → `text/plain` | Evita o erro de CORS (preflight `OPTIONS`) que impediria qualquer gravação |
| Leitura (`fetchAllRecords`) passou a usar `POST` com corpo `{}` | O gatilho HTTP aceita POST por padrão; com GET seria necessário configurar o método no gatilho |
| Nova função `resumoRespostas()` | Gera `qtdSim`, `qtdNao`, `qtdNA`, `qtdNaoConformidades` e `conformidade` no registro, para virarem **colunas** na planilha — assim filtros e Power BI funcionam sem abrir o JSON |
| Bloco de configuração reescrito | Deixa explícito o que editar e onde |
| `sw.js` + bloco de script no fim do arquivo | Service worker e convite de instalação: o app **abre sem internet** (antes, sem sinal a tela ficava branca) e o Chrome passa a oferecer "Instalar aplicativo". Nunca intercepta as chamadas ao Power Automate — só trata `GET`, e sincronizar é `POST` |
| `manifest.json`, ícones e metatags de PWA | Permite instalar no celular. Os ícones usam o **símbolo oficial da marca** (versão branca sobre coral `#FF5246`), a 58% do quadro para sobreviver ao recorte circular do Android |

Nenhuma regra do checklist, cálculo de conformidade ou tela foi alterada.

---

## 5. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Contador de "pendentes" não zera; console mostra `Failed to fetch` / CORS | `Content-Type` diferente de `text/plain`, ou fluxo desligado | Confira a linha do `headers` em `syncRecord`; veja se o fluxo está **Ativado** |
| `HTTP 404` | URL incompleta (falta parte do `sig=`), fluxo excluído ou desligado | Recopie a URL do gatilho |
| `HTTP 502` / `BadGateway` | Erro **dentro** do fluxo | Histórico do fluxo → ação em vermelho. Nesta variante quase sempre é **arquivo bloqueado** (alguém com a planilha aberta no Excel do desktop) ou nome de Tabela/coluna alterado |
| `HTTP 400` | Um esquema JSON foi colado no gatilho | Apague o esquema: o corpo chega como `text/plain` |
| `HTTP 429` | Cota de chamadas do dono do fluxo | Aguarde, ou mova os fluxos para outra conta |
| Linha criada, mas colunas vazias | Nome da coluna na Tabela diferente do usado no fluxo | Confira os cabeçalhos da linha 1 |
| **Painel Geral mostra dados velhos, sem erro nenhum** | **Paginação não ativada** no *Listar linhas* — só vêm 256 linhas | Ative a paginação com limite 5000 |
| Painel Geral quebra inteiro ao abrir | Linha em branco na Tabela chegando como JSON inválido | Confirme o `Filtrar matriz` descartando `PayloadJSON` vazio |
| "Resposta do robô não é um JSON válido" | Falta a ação *Responder à solicitação* | Adicione a Response com `Content-Type: application/json` |
| Linhas duplicadas | Reenvio de pendentes após falha parcial | *Dados → Remover Duplicatas* pela coluna `IdRegistro` |
| Observações somem do celular | Limpeza de dados do navegador apagou o `localStorage` | Nada a recuperar localmente — é por isso que a sincronização importa |
| Não aparece a opção de instalar | O endereço não é `https://`, ou o `sw.js` não está na raiz junto do `index.html` | Ver `instalar-no-celular.md` |
| App instalado abre em branco sem internet | Foi aberto uma única vez e o cache não completou | Abra uma vez com internet e deixe carregar por inteiro |
| Celular continua com a versão antiga após uma edição | A `VERSAO` do `sw.js` não foi alterada | Suba `oac-v1` → `oac-v2` e publique |

---

## 6. Quando migrar para uma lista do SharePoint

Sinais de que o Excel chegou ao limite:

- gravações falhando com frequência por arquivo bloqueado;
- passando de ~2.000 observações, ou Painel Geral lento;
- mais de duas ou três pessoas precisando abrir a planilha;
- necessidade de auditoria (quem alterou o quê e quando) ou permissão por registro.

A migração é tranquila e **o `index.html` não muda em nada**: o `IdRegistro` vem do app, não do
Excel, então os registros continuam rastreáveis. Guia completo em
`alternativas/lista-sharepoint/LEIA-ME.md`.
