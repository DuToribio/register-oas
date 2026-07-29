/* =========================================================================
   Service Worker — O.A.C. Serena

   O que ele faz:
     1) Torna o app INSTALÁVEL no celular (o Chrome/Android só oferece
        "Instalar aplicativo" quando existe um service worker).
     2) Faz o app ABRIR SEM INTERNET. Sem isso, abrir o app no parque sem
        sinal resulta em tela branca — os dados ficam salvos no aparelho,
        mas o próprio arquivo precisaria ser baixado do servidor.

   ⚠️ IMPORTANTE — AO EDITAR O index.html:
      Suba o número da VERSAO abaixo (v1 -> v2 -> v3...). É isso que faz os
      celulares buscarem a versão nova. Sem subir, o aparelho pode continuar
      abrindo a versão antiga do cache.
========================================================================= */

const VERSAO = "oac-v1";

// Arquivos do "casco" do app — o que precisa estar em cache para abrir offline.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

/* ------------------------------------------------------------- instalação */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSAO);
      // add() individual em vez de addAll(): se um arquivo falhar, os outros
      // ainda são cacheados (addAll aborta tudo em qualquer erro).
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => {}))
      );
      self.skipWaiting();
    })()
  );
});

/* --------------------------------------------------------------- ativação */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // limpa caches de versões anteriores
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

/* ------------------------------------------------------------------ fetch */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1) Só interceptamos GET. As chamadas ao Power Automate (sincronizar e
  //    listar) são POST e passam direto, sem cache — é essencial que uma
  //    observação nunca seja respondida a partir do cache.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 2) Navegação (abrir o app) e o próprio HTML:
  //    stale-while-revalidate — devolve o cache na hora (abre rápido e
  //    funciona offline) e atualiza em segundo plano para a próxima abertura.
  const ehNavegacao =
    req.mode === "navigate" ||
    (url.origin === self.location.origin &&
      (url.pathname.endsWith("/") || url.pathname.endsWith("index.html")));

  if (ehNavegacao) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSAO);
        const cacheado = await cache.match("./index.html");

        const rede = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) cache.put("./index.html", resp.clone());
            return resp;
          })
          .catch(() => null);

        // se há cache, entrega imediatamente; senão espera a rede
        return cacheado || (await rede) || new Response(
          "<h1>Sem conexão</h1><p>Abra o app uma vez com internet para que ele funcione offline.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })()
    );
    return;
  }

  // 3) Demais recursos (ícones, manifest, fontes do Google):
  //    cache-first, buscando na rede apenas o que ainda não está guardado.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSAO);
      const cacheado = await cache.match(req);
      if (cacheado) return cacheado;

      try {
        const resp = await fetch(req);
        // guarda respostas válidas e também as opacas das fontes (type 'opaque')
        if (resp && (resp.ok || resp.type === "opaque")) {
          cache.put(req, resp.clone()).catch(() => {});
        }
        return resp;
      } catch (e) {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});
