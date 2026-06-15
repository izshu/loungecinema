const state = {
  halls: [],
  tariffs: [],
  gallery: {},
  settings: {},
  hall: null,
  tariff: null,
  date: null,
  time: null,
  selectedSlot: null,
  guests: 2,
  hookah: false,
  price: null,
};

const HALL_THEMES = {
  "the-moon": "theme-moon",
  flamingo: "theme-flamingo",
  "black-room": "theme-black-room",
};

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAYS_FULL = [
  "Воскресенье", "Понедельник", "Вторник", "Среда",
  "Четверг", "Пятница", "Суббота",
];

let calYear, calMonth;
let lightboxImages = [];
let lightboxIndex = 0;
let toastTimer = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = "Ошибка запроса";
    if (data.detail) {
      msg = Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg || d).join(", ")
        : String(data.detail);
    }
    throw new Error(msg);
  }
  return data;
}

function formatPrice(n) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRu(iso, withWeekday = false) {
  if (!iso) return "";
  const dt = parseIsoDate(iso);
  const day = dt.getDate();
  const month = MONTHS[dt.getMonth()];
  const year = dt.getFullYear();
  const base = `${day} ${month} ${year}`;
  if (!withWeekday) return base;
  return `${WEEKDAYS_FULL[dt.getDay()]}, ${base}`;
}

function isDateTariff(t) {
  return t?.category === "date";
}

function canShowTime() {
  return state.hall && state.tariff;
}

function isReadyForContacts() {
  return canShowTime() && state.date && state.time;
}

function getMissingSteps() {
  const missing = [];
  if (!state.hall) missing.push("зал");
  if (!state.tariff) missing.push("пакет");
  if (!state.date || !state.time) missing.push("дату и время");
  return missing;
}

