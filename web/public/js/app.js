import { api, loadTemplate } from "./api.js";
import { byId, createElement, createEmptyState, showMessage } from "./dom.js";
import { state, createPlanningState } from "./state.js";
import { currentRoute, initializeNavigation } from "./navigation.js";
import { initializeDetails } from "./details.js";
import { mountHome } from "./views/home.js";
import { mountPensum } from "./views/pensum.js";
import { mountPlanner, updatePlanner } from "./views/planner.js";

// Contadores separados evitan mostrar respuestas antiguas tras otra acción.
let routeRequest = 0;
let catalogRequest = 0;
let detailRequest = 0;
let proposalRequest = 0;
let details = null;
let mountedRoute = null;

const PAGE_TITLES = {
    inicio: "Inicio",
    pensum: "Mi pensum",
    planificar: "Planear semestre",
    ayuda: "Ayuda"
};

function invalidateProposals() {
    ++proposalRequest;
    Object.assign(state.planning, {
        proposals: null,
        page: 0,
        loading: false,
        error: ""
    });
}

function updateVisiblePlanner() {
    if (mountedRoute === "planificar") {
        updatePlanner(state.planning, changeProposalPage);
    }
}

function changeProposalPage(page) {
    state.planning.page = page;
    updateVisiblePlanner();
    byId("proposal-results").scrollIntoView({ block: "start" });
}

function changeParameters(parameters) {
    Object.assign(state.planning, parameters);
    invalidateProposals();
    updateVisiblePlanner();
}

async function renderRoute(route = currentRoute(), moveFocus = false) {
    const requestId = ++routeRequest;
    if (moveFocus) {
        ++detailRequest;
        details?.close();
    }
    const root = byId("contenido");
    mountedRoute = null;
    root.setAttribute("aria-busy", "true");
    document.title = `${PAGE_TITLES[route]} · My MajorMap`;

    if (route !== "ayuda" && !state.pensum) {
        root.replaceChildren(state.loading
            ? createElement("p", "loading-state", "Cargando tu catálogo…")
            : createEmptyState("No pudimos cargar tu catálogo", state.loadError || "Comprueba que el servidor esté en ejecución."));
        root.setAttribute("aria-busy", String(state.loading));
        return;
    }

    // No quedan controles activos de una vista anterior mientras carga la siguiente.
    root.replaceChildren(createElement("p", "loading-state", "Abriendo tu espacio…"));
    try {
        const template = await loadTemplate(`views/${route}.html`);
        if (requestId !== routeRequest) return;
        // Solo se inserta HTML estático del proyecto. Los datos se pintan como texto.
        root.innerHTML = template;
        mountedRoute = route;

        if (route === "inicio") mountHome(state.pensum);
        if (route === "pensum") {
            mountPensum(state.pensum, state.filters, {
                onFilterChange: changes => Object.assign(state.filters, changes),
                onOpenCourse: openCourse
            });
        }
        if (route === "planificar") {
            mountPlanner(state.pensum, state.planning, {
                onGenerate: generateProposals,
                onParametersChange: changeParameters,
                onPageChange: changeProposalPage
            });
        }

        root.setAttribute("aria-busy", "false");
        if (moveFocus) {
            root.focus({ preventScroll: true });
            window.scrollTo({ top: 0 });
        }
    } catch (error) {
        if (requestId !== routeRequest) return;
        mountedRoute = null;
        root.replaceChildren(createEmptyState("Esta vista no pudo abrirse", error.message));
        root.setAttribute("aria-busy", "false");
        showMessage(error.message, "error", () => renderRoute(currentRoute()));
    }
}

