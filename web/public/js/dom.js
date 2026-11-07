/** Utilidades de presentación. Los datos del servidor se insertan como texto. */
export const COURSE_STATES = {
    APROBADA: { label: "Aprobada", className: "approved" },
    HABILITADA: { label: "Habilitada", className: "available" },
    BLOQUEADA: { label: "Bloqueada", className: "locked" }
};

export function byId(id) {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`Falta el elemento #${id} en la vista.`);
    }
    return node;
}

export function createElement(tag, className = "", text = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null) node.textContent = String(text);
    return node;
}

export function createStatus(state) {
    const info = COURSE_STATES[state] || COURSE_STATES.BLOQUEADA;
    return createElement("span", `status ${info.className}`, info.label);
}

export function showMessage(message, type = "error", onRetry = null) {
    const host = byId("app-status");
    host.replaceChildren();
    if (!message) return;

    const alert = createElement("div", type === "success" ? "alert alert-success" : "alert");
    alert.append(createElement("span", "", message));

    const button = createElement("button", "", onRetry ? "Reintentar" : "Cerrar");
    button.type = "button";
    button.addEventListener("click", onRetry || (() => host.replaceChildren()));
    alert.append(button);
    host.append(alert);
}

export function createEmptyState(title, description) {
    const block = createElement("div", "empty-state");
    block.append(createElement("strong", "", title), createElement("p", "", description));
    return block;
}
