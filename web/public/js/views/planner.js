import { byId, createElement, createEmptyState } from "../dom.js";
import { summarize } from "../state.js";

const PAGE_SIZE = 9;

/**
 * Crea la tarjeta visual (card) para una propuesta de matrícula ordenada.
 * Aplica clases CSS vinculadas a las variables globales de :root.
 * @param {Object} proposal - Propuesta con { creditos, dificultadTotal, materias }
 * @param {number} number - Número de opción
 * @param {boolean} esExigente - true si es modo exigente, false para suave
 * @returns {HTMLElement} Elemento article representativo
 */
export function createProposalCard(proposal, number, esExigente) {
    const card = createElement("article", "surface proposal-card");

    // Cabecera de la propuesta: Número y Badges
    const header = createElement("div", "proposal-header");
    const title = createElement("h3", "", `Opción ${number}`);
    header.append(title);

    // Contenedor de badges informativos
    const badges = createElement("div", "proposal-badges");

    // Badge de modalidad
    const modeBadge = createElement(
        "span",
        `badge-tag ${esExigente ? "badge-exigente" : "badge-suave"}`,
        esExigente ? "🔥 Exigente" : "🍃 Suave"
    );

    // Badge de créditos
    const creditsBadge = createElement(
        "span",
        "badge-tag badge-creditos",
        `${proposal.creditos} créditos`
    );

    badges.append(modeBadge, creditsBadge);

    // Badge de dificultad acumulada
    if (proposal.dificultadTotal !== undefined) {
        const diffBadge = createElement(
            "span",
            "badge-tag badge-dificultad",
            `Dificultad: ${proposal.dificultadTotal} pts`
        );
        badges.append(diffBadge);
    }

    // Lista de materias de la propuesta
    const list = createElement("ul");
    for (const course of proposal.materias) {
        const item = createElement("li");

        const info = createElement("div", "materia-info");
        const code = createElement("b", "", course.codigo);
        const name = createElement("span", "materia-nombre", course.nombre);
        info.append(code, name);

        const details = createElement("div", "materia-detalles");
        if (course.dificultad !== undefined) {
            const diffText = createElement("span", "materia-dificultad", `Dif: ${course.dificultad}/5`);
            details.append(diffText);
        }
        const credits = createElement("span", "materia-creditos", `${course.creditos} cr`);
        details.append(credits);

        item.append(info, details);
        list.append(item);
    }

    card.append(header, badges, list);
    return card;
}

/**
 * Renderiza el arreglo de propuestas en el contenedor <div id="lista-propuestas"></div>
 * @param {Array} propuestas - Lista de propuestas devueltas por el servidor C++
 * @param {HTMLElement} contenedor - Elemento del DOM donde se insertarán las cards
 * @param {boolean} esExigente - Modo de ordenamiento aplicado
 */
export function renderizarPropuestas(propuestas, contenedor, esExigente) {
    contenedor.replaceChildren();

    if (!propuestas || propuestas.length === 0) {
        contenedor.append(createEmptyState(
            "Probemos con otra carga",
            "No hay combinaciones con estos límites. Prueba una cantidad menor, más créditos o revisa tus aprobadas y correquisitos."
        ));
        return;
    }

    propuestas.forEach((propuesta, index) => {
        const card = createProposalCard(propuesta, index + 1, esExigente);
        contenedor.append(card);
    });
}

/**
 * Envía los parámetros al servidor C++ mediante fetch(), procesa el JSON
 * y renderiza las tarjetas en <div id="lista-propuestas"></div>.
 * @param {Object} params - { carrera, cantidad, creditos, esExigente }
 */
export async function fetchYRenderizarPropuestas({ carrera, cantidad, creditos, esExigente }) {
    const contenedor = document.getElementById("lista-propuestas") || byId("proposal-results");
    const boton = byId("generate-button");

    try {
        if (boton) {
            boton.disabled = true;
            boton.textContent = "Buscando tus opciones…";
        }
        contenedor.replaceChildren(createElement("p", "loading-state", "Calculando combinaciones y ordenando por exigencia en C++…"));

        // Petición al endpoint /api/propuestas implementado en httplib C++
        const url = `/api/propuestas?carrera=${encodeURIComponent(carrera)}&cantidad=${cantidad}&creditos=${creditos}&exigente=${esExigente}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Error ${response.status}: No se pudieron obtener las propuestas.`);
        }

        const data = await response.json();
        renderizarPropuestas(data.propuestas || [], contenedor, esExigente);
    } catch (error) {
        contenedor.replaceChildren(createEmptyState("No pudimos calcular tus opciones", error.message));
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = "Generar propuestas ↗";
        }
    }
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

/**
 * Actualiza la vista de planificación dentro del ciclo de vida del SPA
 */
