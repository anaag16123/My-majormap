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

function plural(count, singular, several) {
    return `${count} ${count === 1 ? singular : several}`;
}

// Samu: mensaje de bloqueo con la causa, las alternativas cercanas y las habilitadas.
function createBlocking(blocking, onApplyAlternative) {
    const panel = createElement("article", "surface blocking-panel");
    panel.append(
        createElement("span", "eyebrow", "SIN COMBINACIONES"),
        createElement("h3", "", "No hay propuestas con estos límites"),
        createElement("p", "blocking-reason", blocking.explicacion)
    );

    const columns = createElement("div", "blocking-columns");

    const options = createElement("section");
    options.append(createElement("h4", "", "Lo más cercano que sí funciona"));
    if (blocking.alternativas.length) {
        const list = createElement("ul", "blocking-list");
        for (const alternative of blocking.alternativas) {
            const item = createElement("li");
            const label = createElement("span", "blocking-option");
            label.append(
                createElement("span", "", alternative.descripcion),
                createElement("span", "badge",
                    `${plural(alternative.cantidad, "materia", "materias")} · máx. ${alternative.maxCreditos} cr`)
            );
            item.append(label);
            if (onApplyAlternative) {
                // Samu (HU2): aplicar la alternativa con un clic y recalcular.
                const apply = createElement("button", "button button-secondary", "Usar esta opción");
                apply.type = "button";
                apply.addEventListener("click", () => {
                    byId("course-count").value = alternative.cantidad;
                    byId("credit-limit").value = alternative.maxCreditos;
                    onApplyAlternative({ quantity: alternative.cantidad, credits: alternative.maxCreditos });
                });
                item.append(apply);
            }
            list.append(item);
        }
        options.append(list);
    } else {
        options.append(createElement("p", "muted small",
            `No encontramos una alternativa dentro del tope de ${blocking.topeCreditos} créditos por semestre.`));
    }
    const link = createElement("a", "text-link", "Actualizar mis aprobadas →");
    link.href = "#pensum";
    options.append(link);
    columns.append(options);

    const available = createElement("section");
    available.append(createElement("h4", "", `Materias habilitadas (${blocking.habilitadas.length})`));
    if (blocking.habilitadas.length) {
        const list = createElement("ul", "blocking-list");
        for (const course of blocking.habilitadas) {
            const item = createElement("li");
            const label = createElement("span");
            label.append(createElement("b", "", course.codigo), document.createTextNode(course.nombre));
            item.append(label, createElement("small", "", `${course.creditos} cr`));
            list.append(item);
        }
        available.append(list);
    } else {
        available.append(createElement("p", "muted small", "Ahora mismo no tienes materias habilitadas."));
    }
    columns.append(available);

    panel.append(columns);
    return panel;
}

export function updatePlanner(planning, onPageChange, onApplyAlternative = null) {
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
        // Samu: explicación del bloqueo. Sin diagnóstico se mantiene el mensaje general.
        host.append(planning.blocking?.bloqueado ? createBlocking(planning.blocking, onApplyAlternative) : createEmptyState(
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
    const form = byId("planner-form");
    const count = byId("course-count");
    const credits = byId("credit-limit");
    const preference = byId("preference");
    count.value = planning.quantity;
    credits.value = planning.credits;
    preference.value = planning.preference;
    count.max = Math.max(summary.total, 1);

    function readParameters() {
        return { quantity: Number(count.value), credits: Number(credits.value), preference: preference.value };
    }

    // Samu (HU2): el segundo argumento indica si los valores son válidos para recalcular.
    [count, credits].forEach(input => input.addEventListener("input", () => {
        handlers.onParametersChange(readParameters(), form.checkValidity());
    }));
    preference.addEventListener("change", () => {
        handlers.onParametersChange(readParameters(), form.checkValidity());
    });

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (form.reportValidity()) handlers.onGenerate(readParameters());
    });

    updatePlanner(planning, handlers.onPageChange, handlers.onApplyAlternative);
}