function scrollToEl(el) {
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showToast(msg) {
  const el = document.getElementById("toast-hint");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

function updateTopProgress() {
  const order = ["hall", "tariff", "time", "contacts"];
  let activeSet = false;
  order.forEach((key) => {
    const step = document.querySelector(`.top-progress-step[data-step="${key}"]`);
    if (!step) return;
    let done = false;
    if (key === "hall") done = !!state.hall;
    if (key === "tariff") done = !!state.tariff;
    if (key === "time") done = !!(state.date && state.time);
    step.classList.toggle("done", done);
    if (done) {
      step.classList.remove("active");
    } else if (!activeSet) {
      step.classList.add("active");
      activeSet = true;
    } else {
      step.classList.remove("active");
    }
  });
}

function updateMiniChecklist() {
  document.querySelectorAll(".mini-check-item").forEach((item) => {
    const step = item.dataset.step;
    let done = false;
    if (step === "hall") done = !!state.hall;
    if (step === "tariff") done = !!state.tariff;
    if (step === "time") done = !!state.date;
    if (step === "slot") done = !!state.time;
    if (step === "guests") done = !!state.tariff && (isDateTariff(state.tariff) || state.guests >= 1);
    item.classList.toggle("done", done);
  });
}

function updateGuestsDisplay() {
  const valEl = document.getElementById("guests-value");
  if (valEl) valEl.textContent = state.guests;
  document.getElementById("guests-minus").disabled = state.guests <= 1;
  document.getElementById("guests-plus").disabled = state.guests >= 20;
}

function updateCtaHint() {
  const hint = document.getElementById("cta-hint");
  const btn = document.getElementById("btn-contacts");
  if (isReadyForContacts()) {
    hint.textContent = "";
    btn.removeAttribute("title");
    return;
  }
  const missing = getMissingSteps();
  hint.textContent = missing.length ? `Осталось: ${missing.join(", ")}` : "";
  btn.title = missing.length ? `Выберите: ${missing.join(", ")}` : "";
}

function updateGuestsFieldState() {
  const extras = document.getElementById("right-extras");
  const stepper = document.getElementById("guests-row");
  if (!canShowTime()) {
    extras.hidden = true;
    return;
  }
  extras.hidden = false;
  if (isDateTariff(state.tariff)) {
    stepper.hidden = true;
    state.guests = state.settings.date_guests || 2;
  } else {
    stepper.hidden = false;
    updateGuestsDisplay();
  }
}

function updateUIState() {
  const hint = document.getElementById("center-hint");
  const datetimeSection = document.getElementById("datetime-section");

  hint.hidden = !!state.hall;
  datetimeSection.hidden = !canShowTime();

  if (canShowTime() && calYear == null) renderCalendar();

  document.getElementById("btn-contacts").disabled = !isReadyForContacts();
  updateGuestsFieldState();
  updateCtaHint();
  updateTopProgress();
  updateMiniChecklist();
}

function updateSummary() {
  const el = document.getElementById("summary");
  const totalEl = document.getElementById("summary-total");
  const totalPrice = document.getElementById("total-price");
  const breakdown = document.getElementById("price-breakdown");

  if (!state.hall && !state.tariff) {
    el.innerHTML = '<p class="muted">Выберите зал и пакет</p>';
    totalEl.hidden = true;
    breakdown.textContent = "";
    updateTopProgress();
    updateMiniChecklist();
    return;
  }

  let html = "";
  if (state.hall) {
    html += `<p class="summary-line summary-clickable" data-focus="hall"><strong>Зал:</strong> ${state.hall.name}</p>`;
  }
  if (state.tariff) {
    html += `<p class="summary-line summary-clickable" data-focus="tariff"><strong>Пакет:</strong> ${state.tariff.name} · ${formatDuration(state.tariff.duration_minutes)}</p>`;
  }
  if (state.date && state.time) {
    const range = state.selectedSlot?.label || state.time;
    html += `<p class="summary-line summary-clickable" data-focus="time"><strong>Дата:</strong> ${formatDateRu(state.date)}</p>`;
    html += `<p class="summary-line summary-clickable" data-focus="time"><strong>Время:</strong> ${range}</p>`;
  } else if (state.tariff) {
    html += `<p class="summary-line muted">Дата и время не выбраны</p>`;
  }
  if (state.tariff) {
    const g = isDateTariff(state.tariff) ? state.settings.date_guests : state.guests;
    html += `<p class="summary-line"><strong>Гости:</strong> ${g}</p>`;
  }
  if (state.hookah) html += `<p class="summary-line">+ Кальян</p>`;

  el.innerHTML = html;

  el.querySelectorAll("[data-focus]").forEach((row) => {
    row.addEventListener("click", () => {
      const f = row.dataset.focus;
      if (f === "hall") scrollToEl(document.getElementById("hall-cards"));
      if (f === "tariff") scrollToEl(document.getElementById("center-panel"));
      if (f === "time") scrollToEl(document.getElementById("datetime-section"));
    });
  });

  if (state.price) {
    breakdown.textContent = state.price.breakdown || "";
    totalEl.hidden = false;
    totalPrice.textContent = formatPrice(state.price.total_price);
  } else if (state.tariff) {
    breakdown.textContent = "";
    totalEl.hidden = false;
    totalPrice.textContent = state.tariff.price_label || formatPrice(state.tariff.base_price);
  } else {
    totalEl.hidden = true;
    breakdown.textContent = "";
  }
  updateTopProgress();
  updateMiniChecklist();
}

async function refreshPrice() {
  if (!state.tariff) return;
  const guests = isDateTariff(state.tariff) ? state.settings.date_guests : state.guests;
  try {
    state.price = await api("/api/price", {
      method: "POST",
      body: JSON.stringify({
        hall_id: state.hall?.id || 1,
        tariff_id: state.tariff.id,
        guests_count: guests,
        hookah: state.hookah,
      }),
    });
    updateSummary();
    updateUIState();
  } catch (e) {
    console.error(e);
  }
}

function openLightbox(images, startIndex = 0) {
  if (!images?.length) return;
  lightboxImages = images;
  lightboxIndex = startIndex;
  renderLightbox();
  document.getElementById("image-lightbox").hidden = false;
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  document.getElementById("image-lightbox").hidden = true;
  document.body.classList.remove("lightbox-open");
}

function renderLightbox() {
  const img = document.getElementById("lightbox-image");
  const counter = document.getElementById("lightbox-counter");
  const prev = document.getElementById("lightbox-prev");
  const next = document.getElementById("lightbox-next");
  const multi = lightboxImages.length > 1;

  img.src = lightboxImages[lightboxIndex];
  prev.hidden = !multi;
  next.hidden = !multi;
  counter.hidden = !multi;
  if (multi) counter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
}

function lightboxStep(delta) {
  lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

function renderTariffPreview(t) {
  const panel = document.getElementById("tariff-preview");
  if (!t) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  document.getElementById("preview-image").src = t.image || "";
  document.getElementById("preview-image").alt = t.name;
  document.getElementById("preview-name").textContent = t.name;
  document.getElementById("preview-meta").textContent =
    `${formatDuration(t.duration_minutes)} · ${t.price_label || formatPrice(t.base_price)}`;
  const noteEl = document.getElementById("preview-note");
  if (isDateTariff(t)) {
    noteEl.textContent = "Фиксированная цена на двоих";
    noteEl.hidden = false;
  } else {
    noteEl.hidden = true;
  }
}

function selectTariff(t) {
  if (!state.hall) {
    showToast("Сначала выберите зал");
    scrollToEl(document.getElementById("hall-cards"));
    return;
  }

  state.tariff = t;
  state.date = null;
  state.time = null;
  state.selectedSlot = null;

  document.querySelectorAll(".tariff-row").forEach((row) => {
    row.classList.toggle("selected", Number(row.dataset.id) === t.id);
  });

  renderTariffPreview(t);

  if (isDateTariff(t)) {
    state.guests = state.settings.date_guests || 2;
  } else if (state.guests == null || state.guests < 1) {
    state.guests = 2;
  }

  updateGuestsHint();
  updateGuestsDisplay();
  refreshPrice();
  updateUIState();
  updateSummary();
  renderCalendar();
  scrollToEl(document.getElementById("tariff-preview"));
}

function tariffRowHtml(t) {
  return `
    <li>
      <button type="button" class="tariff-row" data-id="${t.id}">
        <span class="tariff-row-body">
          <span class="tariff-row-name">${t.name}</span>
          <span class="tariff-row-meta">${formatPrice(t.base_price)} · ${formatDuration(t.duration_minutes)}</span>
        </span>
        <span class="tariff-row-check" aria-hidden="true"></span>
      </button>
    </li>`;
}

function bindTariffList(containerId, tariffs) {
  const ul = document.getElementById(containerId);
  ul.innerHTML = tariffs.map(tariffRowHtml).join("");
  ul.querySelectorAll(".tariff-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectTariff(state.tariffs.find((x) => x.id === Number(btn.dataset.id)));
    });
  });
}

