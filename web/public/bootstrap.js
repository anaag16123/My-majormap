/** Comprueba los archivos y muestra errores de arranque sin depender de módulos. */
(() => {
    const requiredFiles = [
        "components/detalle.html",
        "css/base.css",
        "css/components.css",
        "css/layout.css",
        "css/responsive.css",
        "css/views.css",
        "estilos.css",
        "js/api.js",
        "js/app.js",
        "js/details.js",
        "js/dom.js",
        "js/navigation.js",
        "js/state.js",
        "js/views/home.js",
        "js/views/pensum.js",
        "js/views/planner.js",
        "views/ayuda.html",
        "views/inicio.html",
        "views/pensum.html",
        "views/planificar.html"
];

    function showStartupError(title, messages) {
        const root = document.getElementById("contenido");
        const card = document.createElement("section");
        card.className = "empty-state";
        const heading = document.createElement("strong");
        heading.textContent = title;
        const description = document.createElement("p");
        description.textContent = "Copia la carpeta public completa dentro de web. No copies solamente index.html o app.js.";
        const list = document.createElement("ul");
        for (const message of messages) {
            const item = document.createElement("li");
            item.textContent = message;
            list.append(item);
        }
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "button button-primary";
        retry.textContent = "Volver a intentar";
        retry.addEventListener("click", () => location.reload());
        card.append(heading, description, list, retry);
        root.replaceChildren(card);
        root.setAttribute("aria-busy", "false");
        const select = document.getElementById("career-select");
        select.replaceChildren(new Option("Error al cargar la interfaz", ""));
    }

    async function checkFile(path) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(path, { cache: "no-store", signal: controller.signal });
            if (!response.ok) return `${path}: HTTP ${response.status}`;
            const mime = response.headers.get("content-type") || "";
            if (path.endsWith(".js") && !/javascript/i.test(mime)) {
                return `${path}: tipo incorrecto (${mime || "sin Content-Type"})`;
            }
            return null;
        } catch (error) {
            return `${path}: ${error.name === "AbortError" ? "el servidor tardó demasiado" : "no se pudo descargar"}`;
        } finally {
            clearTimeout(timeout);
        }
    }

    async function start() {
        document.querySelector("#contenido p").textContent = "Comprobando los archivos de la interfaz…";
        const results = await Promise.all(requiredFiles.map(checkFile));
        const errors = results.filter(Boolean);
        if (errors.length) {
            showStartupError("No se pudieron cargar estos archivos", errors);
            return;
        }
        try {
            await import("./js/app.js?v=4");
        } catch (error) {
            showStartupError("JavaScript no pudo iniciar", [
                error.message,
                "Reemplaza los archivos JavaScript por los originales del ZIP y recarga con Command + Shift + R."
            ]);
        }
    }

    start().catch(error => showStartupError("No se pudo iniciar la interfaz", [error.message]));
})();
