import { byId, createElement, createStatus, COURSE_STATES } from "../dom.js";
import {
    state,
    filterCourses,
    getSemesterCount,
    getAvailablePathways,
    getDefaultCustomConfig,
    loadCustomConfig,
    saveCustomConfig,
    isCourseInCustomPlan,
    getCourseEffectiveSemester,
    validateNfiSelection
} from "../state.js";

function getCourseTypeBadge(tipo) {
    if (!tipo) return null;
    const t = tipo.trim();
    if (t.startsWith("Trayectoria Profesionalizante:")) {
        const name = t.substring("Trayectoria Profesionalizante:".length).trim();
        return createElement("span", "course-type-badge badge-prof", `Trayectoria: ${name}`);
    }
    if (t.startsWith("Trayectoria Flexible:")) {
        const name = t.substring("Trayectoria Flexible:".length).trim();
        return createElement("span", "course-type-badge badge-flex", `Flexible: ${name}`);
    }
    if (t.startsWith("Línea de Énfasis:") || t.startsWith("Linea de Enfasis:")) {
        const prefix = t.startsWith("Línea de Énfasis:") ? "Línea de Énfasis:" : "Linea de Enfasis:";
        const name = t.substring(prefix.length).trim();
        return createElement("span", "course-type-badge badge-enfasis", `Énfasis: ${name}`);
    }
    if (t === "NFI") {
        return createElement("span", "course-type-badge badge-nfi", "NFI");
    }
    if (t.startsWith("Básic") || t.startsWith("Basic")) {
        return createElement("span", "course-type-badge badge-basico", "Básico");
    }
    if (t.includes("Electiva")) {
        return createElement("span", "course-type-badge badge-electiva", t);
    }
    return null;
}

function createCourseCard(course, onOpenCourse) {
    const info = COURSE_STATES[course.estado] || COURSE_STATES.BLOQUEADA;
    const card = createElement("button", `course-card ${info.className}`);
    card.type = "button";
    const diffLabel = course.dificultad ? `, dificultad ${course.dificultad} de 5` : "";
    card.setAttribute("aria-label", `Ver detalle de ${course.nombre}${diffLabel}, ${info.label}`);

    const top = createElement("span", "course-card-top");
    top.append(createElement("span", "course-code", course.codigo), createStatus(course.estado));

    const typeBadge = getCourseTypeBadge(course.tipo);

    const bottom = createElement("span", "course-card-bottom");
    const meta = course.dificultad
        ? `${course.creditos} cr · Dif: ${course.dificultad}/5`
        : `${course.creditos} créditos`;
    bottom.append(
        createElement("span", "course-meta-info", meta),
        createElement("span", "", "Ver detalle ↗")
    );

    card.append(top);
    if (typeBadge) card.append(typeBadge);
    card.append(createElement("span", "course-name", course.nombre), bottom);
    card.addEventListener("click", () => onOpenCourse(course.codigo));
    return card;
}

function drawSemesters(pensum, filters, config, onOpenCourse) {
    const host = byId("semester-grid");
    const visible = filterCourses(pensum.materias, filters, config, pensum);
    host.replaceChildren();

    const activeTotal = config && config.activo
        ? pensum.materias.filter(c => isCourseInCustomPlan(c, config, pensum)).length
        : pensum.materias.filter(c => !c.tipo?.includes("Complementarias")).length;

    byId("search-summary").textContent = `${visible.length} de ${activeTotal} materias coinciden con tu búsqueda y filtro.`;

    const count = getSemesterCount(pensum, config);
    for (let semester = 1; semester <= count; semester++) {
        const allSemesterCourses = pensum.materias.filter(c => {
            const effSem = getCourseEffectiveSemester(c, config);
            return effSem === semester && isCourseInCustomPlan(c, config, pensum);
        });
        const courses = visible.filter(course => getCourseEffectiveSemester(course, config) === semester);
        const section = createElement("section", "surface semester");
        const header = createElement("div", "semester-header");
        const title = createElement("h2");
        title.append(
            createElement("span", "semester-number", semester),
            document.createTextNode(`Semestre ${semester}`)
        );
        const credits = allSemesterCourses.reduce((sum, course) => sum + course.creditos, 0);
        header.append(title, createElement("small", "", allSemesterCourses.length ? `${credits} créditos` : "Sin materias"));
        section.append(header);

        for (const course of courses) section.append(createCourseCard(course, onOpenCourse));

        if (!courses.length) {
            const text = allSemesterCourses.length
                ? "No hay materias que coincidan con el filtro en este semestre."
                : "Sin materias configuradas en este semestre.";
            section.append(createElement("p", "semester-empty", text));
        }

        host.append(section);
    }
}

