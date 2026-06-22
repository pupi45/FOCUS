/* ============================================================
   FOCUS — App logic
   - Hash-based router between views with transition animation
   - In-memory "backend" simulation for auth + card collection
   - QR scan modal simulating physical card pickup
   - NOTE: replace MOCK_DB / api.* functions with real fetch()
     calls to your backend once it's ready.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- card catalog ---------------- */
  /* Cada carta tiene imagen de frente y reverso. El orden define el número de carta. */
  const CARDS = [
    {
      id: "gastronomia",
      name: "Gastronomía",
      color: "var(--cat-atencion)",
      glow: "rgba(143,232,44,0.55)",
      desc: "Mensajes que te desconectan de la realidad. Responder mensajes al cruzar puede esperar.",
      front: "tarjetas/gastronomia-frente.png",
      back: "tarjetas/gastronomia-reverso.png"
    },
    {
      id: "medicina",
      name: "Medicina",
      color: "var(--cat-responsabilidad)",
      glow: "rgba(61,169,252,0.5)",
      desc: "Música que te acerca al peligro. Baja el volumen, sube tu atención.",
      front: "tarjetas/medicina-frente.png",
      back: "tarjetas/medicina-reverso.png"
    },
    {
      id: "mecanica",
      name: "Mecánica",
      color: "var(--cat-distraccion)",
      glow: "rgba(255,77,77,0.5)",
      desc: "No es solo ahorrar tiempo, es arriesgar tu vida. Usa el paso cebra, tu vida no es atajo.",
      front: "tarjetas/mecanica-frente.png",
      back: "tarjetas/mecanica-reverso.png"
    },
    {
      id: "diseno",
      name: "Diseño Gráfico",
      color: "var(--cat-prevencion)",
      glow: "rgba(255,159,64,0.5)",
      desc: "El puente no es opcional, es tu mejor camino. Usa el puente peatonal, te protege siempre.",
      front: "tarjetas/diseno-frente.png",
      back: "tarjetas/diseno-reverso.png"
    }
  ];

  /* ---------------- mock backend (replace with real API) ---------------- */
  const MOCK_DB = {
    user: null, // { name, email, level }
    collected: new Set() // card ids
  };

  const api = {
    async login(email, _password) {
      await delay(400);
      MOCK_DB.user = { name: email.split("@")[0], email, level: 1 };
      return MOCK_DB.user;
    },
    async register(name, email, _password) {
      await delay(400);
      MOCK_DB.user = { name, email, level: 1 };
      return MOCK_DB.user;
    },
    async getCollection() {
      await delay(150);
      return Array.from(MOCK_DB.collected);
    },
    async redeemQr(cardId) {
      await delay(500);
      if (MOCK_DB.collected.has(cardId)) {
        return { status: "already_owned", cardId };
      }
      MOCK_DB.collected.add(cardId);
      return { status: "unlocked", cardId };
    }
  };

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /* ---------------- state ---------------- */
  const state = {
    route: "inicio",
    collected: new Set()
  };

  /* ---------------- persistencia con localStorage ----------------
     Guarda las tarjetas desbloqueadas en el navegador del usuario,
     para que sigan ahí aunque cierre y vuelva a abrir la página. */
  const STORAGE_KEY = "focus_coleccion";

  function guardarColeccion() {
    try {
      const ids = Array.from(state.collected);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
      // si el navegador bloquea localStorage, simplemente no guarda (no rompe la app)
      console.warn("No se pudo guardar la colección:", e);
    }
  }

  function cargarColeccion() {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const ids = JSON.parse(guardado);
        ids.forEach((id) => {
          // solo carga ids que existan en el catálogo actual
          if (CARDS.some((c) => c.id === id)) {
            state.collected.add(id);
            MOCK_DB.collected.add(id);
          }
        });
      }
    } catch (e) {
      console.warn("No se pudo cargar la colección:", e);
    }
  }

  function levelForCount(n) {
    if (n >= 4) return 4;
    if (n >= 3) return 3;
    if (n >= 1) return 2;
    return 1;
  }

  /* ---------------- DOM refs ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const viewport = $("#viewport");
  const navLinks = $$(".nav-link");
  const burgerBtn = $("#burgerBtn");
  const drawer = $("#drawer");

  /* ---------------- router ---------------- */
  function go(route) {
    if (route === state.route) return;
    const current = $(".view.active");
    const next = $(`#view-${route}`);
    if (!next) return;

    navLinks.forEach((l) => l.classList.toggle("active", l.dataset.route === route));
    drawer.classList.remove("open");

    if (current) {
      current.classList.add("view-out");
      setTimeout(() => {
        current.classList.remove("active", "view-out");
        next.classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 240);
    } else {
      next.classList.add("active");
    }
    state.route = route;
  }

  $$("[data-route]").forEach((el) => {
    el.addEventListener("click", () => go(el.dataset.route));
  });

  burgerBtn.addEventListener("click", () => drawer.classList.toggle("open"));

  /* ---------------- card rendering ---------------- */
  function cardEl(card, { justUnlocked = false } = {}) {
    const unlocked = state.collected.has(card.id);
    const div = document.createElement("div");
    div.className = `card ${unlocked ? "unlocked" : "locked"} ${justUnlocked ? "just-unlocked" : ""}`;
    div.style.setProperty("--c-color", card.color);
    div.style.setProperty("--c-glow", card.glow);

    if (unlocked) {
      // Tarjeta desbloqueada: frente + reverso con flip
      div.innerHTML = `
        <div class="card-flip">
          <div class="card-face card-front">
            <img src="${card.front}" alt="${card.name} — frente" loading="lazy">
          </div>
          <div class="card-face card-back">
            <img src="${card.back}" alt="${card.name} — reverso" loading="lazy">
          </div>
        </div>
        <button class="card-flip-btn" aria-label="Voltear tarjeta" title="Voltear">⟲</button>
      `;
      // clic en el botón voltea la carta (además del hover que se maneja en CSS)
      const btn = div.querySelector(".card-flip-btn");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        div.classList.toggle("flipped");
      });
    } else {
      // Tarjeta bloqueada: silueta con candado
      div.innerHTML = `
        <span class="card-name">${card.name}</span>
        <span class="card-icon-wrap">${lockIcon()}</span>
        <span class="card-foot">FOCUS</span>
      `;
    }
    return div;
  }

  function lockIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
  }

  function renderCards() {
    const mini = $("#miniCards");
    const big = $("#bigCards");
    mini.innerHTML = "";
    big.innerHTML = "";
    CARDS.forEach((c) => {
      mini.appendChild(cardEl(c));
      big.appendChild(cardEl(c));
    });
    updateProgress();
  }

  function updateProgress() {
    const count = state.collected.size;
    const pct = Math.round((count / CARDS.length) * 100);

    $("#progressBadgeMini").textContent = `${count}/${CARDS.length}`;
    $("#progressLabel").textContent = `${count} de ${CARDS.length} tarjetas`;
    $("#progressPct").textContent = `${pct}%`;
    $("#progressFill").style.width = `${pct}%`;

    const rewardDone = count === CARDS.length;
    [$("#rewardBtnHome"), $("#rewardBtnCollection")].forEach((btn) => {
      btn.classList.toggle("is-complete", rewardDone);
    });
    const rewardMsg = rewardDone
      ? "¡Recompensa desbloqueada! Tócala para reclamarla 🎉"
      : "¡Colecciona las 4 tarjetas y desbloquea tu recompensa!";
    $("#rewardText").textContent = rewardMsg;
    $("#rewardTextCollection").textContent = rewardMsg;
  }

  /* ---------------- unlock flow ---------------- */
  async function unlockCard(cardId) {
    const res = await api.redeemQr(cardId);
    const card = CARDS.find((c) => c.id === cardId);

    if (res.status === "already_owned") {
      return { ok: false, message: `Ya tienes la tarjeta "${card.name}".` };
    }

    state.collected.add(cardId);
    guardarColeccion();
    renderCards();
    showReveal(card);

    if (state.collected.size === CARDS.length) {
      setTimeout(showComplete, 1200);
    }
    return { ok: true };
  }

  function showReveal(card) {
    const modal = $("#revealModal");
    $("#revealKicker").textContent = "¡Tarjeta desbloqueada!";
    $("#revealName").textContent = card.name;
    $("#revealDesc").textContent = card.desc;
    const stage = $("#revealStage");
    stage.innerHTML = "";
    stage.appendChild(cardEl(card, { justUnlocked: true }));
    openModal(modal);
  }

  function showComplete() {
    const modal = $("#completeModal");
    spawnConfetti();
    openModal(modal);
  }

  function spawnConfetti() {
    const root = $("#confetti");
    root.innerHTML = "";
    const colors = ["#8FE82C", "#FF4D4D", "#3DA9FC", "#FF9F40", "#F5F6F2"];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = Math.random() * 1.2 + "s";
      s.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      root.appendChild(s);
    }
  }

  /* ---------------- modal helpers ---------------- */
  function openModal(modal) { modal.classList.add("open"); }
  function closeModal(modal) { modal.classList.remove("open"); }

  $$(".modal-overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => { if (e.target === ov) closeModal(ov); });
  });
  $("#revealClose").addEventListener("click", () => closeModal($("#revealModal")));
  $("#completeClose").addEventListener("click", () => closeModal($("#completeModal")));

  /* ---------------- scan modal (cámara real) ---------------- */
  let qrScanner = null;        // instancia del lector
  let scanProcesando = false;  // evita procesar el mismo QR varias veces

  // Extrae el id de carta de un texto escaneado.
  // Acepta tanto una URL completa (https://.../?carta=medicina)
  // como un texto simple que sea directamente el id (ej. "medicina").
  function extraerCartaId(texto) {
    if (!texto) return null;
    try {
      const url = new URL(texto);
      const id = url.searchParams.get("carta");
      if (id) return id;
    } catch (e) {
      // no era una URL válida, seguimos abajo
    }
    const limpio = texto.trim().toLowerCase();
    if (CARDS.some((c) => c.id === limpio)) return limpio;
    return null;
  }

  async function iniciarEscaner() {
    const hint = $("#scanHint");
    scanProcesando = false;

    // Verifica que la librería esté disponible
    if (typeof Html5Qrcode === "undefined") {
      hint.textContent = "No se pudo cargar el escáner. Revisa tu conexión.";
      return;
    }

    qrScanner = new Html5Qrcode("qrReader");

    const onScanSuccess = async (decodedText) => {
      if (scanProcesando) return;          // ya estamos procesando un código
      const cartaId = extraerCartaId(decodedText);
      if (!cartaId) {
        hint.textContent = "Ese QR no es de FOCUS. Intenta con otro.";
        return;
      }
      scanProcesando = true;
      await detenerEscaner();
      closeModal($("#scanModal"));
      await delay(300);

      const res = await unlockCard(cartaId);
      if (res && res.ok === false) {
        // ya la tenía: mostramos un aviso suave
        mostrarAvisoYaTienes(res.message);
      }
    };

    try {
      await qrScanner.start(
        { facingMode: "environment" },        // cámara trasera en celular
        { fps: 10, qrbox: { width: 220, height: 220 } },
        onScanSuccess,
        () => {}                              // ignoramos errores de "no encontró QR aún"
      );
      hint.textContent = "Apunta la cámara al código QR";
    } catch (err) {
      hint.textContent = "No se pudo abrir la cámara. Revisa los permisos del navegador.";
    }
  }

  async function detenerEscaner() {
    if (qrScanner) {
      try { await qrScanner.stop(); qrScanner.clear(); } catch (e) {}
      qrScanner = null;
    }
  }

  function mostrarAvisoYaTienes(msg) {
    const modal = $("#revealModal");
    $("#revealKicker").textContent = "Ya la tenías";
    $("#revealName").textContent = "";
    $("#revealDesc").textContent = msg || "Ya tienes esta tarjeta en tu colección.";
    $("#revealStage").innerHTML = "";
    openModal(modal);
  }

  $("#scanBtn").addEventListener("click", () => {
    openModal($("#scanModal"));
    iniciarEscaner();
  });
  $("#closeScan").addEventListener("click", async () => {
    await detenerEscaner();
    closeModal($("#scanModal"));
  });

  $("#rewardBtnHome").addEventListener("click", () => go("coleccion"));
  $("#rewardBtnCollection").addEventListener("click", () => {
    if (state.collected.size === CARDS.length) showComplete();
  });

  /* ---------------- lectura del QR desde la URL ----------------
     Cada QR físico apunta a una URL como:
       https://tupagina.com/?carta=gastronomia
     Aquí leemos ese "?carta=..." y desbloqueamos la tarjeta. */
  function revisarQrEnUrl() {
    const params = new URLSearchParams(window.location.search);
    const cartaId = params.get("carta");
    if (!cartaId) return;

    const existe = CARDS.some((c) => c.id === cartaId);
    if (!existe) return;

    // Limpia el "?carta=..." de la barra de direcciones para que al recargar
    // no se vuelva a procesar (y se vea más limpio).
    const urlLimpia = window.location.pathname;
    window.history.replaceState({}, document.title, urlLimpia);

    // Pequeña espera para que la página termine de montarse y se vea la animación.
    setTimeout(() => { unlockCard(cartaId); }, 600);
  }

  /* ---------------- init ---------------- */
  cargarColeccion();   // recupera las tarjetas guardadas de visitas anteriores
  renderCards();
  revisarQrEnUrl();    // revisa si llegó por un QR y desbloquea lo que toca
})();
