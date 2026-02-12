(() => {
  "use strict";

  const PHONE = "989150667527"; // wa.me

  const SERVICES = [
    { id: "gelish", name: "ژلیش" },
    { id: "ext", name: "کاشت" },
    { id: "repair", name: "ترمیم" },
    { id: "design", name: "طراحی" },
    { id: "laminate", name: "لمینت" },
    { id: "remove", name: "ریموو" },
    { id: "mani", name: "مانیکور" },
    { id: "pedi", name: "پدیکور" },
  ];

  const GALLERY = [
    "./nail-1.png",
    "./nail-2.png",
    "./nail-3.png",
    "./nail-4.png",
  ];

  // Slots independent of services
  const SLOT_CONFIG = {
    daysAhead: 10,
    stepMin: 30,
    shifts: [{ startMin: 8.5 * 60, endMin: 19 * 60 }],
  };

  const $ = (id) => document.getElementById(id);

  const dom = {
    focusBooking: $("focus-booking"),
    heroCta: $("hero-cta"),
    bookingPanel: $("booking-panel"),
    bookingForm: $("booking-form"),
    toggleHelp: $("toggle-help"),
    helpPanel: $("help-panel"),

    focusFooter: $("focus-footer"),
    footer: $("footer"),

    servicesInline: $("services-inline"),
    dateChips: $("date-chips"),
    timeChips: $("time-chips"),
    bookingNote: $("booking-note"),

    summaryServices: $("summary-services"),
    summaryDatetime: $("summary-datetime"),
    startWhatsapp: $("start-whatsapp"),

    galleryCard: $("gallery-card"),
    galleryImage: $("gallery-image"),
    galleryDots: $("gallery-dots"),

    scrollTop: $("scroll-top"),
    footerYear: $("footer-year"),

    toast: $("app-toast"),
    toastText: $("toast-text"),
    toastClose: $("toast-close"),
  };

  const state = {
    selectedServiceIds: new Set(),
    selectedDayKey: "",
    selectedTimeIso: "",

    galleryIndex: 0,
    autoTimer: null,

    swipe: { active: false, startX: 0, startY: 0, locked: false },
    toastTimer: null,
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toDayKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function fromDayKey(dayKey) {
    return new Date(`${dayKey}T00:00:00`);
  }

  function dateFaLong(dayKey) {
    return fromDayKey(dayKey).toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function dateFaShort(dayKey) {
    const d = fromDayKey(dayKey);
    const weekday = d.toLocaleDateString("fa-IR", { weekday: "short" });
    const md = d.toLocaleDateString("fa-IR", {
      month: "short",
      day: "numeric",
    });
    return { weekday, md };
  }

  function timeFa(date) {
    return date.toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showToast(text) {
    if (!dom.toast || !dom.toastText) return;
    dom.toastText.textContent = String(text || "");
    dom.toast.classList.remove("app-hidden");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(
      () => dom.toast.classList.add("app-hidden"),
      2600,
    );
  }

  function selectedServicesLabel() {
    const names = SERVICES.filter((s) =>
      state.selectedServiceIds.has(s.id),
    ).map((s) => s.name);
    return names.length ? names.join(" + ") : "—";
  }

  function selectedDatetimeLabel() {
    if (!state.selectedDayKey || !state.selectedTimeIso) return "—";
    return `${dateFaLong(state.selectedDayKey)} - ${timeFa(new Date(state.selectedTimeIso))}`;
  }

  // =========================
  // Services (tap toggle)
  // =========================
  function renderServicesInline() {
    if (!dom.servicesInline) return;
    dom.servicesInline.innerHTML = "";

    SERVICES.forEach((service) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip" + (state.selectedServiceIds.has(service.id) ? " selected" : "");
      chip.setAttribute(
        "aria-pressed",
        state.selectedServiceIds.has(service.id) ? "true" : "false",
      );

      chip.innerHTML = `
        <span class="chip-icon" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        <span>${service.name}</span>
      `;

      chip.addEventListener("click", () => {
        if (state.selectedServiceIds.has(service.id))
          state.selectedServiceIds.delete(service.id);
        else state.selectedServiceIds.add(service.id);

        renderServicesInline();
        syncSummary();
      });

      dom.servicesInline.appendChild(chip);
    });
  }

  // =========================
  // Slots
  // =========================
  function buildSlotsForDay(dayKey) {
    const dayDate = fromDayKey(dayKey);
    const slots = [];

    SLOT_CONFIG.shifts.forEach((shift) => {
      for (
        let minute = shift.startMin;
        minute <= shift.endMin - SLOT_CONFIG.stepMin;
        minute += SLOT_CONFIG.stepMin
      ) {
        const start = new Date(dayDate);
        start.setHours(0, 0, 0, 0);
        start.setMinutes(minute);

        // hide past times only for today
        const now = new Date();
        const isToday =
          start.getFullYear() === now.getFullYear() &&
          start.getMonth() === now.getMonth() &&
          start.getDate() === now.getDate();

        if (isToday && start.getTime() < Date.now()) continue;

        slots.push(start);
      }
    });

    return slots;
  }

  // ✅ FIX: always generate EXACTLY next 10 days (no filtering)
  function computeNextDays() {
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < SLOT_CONFIG.daysAhead; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(toDayKey(d));
    }
    return days;
  }

  // =========================
  // Date chips
  // =========================
  function renderDateChips() {
    if (!dom.dateChips) return;

    const days = computeNextDays();
    dom.dateChips.innerHTML = "";

    if (!state.selectedDayKey || !days.includes(state.selectedDayKey)) {
      state.selectedDayKey = days[0];
      state.selectedTimeIso = "";
    }

    days.forEach((dayKey) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip date-chip" + (state.selectedDayKey === dayKey ? " selected" : "");

      const { weekday, md } = dateFaShort(dayKey);

      chip.innerHTML = `
        <span class="chip-icon" aria-hidden="true"><i class="fa-solid fa-calendar-days"></i></span>
        <span class="date-title">${weekday} (${md})</span>
      `;

      chip.addEventListener("click", () => {
        state.selectedDayKey = dayKey;
        state.selectedTimeIso = "";
        renderDateChips();
        renderTimeChips();
        syncSummary();
      });

      dom.dateChips.appendChild(chip);
    });

    renderTimeChips();
  }

  // =========================
  // Time chips
  // =========================
  function renderTimeChips() {
    if (!dom.timeChips) return;
    dom.timeChips.innerHTML = "";

    if (!state.selectedDayKey) {
      dom.timeChips.innerHTML = `<div class="helper-text">ابتدا تاریخ را انتخاب کن.</div>`;
      return;
    }

    const slots = buildSlotsForDay(state.selectedDayKey);

    if (!slots.length) {
      dom.timeChips.innerHTML = `<div class="helper-text">برای این روز، زمان پیشنهادی موجود نیست. روز دیگری انتخاب کن.</div>`;
      state.selectedTimeIso = "";
      return;
    }

    // ensure selection
    if (!state.selectedTimeIso) state.selectedTimeIso = slots[0].toISOString();
    else if (!slots.some((s) => s.toISOString() === state.selectedTimeIso))
      state.selectedTimeIso = slots[0].toISOString();

    slots.forEach((start) => {
      const iso = start.toISOString();
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip time-chip" + (state.selectedTimeIso === iso ? " selected" : "");

      chip.innerHTML = `
        <span class="chip-icon" aria-hidden="true"><i class="fa-solid fa-clock"></i></span>
        <span>${timeFa(start)}</span>
      `;

      chip.addEventListener("click", () => {
        state.selectedTimeIso = iso;
        renderTimeChips();
        syncSummary();
      });

      dom.timeChips.appendChild(chip);
    });
  }

  // =========================
  // Summary + WhatsApp
  // =========================
  function syncSummary() {
    if (dom.summaryServices)
      dom.summaryServices.textContent = selectedServicesLabel();
    if (dom.summaryDatetime)
      dom.summaryDatetime.textContent = selectedDatetimeLabel();
  }

  function buildWhatsappMessage() {
    const services = selectedServicesLabel();
    if (services === "—") return null;

    if (!state.selectedDayKey || !state.selectedTimeIso) return null;

    const dateLabel = dateFaLong(state.selectedDayKey);
    const timeLabel = timeFa(new Date(state.selectedTimeIso));
    const note = (dom.bookingNote?.value || "").trim();

    return `سلام وقت بخیر 🌸
برای ${services}
تاریخ: ${dateLabel}
ساعت: ${timeLabel}${note ? `\n\nتوضیح: ${note}` : ""}

ممنون می‌شم تایید بفرمایید 🙏`;
  }

  function openWhatsapp() {
    const msg = buildWhatsappMessage();
    if (!msg) {
      showToast("لطفاً حداقل یک خدمت و زمان را انتخاب کن.");
      return;
    }
    window.open(
      `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  // =========================
  // Gallery (Swipe)
  // =========================
  function renderDots(total, active) {
    if (!dom.galleryDots) return;
    dom.galleryDots.innerHTML = "";
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement("div");
      dot.className = "gallery-dot" + (i === active ? " active" : "");
      dot.addEventListener("click", () => {
        state.galleryIndex = i;
        renderGallery();
        restartAuto();
      });
      dom.galleryDots.appendChild(dot);
    }
  }

  function renderGallery() {
    if (!dom.galleryImage || !GALLERY.length) return;
    const total = GALLERY.length;
    state.galleryIndex = ((state.galleryIndex % total) + total) % total;
    dom.galleryImage.setAttribute(
      "src",
      encodeURI(GALLERY[state.galleryIndex]),
    );
    renderDots(total, state.galleryIndex);
  }

  function restartAuto() {
    clearInterval(state.autoTimer);
    state.autoTimer = setInterval(() => {
      state.galleryIndex += 1;
      renderGallery();
    }, 4500);
  }

  function swipeToNext(dir) {
    if (GALLERY.length <= 1) return;
    state.galleryIndex += dir;
    renderGallery();
    restartAuto();
  }

  function onPointerDown(e) {
    state.swipe.active = true;
    state.swipe.locked = false;
    state.swipe.startX = e.clientX;
    state.swipe.startY = e.clientY;
    try {
      dom.galleryCard?.setPointerCapture(e.pointerId);
    } catch {}
  }

  function onPointerMove(e) {
    if (!state.swipe.active) return;

    const dx = e.clientX - state.swipe.startX;
    const dy = e.clientY - state.swipe.startY;

    if (!state.swipe.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy))
        state.swipe.locked = true;
      else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx))
        state.swipe.active = false;
    }
    if (state.swipe.locked) e.preventDefault();
  }

  function onPointerUp(e) {
    if (!state.swipe.active) return;
    const dx = e.clientX - state.swipe.startX;
    state.swipe.active = false;

    if (Math.abs(dx) >= 45) {
      // RTL: drag left => next
      if (dx < 0) swipeToNext(+1);
      else swipeToNext(-1);
    }
  }

  // =========================
  // Scroll helpers
  // =========================
  function focusBooking() {
    dom.bookingPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =========================
  // Events
  // =========================
  dom.toggleHelp?.addEventListener("click", () =>
    dom.helpPanel?.classList.toggle("app-hidden"),
  );

  dom.focusFooter?.addEventListener("click", () => {
    dom.footer?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  dom.focusBooking?.addEventListener("click", focusBooking);
  dom.heroCta?.addEventListener("click", focusBooking);
  dom.startWhatsapp?.addEventListener("click", openWhatsapp);

  dom.scrollTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  dom.toastClose?.addEventListener("click", () =>
    dom.toast?.classList.add("app-hidden"),
  );

  if (dom.galleryCard) {
    dom.galleryCard.addEventListener("pointerdown", onPointerDown, {
      passive: true,
    });
    dom.galleryCard.addEventListener("pointermove", onPointerMove, {
      passive: false,
    });
    dom.galleryCard.addEventListener("pointerup", onPointerUp, {
      passive: true,
    });
    dom.galleryCard.addEventListener("pointercancel", onPointerUp, {
      passive: true,
    });
    dom.galleryCard.addEventListener(
      "lostpointercapture",
      () => (state.swipe.active = false),
    );
  }

  // =========================
  // Init
  // =========================
  if (dom.footerYear)
    dom.footerYear.textContent = String(new Date().getFullYear());

  renderServicesInline();
  renderDateChips();
  syncSummary();

  renderGallery();
  restartAuto();
})();
