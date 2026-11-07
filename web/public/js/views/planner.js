import { byId, createElement, createEmptyState } from "../dom.js";
import { summarize } from "../state.js";

const PAGE_SIZE = 9;

function createProposal(proposal, number) {
    const card = createElement("article", "surface proposal-card");
    card.append(
        createElement("h3", "", `Opción ${number}`),
        createElement("span", "badge", `${proposal.creditos} créditos · ${proposal.materias.length} materias`)
    );

    const list = createElement("ul");
    for (const course of proposal.materias) {
        const item = createElement("li");
        const label = createElement("span");
        label.append(createElement("b", "", course.codigo), document.createTextNode(course.nombre));
        item.append(label, createElement("small", "", `${course.creditos} cr`));
        list.append(item);
    }
    card.append(list);
    return card;
}

export function updatePlanner(planning, onPageChange) {
    const host = byId("proposal-results");
    const button = byId("generate-button");
    button.disabled = planning.loading;
    button.textContent = planning.loading ? "Buscando tus opciones…" : "Encontrar mis opciones ↗";
    host.setAttribute("aria-busy", String(planning.loading));
    host.replaceChildren();

    if (planning.loading) {
        host.append(createElement("p", "loading-state", "Revisando combinaciones, créditos y requisitos…"));
        return;
    }
    if (planning.error) {
        host.append(createEmptyState("No pudimos calcular tus opciones", planning.error));
        return;
    }
    if (planning.proposals === null) {
        host.append(createEmptyState("Tus opciones aparecerán aquí", "Completa el formulario y pulsa Encontrar mis opciones."));
        return;
    }

    const heading = createElement("div", "section-heading");
    const copy = createElement("div");
    copy.append(
        createElement("span", "eyebrow", "TUS POSIBILIDADES"),
        createElement("h2", "", "Opciones para tu próximo semestre"),
        createElement("p", "muted small", `Exactamente ${planning.quantity} materias y máximo ${planning.credits} créditos. Sin priorización.`)
    );
    heading.append(copy, createElement("span", "badge", `${planning.proposals.length} opciones`));
    host.append(heading);

    if (!planning.proposals.length) {
        host.append(createEmptyState(
            "Probemos con otra carga",
            "No hay combinaciones con estos límites. Prueba una cantidad menor, más créditos o revisa tus aprobadas y correquisitos."
        ));
        return;
    }

    const grid = createElement("div", "proposal-grid");
    const start = planning.page * PAGE_SIZE;
    planning.proposals.slice(start, start + PAGE_SIZE).forEach((proposal, index) => {
        grid.append(createProposal(proposal, start + index + 1));
    });
    host.append(grid);

    const totalPages = Math.ceil(planning.proposals.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    const pagination = createElement("nav", "pagination");
    pagination.setAttribute("aria-label", "Páginas de propuestas");
    const previous = createElement("button", "button button-secondary", "← Anterior");
    const next = createElement("button", "button button-secondary", "Siguiente →");
    previous.type = next.type = "button";
    previous.disabled = planning.page === 0;
    next.disabled = planning.page === totalPages - 1;
    previous.onclick = () => onPageChange(planning.page - 1);
    next.onclick = () => onPageChange(planning.page + 1);
    pagination.append(previous, createElement("span", "", `${planning.page + 1} / ${totalPages}`), next);
    host.append(pagination);
}

export function mountPlanner(pensum, planning, handlers) {
    const summary = summarize(pensum);
    byId("planner-summary").textContent = `${summary.approved} materias aprobadas y ${summary.available} habilitadas en tu catálogo actual.`;
    const count = byId("course-count");
    const credits = byId("credit-limit");
    count.value = planning.quantity;
    credits.value = planning.credits;
    count.max = Math.max(summary.total, 1);

    function readParameters() {
        return { quantity: Number(count.value), credits: Number(credits.value) };
    }

    [count, credits].forEach(input => input.addEventListener("input", () => {
        handlers.onParametersChange(readParameters());
    }));

    byId("planner-form").addEventListener("submit", event => {
        event.preventDefault();
        if (byId("planner-form").reportValidity()) handlers.onGenerate(readParameters());
    });

    updatePlanner(planning, handlers.onPageChange);
}