async function loadPensum() {
    const requestId = ++catalogRequest;
    const career = byId("career-select").value;
    ++detailRequest;
    ++state.revision;
    state.loading = true;
    state.loadError = "";
    state.pensum = null;
    state.filters = { search: "", status: "TODAS" };
    invalidateProposals();
    details?.close();
    showMessage("");
    renderRoute();

    try {
        const pensum = await api.getPensum(career);
        if (requestId !== catalogRequest) return;
        state.pensum = pensum;
        state.loading = false;
        state.planning = createPlanningState();
        await renderRoute();
    } catch (error) {
        if (requestId !== catalogRequest) return;
        state.loading = false;
        state.loadError = error.message;
        await renderRoute();
        showMessage(error.message, "error", loadPensum);
    }
}

async function openCourse(code) {
    if (!state.pensum || state.updating) return;
    const requestId = ++detailRequest;
    const revision = state.revision;
    const career = state.pensum.carrera;

    try {
        const course = await api.getCourse(career, code);
        if (requestId !== detailRequest || revision !== state.revision) return;
        details.open({ ...course, career });
    } catch (error) {
        if (requestId === detailRequest) showMessage(error.message, "error", () => openCourse(code));
    }
}

async function toggleApproved(course) {
    if (state.updating || !state.pensum) return;
    state.updating = true;
    byId("career-select").disabled = true;
    const revision = state.revision;

    try {
        const pensum = await api.setApproved(course.career, course.codigo, course.estado !== "APROBADA");
        if (revision !== state.revision) return;
        state.pensum = pensum;
        ++state.revision;
        ++detailRequest;
        invalidateProposals();
        details.close();
        await renderRoute();
        showMessage("Tu avance se actualizó. Las materias habilitadas se recalcularon.", "success");
    } catch (error) {
        showMessage(error.message);
        throw error; // El diálogo muestra el error y vuelve a habilitar el botón.
    } finally {
        state.updating = false;
        byId("career-select").disabled = false;
    }
}

async function generateProposals({ quantity, credits, esExigente = false, mode = "suave" }) {
    if (!state.pensum || state.updating || state.planning.loading) return;
    if (!Number.isInteger(quantity) || !Number.isInteger(credits) ||
        quantity <= 0 || credits <= 0 || credits > 24) {
        showMessage("Escribe una cantidad positiva y un máximo de hasta 24 créditos.");
        return;
    }

    const requestId = ++proposalRequest;
    const revision = state.revision;
    const career = state.pensum.carrera;
    Object.assign(state.planning, { quantity, credits, esExigente, mode, proposals: null, page: 0, loading: true, error: "" });
    updateVisiblePlanner();
    showMessage("");

    try {
        const result = await api.getProposals(career, quantity, credits, esExigente);
        if (requestId !== proposalRequest || revision !== state.revision) return;
        state.planning.proposals = result.propuestas;
    } catch (error) {
        if (requestId !== proposalRequest || revision !== state.revision) return;
        state.planning.error = error.message;
    } finally {
        if (requestId === proposalRequest && revision === state.revision) {
            state.planning.loading = false;
            updateVisiblePlanner();
            if (mountedRoute === "planificar") byId("proposal-results").scrollIntoView({ block: "start" });
        }
    }
}

async function initializeData() {
    state.loading = true;
    state.loadError = "";
    showMessage("");
    byId("career-select").disabled = true;
    renderRoute();

    try {
        // Se carga una vez; no se duplican listeners al reintentar las carreras.
        if (!details) details = await initializeDetails(toggleApproved, () => { ++detailRequest; });
        const careers = await api.getCareers();
        if (!careers.length) throw new Error("El servidor no tiene carreras cargadas.");

        const select = byId("career-select");
        select.replaceChildren();
        for (const career of careers) select.add(new Option(career.nombre, career.id));
        if (careers.some(career => career.id === "sistemas")) select.value = "sistemas";
        select.disabled = false;
        await loadPensum();
    } catch (error) {
        state.loading = false;
        state.loadError = error.message;
        await renderRoute();
        showMessage(error.message, "error", initializeData);
    }
}

byId("career-select").addEventListener("change", loadPensum);
initializeNavigation(route => renderRoute(route, true));
initializeData();