function renderTariffSections() {
  const hourly = state.tariffs.filter((t) => t.category === "hourly");
  const rent = state.tariffs.filter((t) => t.category === "rent");
  const dateT = state.tariffs.filter((t) => t.category === "date");

  bindTariffList("list-hourly", hourly);
  bindTariffList("list-rent", rent);
  bindTariffList("list-date", dateT);

  document.getElementById("block-hourly").hidden = hourly.length === 0;
  document.getElementById("block-rent").hidden = rent.length === 0;
  document.getElementById("block-date").hidden = dateT.length === 0;
}

function selectHall(h) {
  state.hall = h;
  document.querySelectorAll(".hall-card").forEach((card) => {
    card.classList.toggle("selected", Number(card.dataset.hallId) === h.id);
  });
  updateUIState();
  updateSummary();
  scrollToEl(document.getElementById("center-panel"));
  if (state.tariff && state.date) loadSlots();
}

function hallThemeClass(slug) {
  return HALL_THEMES[slug] || "";
}

function renderHalls() {
  const root = document.getElementById("hall-cards");
  root.innerHTML = state.halls
    .map((h) => {
      const images = state.gallery[h.slug] || [];
      const cover = images[0] || "";
      const theme = hallThemeClass(h.slug);
      return `
      <button type="button" class="hall-card ${theme}" data-hall-id="${h.id}" data-slug="${h.slug}">
        <div class="hall-card-photo" data-action="lightbox">
          ${cover ? `<img src="${cover}" alt="${h.name}" loading="lazy">` : `<span class="hall-card-no-photo muted">Нет фото</span>`}
        </div>
        <span class="hall-card-footer">
          <span class="hall-card-name">${h.name}</span>
          ${images.length ? `<span class="hall-photo-link">фото зала →</span>` : ""}
        </span>
      </button>`;
    })
    .join("");

  root.querySelectorAll(".hall-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectHall(state.halls.find((x) => x.id === Number(card.dataset.hallId)));
    });
    card.querySelector(".hall-card-photo")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const images = state.gallery[card.dataset.slug] || [];
      if (images.length) openLightbox(images, 0);
    });
    card.querySelector(".hall-photo-link")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const images = state.gallery[card.dataset.slug] || [];
      if (images.length) openLightbox(images, 0);
    });
  });
}