export function updatePlanner(planning, onPageChange, onApplyAlternative = null) {
    const host = byId("proposal-results");
    const listaPropuestas = document.getElementById("lista-propuestas");
    const button = byId("generate-button");

    button.disabled = planning.loading;
    button.textContent = planning.loading ? "Buscando tus opciones…" : "Generar propuestas ↗";
    host.setAttribute("aria-busy", String(planning.loading));

    if (planning.loading) {
        host.replaceChildren(createElement("p", "loading-state", "Revisando combinaciones, créditos y requisitos…"));
        return;
    }
    if (planning.error) {
        host.replaceChildren(createEmptyState("No pudimos calcular tus opciones", planning.error));
        return;
    }
    if (planning.proposals === null) {
        host.replaceChildren(createEmptyState("Tus opciones aparecerán aquí", "Completa el formulario y pulsa Generar propuestas."));
        return;
    }

    const esExigente = Boolean(planning.esExigente);
    const heading = createElement("div", "section-heading");
    const copy = createElement("div");
    copy.append(
        createElement("span", "eyebrow", "TUS POSIBILIDADES"),
        createElement("h2", "", "Opciones para tu próximo semestre"),
        createElement(
            "p",
            "muted small",
            `Exactamente ${planning.quantity} materias y máx. ${planning.credits} créditos · Orden: Modo ${esExigente ? "Exigente (mayor dificultad primero)" : "Suave (menor dificultad y carga)"}.`
        )
    );
    heading.append(copy, createElement("span", "badge", `${planning.proposals.length} opciones`));

    host.replaceChildren(heading);

    if (!planning.proposals.length) {
        // Samu: explicación del bloqueo. Sin diagnóstico se mantiene el mensaje general.
        host.append(planning.blocking?.bloqueado ? createBlocking(planning.blocking, onApplyAlternative) : createEmptyState(
            "Probemos con otra carga",
            "No hay combinaciones con estos límites. Prueba una cantidad menor, más créditos o revisa tus aprobadas y correquisitos."
        ));
        return;
    }

    // Contenedor principal de tarjetas
    const grid = listaPropuestas || createElement("div", "proposal-grid");
    grid.id = "lista-propuestas";
    grid.className = "proposal-grid";
    grid.replaceChildren();

    const start = planning.page * PAGE_SIZE;
    const items = planning.proposals.slice(start, start + PAGE_SIZE);
    items.forEach((proposal, index) => {
        grid.append(createProposalCard(proposal, start + index + 1, esExigente));
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

/**
 * Monta los controladores del formulario en la vista
 */
export function mountPlanner(pensum, planning, handlers) {
    const summary = summarize(pensum);
    const summaryEl = document.getElementById("planner-summary");
    if (summaryEl) {
        summaryEl.textContent = `${summary.approved} materias aprobadas y ${summary.available} habilitadas en ${pensum.nombre}.`;
    }

    const count = byId("course-count");
    const credits = byId("credit-limit");
    const prefSelect = document.getElementById("preference-mode");
    const trajectorySelect = document.getElementById("professional-trajectories");
    const flexibleText = document.getElementById("flexible-trajectories");
    const professionalGroups = [...new Set(pensum.materias
        .filter(course => course.tipo?.startsWith("Trayectoria Profesionalizante: "))
        .map(course => course.tipo.slice("Trayectoria Profesionalizante: ".length)))];
    const flexibleGroups = [...new Set(pensum.materias
        .filter(course => course.tipo?.startsWith("Trayectoria Flexible: "))
        .map(course => course.tipo.slice("Trayectoria Flexible: ".length)))];

    if (trajectorySelect) {
        trajectorySelect.replaceChildren();
        professionalGroups.forEach(group => {
            const option = createElement("option", "", group);
            option.value = group;
            option.selected = planning.trajectories.includes(group);
            trajectorySelect.append(option);
        });
        trajectorySelect.required = professionalGroups.length >= 2;
        trajectorySelect.disabled = professionalGroups.length < 2;
    }
    if (flexibleText) {
        flexibleText.textContent = flexibleGroups.length
            ? `Trayectorias flexibles disponibles: ${flexibleGroups.join(", ")}.`
            : "Esta carrera no tiene trayectorias flexibles registradas.";
    }

    count.value = planning.quantity;
    credits.value = planning.credits;
    count.max = Math.max(summary.total, 1);
    credits.max = 24;

    if (prefSelect && planning.mode) {
        prefSelect.value = planning.mode;
    }

    function readParameters() {
        const modo = prefSelect ? prefSelect.value : "suave";
        return {
            quantity: Number(count.value),
            credits: Number(credits.value),
            mode: modo,
            esExigente: modo === "exigente",
            trajectories: trajectorySelect
                ? Array.from(trajectorySelect.selectedOptions, option => option.value)
                : []
        };
    }

    // Samu (HU2): el segundo argumento indica si los valores son válidos para recalcular.
    const form = byId("planner-form");
    [count, credits].forEach(input => input.addEventListener("input", () => {
        handlers.onParametersChange(readParameters(), form.checkValidity());
    }));
    trajectorySelect?.addEventListener("change", () => {
        const selected = readParameters().trajectories;
        if (selected.length > 2) {
            trajectorySelect.options[trajectorySelect.selectedIndex].selected = false;
            return;
        }
        handlers.onParametersChange(readParameters());
    });

    if (prefSelect) {
        prefSelect.addEventListener("change", () => {
            handlers.onParametersChange(readParameters(), form.checkValidity());
        });
    }

    // Captura del evento submit del formulario
    byId("planner-form").addEventListener("submit", event => {
        event.preventDefault();
        const params = readParameters();

        if (params.credits > 24) {
            alert("El límite máximo de créditos es 24.");
            return;
        }
        if (professionalGroups.length >= 2 && params.trajectories.length !== 2) {
            alert("Selecciona exactamente dos trayectorias profesionalizantes.");
            return;
        }

        if (byId("planner-form").reportValidity()) {
            handlers.onGenerate(params);
        }
    });

    updatePlanner(planning, handlers.onPageChange, handlers.onApplyAlternative);
}