export function mountPensum(pensum, filters, { onFilterChange, onOpenCourse, onConfigChange }) {
    if (!state.customConfig) {
        state.customConfig = loadCustomConfig(pensum.carrera, pensum);
    }
    const config = state.customConfig;
    const pathways = getAvailablePathways(pensum);

    // Ajustar encabezado
    const heading = document.querySelector(".page-heading h1");
    if (heading && pensum.nombre) {
        heading.textContent = `Mi plan de estudios · ${pensum.nombre}`;
    }

    // Inicializar controles del panel de personalización
    const selectProf1 = byId("select-prof-1");
    const selectProf2 = byId("select-prof-2");
    const selectFlex = byId("select-flex");
    const selectEnfasis = byId("select-enfasis");
    const groupMath = byId("group-math-electives");
    const selectMat1 = byId("select-mat-1");
    const selectMat2 = byId("select-mat-2");
    const nfiChipsContainer = byId("nfi-chips-container");
    const nfiCounter = byId("nfi-counter");
    const nfiSearch = byId("nfi-search");
    const toggleCustom = byId("toggle-custom-plan");
    const toggleFormBtn = byId("toggle-pathway-form-btn");
    const pathwayForm = byId("pathway-form");
    const pathwayFeedback = byId("pathway-feedback");

    // Llenar selectores de Profesionalizantes
    const hasProf = pathways.profesionalizantes.length > 0;
    if (selectProf1 && selectProf2) {
        selectProf1.replaceChildren();
        selectProf2.replaceChildren();

        if (hasProf) {
            selectProf1.disabled = false;
            selectProf2.disabled = false;
            for (const p of pathways.profesionalizantes) {
                selectProf1.add(new Option(p, p));
                selectProf2.add(new Option(p, p));
            }
            if (config.profesionalizantes?.[0]) selectProf1.value = config.profesionalizantes[0];
            if (config.profesionalizantes?.[1]) selectProf2.value = config.profesionalizantes[1];
            if (selectProf1.value === selectProf2.value && pathways.profesionalizantes.length > 1) {
                selectProf2.value = pathways.profesionalizantes[1];
            }
        } else {
            selectProf1.add(new Option("No aplica para esta carrera", ""));
            selectProf2.add(new Option("No aplica para esta carrera", ""));
            selectProf1.disabled = true;
            selectProf2.disabled = true;
        }
    }

    // Llenar selector de Trayectoria Flexible
    if (selectFlex) {
        selectFlex.replaceChildren();
        if (pathways.flexibles.length > 0) {
            selectFlex.disabled = false;
            for (const f of pathways.flexibles) {
                selectFlex.add(new Option(f, f));
            }
            if (config.flexible && pathways.flexibles.includes(config.flexible)) {
                selectFlex.value = config.flexible;
            }
        } else {
            selectFlex.add(new Option("No aplica para esta carrera", ""));
            selectFlex.disabled = true;
        }
    }

    // Llenar selector de Línea de Énfasis
    if (selectEnfasis) {
        selectEnfasis.replaceChildren();
        if (pathways.enfasis.length > 0) {
            selectEnfasis.disabled = false;
            for (const e of pathways.enfasis) {
                selectEnfasis.add(new Option(e, e));
            }
            if (config.enfasis && pathways.enfasis.includes(config.enfasis)) {
                selectEnfasis.value = config.enfasis;
            }
        } else {
            selectEnfasis.add(new Option("No aplica para esta carrera", ""));
            selectEnfasis.disabled = true;
        }
    }

    // Llenar sección de Electivas en Matemáticas (solo para carreras que tengan, ej. Sistemas: 2 por estudiante)
    const hasMath = pathways.electivasMatematica.length > 0;
    if (groupMath) {
        groupMath.style.display = hasMath ? "block" : "none";
        if (hasMath && selectMat1 && selectMat2) {
            selectMat1.replaceChildren();
            selectMat2.replaceChildren();
            for (const m of pathways.electivasMatematica) {
                selectMat1.add(new Option(`${m.codigo} · ${m.nombre}`, m.codigo));
                selectMat2.add(new Option(`${m.codigo} · ${m.nombre}`, m.codigo));
            }
            if (config.electivasMatematica?.[0]) selectMat1.value = config.electivasMatematica[0];
            if (config.electivasMatematica?.[1]) selectMat2.value = config.electivasMatematica[1];
            if (selectMat1.value === selectMat2.value && pathways.electivasMatematica.length > 1) {
                selectMat2.value = pathways.electivasMatematica[1].codigo;
            }
        }
    }

    // Manejo de materias NFI y sus semestres asignados
    let selectedNfis = Array.isArray(config.nfis) ? [...config.nfis] : [];
    config.nfiSemestres = config.nfiSemestres || {};

    // Asegurar semestres fijos institucionales
    if (selectedNfis.includes("FH1037")) config.nfiSemestres["FH1037"] = 1;
    if (selectedNfis.includes("FH1002")) config.nfiSemestres["FH1002"] = 1;
    if (selectedNfis.includes("FH1001")) config.nfiSemestres["FH1001"] = 2;

    function updateNfiCounter() {
        if (!nfiCounter) return;
        nfiCounter.textContent = `${selectedNfis.length} / 5 seleccionadas`;
        if (selectedNfis.length === 5) {
            nfiCounter.classList.add("ready");
        } else {
            nfiCounter.classList.remove("ready");
        }
    }

    function renderNfiChips(filterText = "") {
        if (!nfiChipsContainer) return;
        nfiChipsContainer.replaceChildren();
        const normFilter = filterText.toLowerCase().trim();

        const filteredNfis = pathways.nfis.filter(m =>
            !normFilter ||
            m.codigo.toLowerCase().includes(normFilter) ||
            m.nombre.toLowerCase().includes(normFilter)
        );

        if (!filteredNfis.length) {
            nfiChipsContainer.append(createElement("p", "muted small", "No se encontraron materias NFI con esa búsqueda."));
            return;
        }

        for (const m of filteredNfis) {
            const isSelected = selectedNfis.includes(m.codigo);
            const chip = createElement("div", `nfi-chip ${isSelected ? "selected" : ""}`);

            const textWrap = createElement("div", "nfi-chip-info");
            const isFixedSem = m.codigo === "FH1001" || m.codigo === "FH1037" || m.codigo === "FH1002";
            const currentSem = Number(config.nfiSemestres[m.codigo] || m.semestre);

            textWrap.append(
                createElement("span", "nfi-sem-tag", `Sem. ${currentSem}`),
                createElement("strong", "", m.codigo),
                createElement("span", "", ` · ${m.nombre}`),
                createElement("small", "muted", ` (Dif: ${m.dificultad}/5)`)
            );
            chip.append(textWrap);

            // Controles de interacción
            const actionsWrap = createElement("div", "nfi-chip-actions");

            if (isSelected) {
                // Selector de semestre (1 a 5) para materias NFI flexibles
                if (!isFixedSem) {
                    const semSelect = createElement("select", "nfi-sem-select");
                    semSelect.title = "Elegir semestre para cursar este NFI (1° a 5°)";
                    for (let s = 1; s <= 5; s++) {
                        const opt = new Option(`Sem. ${s}`, s);
                        if (s === currentSem) opt.selected = true;
                        semSelect.add(opt);
                    }
                    semSelect.onclick = (e) => e.stopPropagation();
                    semSelect.onchange = (e) => {
                        e.stopPropagation();
                        const newSem = Number(semSelect.value);
                        // Verificar que no queden 3 NFIs en ese semestre
                        const countInTarget = selectedNfis.filter(c => {
                            if (c === m.codigo) return false;
                            return (config.nfiSemestres[c] || pathways.nfis.find(n => n.codigo === c)?.semestre) === newSem;
                        }).length;

                        if (countInTarget >= 2) {
                            if (pathwayFeedback) {
                                pathwayFeedback.textContent = `No puedes mover ${m.codigo} al semestre ${newSem} porque ya hay 2 materias NFI en ese semestre (máximo 2).`;
                            }
                            semSelect.value = currentSem;
                            return;
                        }
                        config.nfiSemestres[m.codigo] = newSem;
                        if (pathwayFeedback) pathwayFeedback.textContent = "";
                        renderNfiChips(nfiSearch ? nfiSearch.value : "");
                        refresh();
                    };
                    actionsWrap.append(semSelect);
                }
                actionsWrap.append(createElement("span", "nfi-chip-check", "✓"));
            }

            chip.append(actionsWrap);

            chip.addEventListener("click", () => {
                if (selectedNfis.includes(m.codigo)) {
                    selectedNfis = selectedNfis.filter(c => c !== m.codigo);
                    delete config.nfiSemestres[m.codigo];
                    if (pathwayFeedback) pathwayFeedback.textContent = "";
                } else {
                    if (selectedNfis.length >= 5) {
                        if (pathwayFeedback) {
                            pathwayFeedback.textContent = "Ya has seleccionado 5 materias NFI. Desmarca una antes de agregar otra.";
                        }
                        return;
                    }

                    // Determinar semestre por defecto al agregar
                    let assignedSem = m.semestre;
                    if (m.codigo === "FH1001") assignedSem = 2;
                    if (m.codigo === "FH1037" || m.codigo === "FH1002") assignedSem = 1;

                    // Si en ese semestre ya hay 2 NFIs, buscar un semestre con cupo (< 2) entre 1 y 5
                    const countInAssigned = selectedNfis.filter(c => (config.nfiSemestres[c] || pathways.nfis.find(n => n.codigo === c)?.semestre) === assignedSem).length;
                    if (countInAssigned >= 2) {
                        let alternativeSem = null;
                        for (let s = 1; s <= 5; s++) {
                            const countInS = selectedNfis.filter(c => (config.nfiSemestres[c] || pathways.nfis.find(n => n.codigo === c)?.semestre) === s).length;
                            if (countInS < 2) {
                                alternativeSem = s;
                                break;
                            }
                        }
                        if (!alternativeSem) {
                            if (pathwayFeedback) pathwayFeedback.textContent = "No hay semestres disponibles con menos de 2 materias NFI (máximo 2 por semestre).";
                            return;
                        }
                        assignedSem = alternativeSem;
                    }

                    selectedNfis.push(m.codigo);
                    config.nfiSemestres[m.codigo] = assignedSem;
                    if (pathwayFeedback) pathwayFeedback.textContent = "";
                }
                updateNfiCounter();
                renderNfiChips(nfiSearch ? nfiSearch.value : "");
            });

            nfiChipsContainer.append(chip);
        }
    }

    if (nfiSearch) {
        nfiSearch.oninput = () => renderNfiChips(nfiSearch.value);
    }
    updateNfiCounter();
    renderNfiChips();

    // Toggle de visibilidad de pensum personalizado vs catálogo completo
    if (toggleCustom) {
        toggleCustom.checked = Boolean(config.activo);
        toggleCustom.onchange = () => {
            config.activo = toggleCustom.checked;
            saveCustomConfig(pensum.carrera, config);
            refresh();
            if (onConfigChange) onConfigChange(config);
        };
    }

    // Toggle de expandir / colapsar formulario
    if (toggleFormBtn && pathwayForm) {
        toggleFormBtn.onclick = () => {
            const isHidden = pathwayForm.style.display === "none";
            pathwayForm.style.display = isHidden ? "block" : "none";
            toggleFormBtn.textContent = isHidden ? "Ocultar opciones ▴" : "Editar selección ▾";
            toggleFormBtn.setAttribute("aria-expanded", String(isHidden));
        };
    }

    // Botón sugerencia
    const btnSuggested = byId("btn-suggested-pathway");
    if (btnSuggested) {
        btnSuggested.onclick = () => {
            const def = getDefaultCustomConfig(pensum);
            if (selectProf1 && def.profesionalizantes[0]) selectProf1.value = def.profesionalizantes[0];
            if (selectProf2 && def.profesionalizantes[1]) selectProf2.value = def.profesionalizantes[1];
            if (selectFlex && def.flexible) selectFlex.value = def.flexible;
            if (selectEnfasis && def.enfasis) selectEnfasis.value = def.enfasis;
            if (selectMat1 && def.electivasMatematica?.[0]) selectMat1.value = def.electivasMatematica[0];
            if (selectMat2 && def.electivasMatematica?.[1]) selectMat2.value = def.electivasMatematica[1];
            selectedNfis = [...def.nfis];
            config.nfiSemestres = { ...def.nfiSemestres };
            updateNfiCounter();
            renderNfiChips(nfiSearch ? nfiSearch.value : "");
            if (pathwayFeedback) pathwayFeedback.textContent = "Valores sugeridos cargados. Haz clic en 'Aplicar a mi Pensum' para guardar.";
        };
    }

    // Guardar formulario
    if (pathwayForm) {
        pathwayForm.onsubmit = (e) => {
            e.preventDefault();

            if (pathways.profesionalizantes.length >= 2) {
                if (selectProf1.value === selectProf2.value) {
                    if (pathwayFeedback) pathwayFeedback.textContent = "Debes elegir dos trayectorias profesionalizantes distintas.";
                    return;
                }
            }

            if (hasMath && selectMat1 && selectMat2) {
                if (selectMat1.value === selectMat2.value) {
                    if (pathwayFeedback) pathwayFeedback.textContent = "Debes elegir dos electivas en matemáticas distintas.";
                    return;
                }
            }

            if (pathways.nfis.length >= 5) {
                const nfiValidation = validateNfiSelection(selectedNfis, pathways.nfis, config.nfiSemestres);
                if (!nfiValidation.valid) {
                    if (pathwayFeedback) pathwayFeedback.textContent = nfiValidation.error;
                    return;
                }
            }

            config.profesionalizantes = hasProf ? [selectProf1.value, selectProf2.value].filter(Boolean) : [];
            config.flexible = selectFlex ? selectFlex.value : "";
            config.enfasis = selectEnfasis ? selectEnfasis.value : "";
            config.electivasMatematica = hasMath ? [selectMat1.value, selectMat2.value].filter(Boolean) : [];
            config.nfis = [...selectedNfis];
            config.activo = true;

            if (toggleCustom) toggleCustom.checked = true;
            saveCustomConfig(pensum.carrera, config);

            // Sincronizar con el planificador
            if (state.planning) {
                state.planning.trajectories = [...config.profesionalizantes];
            }

            if (pathwayFeedback) {
                pathwayFeedback.textContent = "✓ ¡Tu pensum personalizado ha sido guardado y aplicado correctamente!";
            }

            refresh();
            if (onConfigChange) onConfigChange(config);
        };
    }

    // Actualización de semestres y notas
    function refresh() {
        const count = getSemesterCount(pensum, config);
        byId("semester-count").textContent = `${count} semestres`;

        const activeCourses = pensum.materias.filter(c => isCourseInCustomPlan(c, config, pensum));
        const totalCreds = activeCourses.reduce((sum, c) => sum + c.creditos, 0);

        if (config.activo) {
            byId("catalog-note").textContent = `Pensum personalizado de ${pensum.nombre}: mostrando ${activeCourses.length} materias oficiales (${totalCreds} créditos). Incluye materias básicas, trayectorias, énfasis y los 5 NFIs seleccionados (máx. 2 por semestre hasta 5°).`;
        } else {
            const countCatalog = pensum.materias.filter(c => !c.tipo?.includes("Complementarias")).length;
            byId("catalog-note").textContent = `Catálogo completo de ${pensum.nombre}: mostrando ${countCatalog} materias registradas.`;
        }

        const buttons = document.querySelectorAll("[data-filter]");
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filters.status)));
        drawSemesters(pensum, filters, config, onOpenCourse);
    }

    const search = byId("course-search");
    if (search) {
        search.value = filters.search;
        search.oninput = () => {
            onFilterChange({ search: search.value });
            refresh();
        };
    }

    const buttons = document.querySelectorAll("[data-filter]");
    buttons.forEach(button => {
        button.onclick = () => {
            onFilterChange({ status: button.dataset.filter });
            refresh();
        };
    });

    refresh();
}
