import { byId, createElement } from "../dom.js";
import { summarize } from "../state.js";

export function mountHome(pensum) {
    const summary = summarize(pensum);
    const host = byId("progress-cards");
    const metrics = [
        ["Materias aprobadas", summary.approved, `De ${summary.total} materias cargadas`],
        ["Puedes cursar", summary.available, "Revisa sus correquisitos"],
        ["Créditos aprobados", summary.approvedCredits, `De ${summary.totalCredits} cargados`],
        ["Tu avance", `${summary.percentage}%`, "Sobre las materias cargadas"]
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
}
