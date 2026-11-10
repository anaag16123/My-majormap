import { api, loadTemplate } from "./api.js";
import { byId, createElement, createEmptyState, showMessage } from "./dom.js";
import { state, createPlanningState, loadCustomConfig } from "./state.js";
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
        blocking: null,
        page: 0,
        loading: false,
        error: ""
    });
}

function updateVisiblePlanner() {
    if (mountedRoute === "planificar") {
        updatePlanner(state.planning, changeProposalPage, applyAlternative);
    }
}

function changeProposalPage(page) {
    state.planning.page = page;
    updateVisiblePlanner();
    byId("proposal-results").scrollIntoView({ block: "start" });
}

// Samu: recalcular. Una vez que el estudiante pidió propuestas, se vuelven a
// calcular solas al cambiar aprobadas, cantidad, créditos o preferencia.
const RECALCULATE_DELAY = 350;
let recalculateTimer = null;

function recalculateProposals() {
    clearTimeout(recalculateTimer);
    if (!state.planning.requested) return;
    if (state.planning.loading) {
        // Se descarta la consulta en curso; quedó con parámetros viejos.
        ++proposalRequest;
        state.planning.loading = false;
    }
    const { quantity, credits, esExigente, mode } = state.planning;
    generateProposals({ quantity, credits, esExigente, mode }, { automatic: true });
}

function changeParameters(parameters, valid = true) {
    Object.assign(state.planning, parameters);
    clearTimeout(recalculateTimer);
    if (state.planning.requested && valid) {
        // Se espera a que el estudiante termine de escribir antes de consultar.
        if (state.planning.loading) {
            ++proposalRequest;
            state.planning.loading = false;
            updateVisiblePlanner();
        }
        recalculateTimer = setTimeout(recalculateProposals, RECALCULATE_DELAY);
        return;
    }
    invalidateProposals();
    updateVisiblePlanner();
}

