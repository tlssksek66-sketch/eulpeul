(function () {
    "use strict";

    const root = document.querySelector(".brand--shokz");
    if (!root) return;

    const yearEl = root.querySelector("[data-year]");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const cards = root.querySelectorAll(".lineup-card");
    cards.forEach((card) => {
        card.addEventListener("mouseenter", () => card.classList.add("is-hover"));
        card.addEventListener("mouseleave", () => card.classList.remove("is-hover"));
    });
})();
