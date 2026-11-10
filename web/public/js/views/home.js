import { byId, createElement } from "../dom.js";
import { state, summarize, loadCustomConfig } from "../state.js";

export function mountHome(pensum) {
    const heading = byId("progress-heading");
    if (heading && pensum?.nombre) {
        heading.textContent = `Tu avance en ${pensum.nombre}`;
    }

    if (!state.customConfig) {
        state.customConfig = loadCustomConfig(pensum.carrera, pensum);
    }
    const config = state.customConfig;
    const summary = summarize(pensum, config);
    const host = byId("progress-cards");
    host.replaceChildren();

    const isCustom = config && config.activo;
    const hintScope = isCustom ? "de tu plan configurado" : "del catálogo total";

    const metrics = [
        ["Materias aprobadas", summary.approved, `De ${summary.total} materias ${hintScope}`],
        ["Puedes cursar", summary.available, "Revisa sus correquisitos"],
        ["Créditos aprobados", summary.approvedCredits, `De ${summary.totalCredits} créditos ${hintScope}`],
        ["Tu avance", `${summary.percentage}%`, `Hacia la finalización ${hintScope}`]
    ];

    for (const [label, value, hint] of metrics) {
        const card = createElement("article", "surface metric-card");
        card.append(
            createElement("span", "metric-label", label),
            createElement("strong", "metric-value", value)
        );

        if (label === "Tu avance") {
            const progress = createElement("progress");
            progress.max = 100;
            progress.value = summary.percentage;
            progress.setAttribute("aria-label", "Porcentaje de materias aprobadas");
            card.append(progress);
        }

        card.append(createElement("small", "", hint));
        host.append(card);
    }

    const noteEl = document.querySelector("#progress-cards + p");
    if (noteEl) {
        noteEl.textContent = isCustom
            ? `Cálculos calculados sobre tu plan configurado (${summary.total} materias: 2 profesionalizantes, 1 flexible, 1 énfasis y 5 NFI).`
            : "Estos números corresponden al catálogo completo cargado.";
    }
}
