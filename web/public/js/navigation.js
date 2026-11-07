/** Navegación por vistas: enlaces reales con historial Atrás/Adelante. */
const ROUTES = new Set(["inicio", "pensum", "planificar", "ayuda"]);

export function currentRoute() {
    const route = location.hash.slice(1);
    return ROUTES.has(route) ? route : "inicio";
}

export function initializeNavigation(onNavigate) {
    const menu = document.getElementById("main-nav");
    const toggle = document.getElementById("menu-toggle");

    function closeMenu() {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
    }

    function updateRoute() {
        const route = currentRoute();
        document.querySelectorAll("[data-route]").forEach(link => {
            if (link.dataset.route === route) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
        closeMenu();
        onNavigate(route);
    }

    toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        menu.classList.toggle("is-open", open);
    });

    menu.addEventListener("click", event => {
        if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            closeMenu();
            toggle.focus();
        }
    });

    document.querySelector(".skip-link").addEventListener("click", event => {
        event.preventDefault();
        document.getElementById("contenido").focus();
    });

    window.addEventListener("hashchange", updateRoute);
    updateRoute();
}