function updateGuestsHint() {
  const hint = document.getElementById("guests-hint");
  const t = state.tariff;
  if (!t) {
    hint.textContent = "";
    return;
  }
  if (t.category === "hourly") {
    hint.textContent = `${state.settings.hourly_per_person} ₽ × ${state.guests} чел. = ${state.settings.hourly_per_person * state.guests} ₽`;
  } else if (t.category === "date") {
    hint.textContent = "Пакет на двоих, цена фиксированная.";
  } else {
    hint.textContent = `До ${state.settings.included_guests_rent} в цене, +${state.settings.extra_person_rent} ₽/чел. сверх.`;
  }
}

function renderCalendar() {
  const now = new Date();
  if (calYear == null) {
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }
  document.getElementById("cal-title").textContent = `${MONTHS_NOM[calMonth]} ${calYear}`;
  const grid = document.getElementById("calendar");
  const first = new Date(calYear, calMonth, 1);
  let start = first.getDay() - 1;
  if (start < 0) start = 6;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = WEEKDAYS.map((d) => `<div class="cal-head">${d}</div>`).join("");
  for (let i = 0; i < start; i++) html += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(calYear, calMonth, d);
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    html += `<button type="button" class="cal-day${state.date === iso ? " selected" : ""}" data-date="${iso}" ${dt < today ? "disabled" : ""}>${d}</button>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-day:not(:disabled)").forEach((btn) => {
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".cal-day").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.date = btn.dataset.date;
      state.time = null;
      state.selectedSlot = null;
      loadSlots();
      updateSummary();
      updateUIState();
    });
  });
}

async function loadSlots() {
  const label = document.getElementById("slots-label");
  const root = document.getElementById("slots");
  const busyBlock = document.getElementById("busy-block");
  const busyList = document.getElementById("busy-list");

  if (!canShowTime() || !state.date) {
    label.textContent = "Выберите дату";
    root.innerHTML = "";
    busyBlock.hidden = true;
    return;
  }

  label.textContent = formatDateRu(state.date, true);
  root.innerHTML = '<span class="muted">Загрузка...</span>';

  try {
    const { slots, busy } = await api(
      `/api/slots?hall_id=${state.hall.id}&tariff_id=${state.tariff.id}&day=${state.date}`
    );

    if (!slots.length) {
      root.innerHTML = '<span class="muted">Нет свободных слотов</span>';
    } else {
      root.innerHTML = slots
        .map(
          (s) =>
            `<button type="button" class="slot${state.time === s.time ? " selected" : ""}" data-time="${s.time}" data-label="${s.label}">${s.label}</button>`
        )
        .join("");
      root.querySelectorAll(".slot").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll(".slot").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          state.time = btn.dataset.time;
          state.selectedSlot = { label: btn.dataset.label };
          updateSummary();
          updateUIState();
        });
      });
    }

    busyBlock.hidden = !busy?.length;
    if (busy?.length) {
      busyList.innerHTML = busy.map((b) => `<span class="busy-chip">${b}</span>`).join("");
    }
  } catch (e) {
    root.innerHTML = `<span class="error">${e.message}</span>`;
  }
}

function setGuests(n) {
  if (state.tariff && isDateTariff(state.tariff)) return;
  state.guests = Math.max(1, Math.min(20, n));
  updateGuestsDisplay();
  updateGuestsHint();
  refreshPrice();
  updateSummary();
  updateUIState();
}

function applyContactSettings() {
  const c = state.settings.contact;
  if (!c) return;
  document.getElementById("contact-block").innerHTML = `
    <p class="info-text"><strong>${c.address}</strong><br>
    <a href="tel:+79145227452">${c.phone}</a></p>`;
  const hp = document.getElementById("hookah-price");
  if (hp) hp.textContent = state.settings.hookah_rub;
}

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

document.getElementById("preview-image-wrap").addEventListener("click", () => {
  if (state.tariff?.image) openLightbox([state.tariff.image], 0);
});

document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
document.getElementById("lightbox-prev").addEventListener("click", () => lightboxStep(-1));
document.getElementById("lightbox-next").addEventListener("click", () => lightboxStep(1));

document.getElementById("image-lightbox").addEventListener("click", (e) => {
  if (e.target.id === "image-lightbox") closeLightbox();
});

document.addEventListener("keydown", (e) => {
  const lb = document.getElementById("image-lightbox");
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxStep(-1);
  if (e.key === "ArrowRight") lightboxStep(1);
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});

document.getElementById("cal-prev").addEventListener("click", () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});

document.getElementById("cal-next").addEventListener("click", () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

document.getElementById("guests-minus").addEventListener("click", () => setGuests(state.guests - 1));
document.getElementById("guests-plus").addEventListener("click", () => setGuests(state.guests + 1));

document.getElementById("hookah").addEventListener("change", (e) => {
  state.hookah = e.target.checked;
  refreshPrice();
});

document.getElementById("btn-contacts").addEventListener("click", () => {
  if (isReadyForContacts()) openModal("contact-modal");
});

document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("form-error");
  errEl.hidden = true;
  const fd = new FormData(e.target);
  const guests = isDateTariff(state.tariff) ? state.settings.date_guests : state.guests;
  try {
    const booking = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        hall_id: state.hall.id,
        tariff_id: state.tariff.id,
        date: state.date,
        time: state.time,
        client_name: fd.get("client_name"),
        phone: fd.get("phone"),
        guests_count: guests,
        hookah: state.hookah,
        note: fd.get("note") || null,
      }),
    });
    sessionStorage.setItem("lastBooking", JSON.stringify(booking));
    window.location.href = "/success";
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    loadSlots();
  }
});

async function init() {
  try {
    const [halls, tariffs, settings, gallery] = await Promise.all([
      api("/api/halls"),
      api("/api/tariffs"),
      api("/api/settings"),
      api("/api/halls/gallery"),
    ]);
    state.halls = halls;
    state.tariffs = tariffs;
    state.settings = settings;
    state.gallery = gallery;
    applyContactSettings();
    renderHalls();
    renderTariffSections();
    updateGuestsDisplay();
    updateUIState();
    updateSummary();
  } catch (e) {
    document.querySelector(".booking-desk").innerHTML =
      `<p class="error">Не удалось загрузить: ${e.message}</p>`;
  }
}

init();