function applyAlternative({ quantity, credits }) {
    clearTimeout(recalculateTimer);
    if (state.planning.loading) {
        ++proposalRequest;
        state.planning.loading = false;
    }
    const { esExigente, mode } = state.planning;
    generateProposals({ quantity, credits, esExigente, mode });
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
                onOpenCourse: openCourse,
                onConfigChange: newConfig => {
                    state.customConfig = newConfig;
                    if (state.planning && newConfig.profesionalizantes) {
                        state.planning.trajectories = [...newConfig.profesionalizantes];
                    }
                }
            });
        }
        if (route === "planificar") {
            mountPlanner(state.pensum, state.planning, {
                onGenerate: generateProposals,
                onParametersChange: changeParameters,
                onPageChange: changeProposalPage,
                onApplyAlternative: applyAlternative
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

function attachTrayectorias(pensum) {
    if (pensum && pensum.trayectorias && pensum.materias) {
        const map = new Map();
        for (const t of pensum.trayectorias) {
            if (!map.has(t.codigo)) map.set(t.codigo, []);
            map.get(t.codigo).push(t);
        }
        for (const m of pensum.materias) {
            m.trayectorias = map.get(m.codigo) || [];
        }
    }
    return pensum;
}

async function loadPensum() {
    const select = byId("career-select");
    const career = select.value;
    if (!career) return;
    try {
        localStorage.setItem("majormap_carrera", career);
    } catch {}

    const requestId = ++catalogRequest;
    ++detailRequest;
    ++state.revision;
    state.loading = true;
    state.loadError = "";
    state.pensum = null;
    state.filters = { search: "", status: "TODAS" };
    invalidateProposals();
    details?.close();
    select.disabled = true;
    showMessage("");
    renderRoute();

    try {
        const pensum = await api.getPensum(career);
        if (requestId !== catalogRequest) return;
        attachTrayectorias(pensum);
        state.pensum = pensum;
        state.customConfig = loadCustomConfig(career, pensum);
        state.loading = false;
        state.planning = createPlanningState();
        if (state.customConfig?.profesionalizantes) {
            state.planning.trajectories = [...state.customConfig.profesionalizantes];
        }
        const contextSub = byId("context-subtitle");
        if (contextSub && pensum.nombre) {
            contextSub.textContent = `${pensum.nombre} · Plan EAFIT`;
        }
        await renderRoute();
        showMessage(`Pensum de ${pensum.nombre} cargado correctamente.`, "success");
    } catch (error) {
        if (requestId !== catalogRequest) return;
        state.loading = false;
        state.loadError = error.message;
        await renderRoute();
        showMessage(error.message, "error", loadPensum);
    } finally {
        if (requestId === catalogRequest) {
            select.disabled = false;
        }
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
    let approvedChanged = false;

    try {
        const pensum = await api.setApproved(course.career, course.codigo, course.estado !== "APROBADA");
        if (revision !== state.revision) return;
        attachTrayectorias(pensum);
        state.pensum = pensum;
        ++state.revision;
        ++detailRequest;
        invalidateProposals();
        details.close();
        await renderRoute();
        showMessage(state.planning.requested
            ? "Tu avance se actualizó. Las materias habilitadas y tus propuestas se recalcularon."
            : "Tu avance se actualizó. Las materias habilitadas se recalcularon.", "success");
        approvedChanged = true;
    } catch (error) {
        showMessage(error.message);
        throw error; // El diálogo muestra el error y vuelve a habilitar el botón.
    } finally {
        state.updating = false;
        byId("career-select").disabled = false;
    }
    // Samu: con las nuevas aprobadas se recalculan las propuestas que ya se habían pedido.
    if (approvedChanged) recalculateProposals();
}

// automatic = true cuando lo dispara el recalcular: no borra avisos ni mueve la página.
async function generateProposals({
    quantity,
    credits,
    esExigente = state.planning.esExigente,
    mode = state.planning.mode
}, { automatic = false } = {}) {
    if (!state.pensum || state.updating || state.planning.loading) return;
    if (!Number.isInteger(quantity) || !Number.isInteger(credits) ||
        quantity <= 0 || credits <= 0 || credits > 24 ||
        (state.pensum.materias.some(course => course.tipo?.startsWith("Trayectoria Profesionalizante:")) &&
            state.planning.trajectories.length !== 2)) {
        if (!automatic) showMessage("Escribe una cantidad positiva y un máximo de hasta 24 créditos.");
        return;
    }

    clearTimeout(recalculateTimer);
    const requestId = ++proposalRequest;
    const revision = state.revision;
    const career = state.pensum.carrera;
    Object.assign(state.planning, {
        quantity, credits, esExigente, mode, requested: true,
        proposals: null, blocking: null, page: 0, loading: true, error: ""
    });
    updateVisiblePlanner();
    if (!automatic) showMessage("");

    try {
        const result = await api.getProposals(career, quantity, credits, esExigente, state.planning.trajectories);
        if (requestId !== proposalRequest || revision !== state.revision) return;
        let blocking = null;
        if (!result.propuestas.length) {
            // Samu: sin propuestas se pide la explicación del bloqueo y las alternativas.
            // Si esta consulta falla, la vista muestra el mensaje general.
            try {
                blocking = await api.getBlocking(career, quantity, credits, state.planning.trajectories);
            } catch {
                blocking = null;
            }
            if (requestId !== proposalRequest || revision !== state.revision) return;
        }
        state.planning.limited = Boolean(result.limitado);
        state.planning.proposals = result.propuestas;
        state.planning.blocking = blocking;
    } catch (error) {
        if (requestId !== proposalRequest || revision !== state.revision) return;
        state.planning.error = error.message;
    } finally {
        if (requestId === proposalRequest && revision === state.revision) {
            state.planning.loading = false;
            updateVisiblePlanner();
            if (!automatic && mountedRoute === "planificar") byId("proposal-results").scrollIntoView({ block: "start" });
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

        let savedCareer = null;
        try {
            savedCareer = localStorage.getItem("majormap_carrera");
        } catch {}

        if (savedCareer && careers.some(career => career.id === savedCareer)) {
            select.value = savedCareer;
        } else if (careers.some(career => career.id === "sistemas")) {
            select.value = "sistemas";
        }
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
