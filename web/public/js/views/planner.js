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

/**
 * Actualiza la vista de planificación dentro del ciclo de vida del SPA
 */
export function updatePlanner(planning, onPageChange) {
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
        summaryEl.textContent = `${summary.approved} materias aprobadas y ${summary.available} habilitadas en tu catálogo actual.`;
    }

    const count = byId("course-count");
    const credits = byId("credit-limit");
    const prefSelect = document.getElementById("preference-mode");

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
            esExigente: modo === "exigente"
        };
    }

    [count, credits].forEach(input => input.addEventListener("input", () => {
        handlers.onParametersChange(readParameters());
    }));

    if (prefSelect) {
        prefSelect.addEventListener("change", () => {
            handlers.onParametersChange(readParameters());
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

        if (byId("planner-form").reportValidity()) {
            handlers.onGenerate(params);
        }
    });

    updatePlanner(planning, handlers.onPageChange);
}
