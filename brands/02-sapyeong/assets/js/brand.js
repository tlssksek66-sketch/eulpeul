(function () {
    "use strict";

    const root = document.querySelector(".brand--sapyeong");
    if (!root) return;

    fetch("./brand.config.json", { cache: "no-cache" })
        .then((res) => (res.ok ? res.json() : null))
        .then((config) => {
            if (!config) return;
            const yearEl = root.querySelector("[data-year]");
            if (yearEl) yearEl.textContent = new Date().getFullYear();
        })
        .catch(() => {
            const yearEl = root.querySelector("[data-year]");
            if (yearEl) yearEl.textContent = new Date().getFullYear();
        });
})();
