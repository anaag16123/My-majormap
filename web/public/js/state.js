/** Estado compartido y cálculos puros, sin acceso al DOM ni a la red. */
export function createPlanningState() {
    return {
        quantity: 2,
        credits: 18,
        mode: "suave",
        esExigente: false,
        requested: false, // Samu: true después de pedir propuestas; activa el recalcular
        trajectories: [],
        proposals: null,
        blocking: null,   // Samu: diagnóstico de /api/bloqueo cuando no hay propuestas
        page: 0,
        loading: false,
        error: ""
    };
}

export const state = {
    pensum: null,
    loading: true,
    updating: false,
    loadError: "",
    revision: 0,
    filters: { search: "", status: "TODAS" },
    planning: createPlanningState(),
    customConfig: null
};

/**
 * Extrae los grupos de trayectorias profesionalizantes, flexibles,
 * líneas de énfasis, electivas de matemáticas y materias NFI disponibles.
 */
export function getAvailablePathways(pensum) {
    if (!pensum || !pensum.materias) {
        return { profesionalizantes: [], flexibles: [], enfasis: [], nfis: [], electivasMatematica: [] };
    }

    const profSet = new Set();
    const flexSet = new Set();
    const enfasisSet = new Set();
    const nfiList = [];
    const matList = [];

    for (const m of pensum.materias) {
        const tipo = (m.tipo || "").trim();
        if (tipo.startsWith("Trayectoria Profesionalizante:")) {
            profSet.add(tipo.substring("Trayectoria Profesionalizante:".length).trim());
        } else if (tipo.startsWith("Trayectoria Flexible:")) {
            const name = tipo.substring("Trayectoria Flexible:".length).trim();
            // No incluir complementarias en el menú de trayectorias de Matemática
            if (name !== "Complementarias") {
                flexSet.add(name);
            }
        } else if (tipo.startsWith("Línea de Énfasis:") || tipo.startsWith("Linea de Enfasis:")) {
            const prefix = tipo.startsWith("Línea de Énfasis:") ? "Línea de Énfasis:" : "Linea de Enfasis:";
            enfasisSet.add(tipo.substring(prefix.length).trim());
        } else if (tipo === "NFI") {
            nfiList.push(m);
        } else if (tipo === "Electiva en Matemáticas") {
            matList.push(m);
        }
    }

    // Grupos definidos en trayectoria_enfasis.csv
    const trayectorias = pensum.trayectorias || [];
    for (const t of trayectorias) {
        const tGrupo = (t.tipo_grupo || "").trim();
        const grp = (t.grupo || "").trim();
        if (!grp) continue;
        if (tGrupo === "Trayectoria Profesionalizante") {
            profSet.add(grp);
        } else if (tGrupo === "Trayectoria Flexible") {
            if (grp !== "Complementarias") {
                flexSet.add(grp);
            }
        } else if (tGrupo === "Línea de Énfasis" || tGrupo === "Linea de Enfasis") {
            enfasisSet.add(grp);
        }
    }

    return {
        profesionalizantes: Array.from(profSet).sort((a, b) => a.localeCompare(b, "es")),
        flexibles: Array.from(flexSet).sort((a, b) => a.localeCompare(b, "es")),
        enfasis: Array.from(enfasisSet).sort((a, b) => a.localeCompare(b, "es")),
        nfis: nfiList.sort((a, b) => a.semestre - b.semestre || a.codigo.localeCompare(b.codigo)),
        electivasMatematica: matList.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    };
}

/**
 * Obtiene el semestre efectivo de una materia considerando la reubicación
 * personalizada de los NFIs en cualquier semestre hasta el 5°.
 */
export function getCourseEffectiveSemester(course, config) {
    if (course.tipo === "NFI" && config?.nfiSemestres && config.nfiSemestres[course.codigo]) {
        return Number(config.nfiSemestres[course.codigo]);
    }
    return course.semestre;
}

/**
 * Valida que la selección y distribución de NFIs cumpla las reglas:
 * 1. Exactamente 5 materias NFI.
 * 2. Ciudadanía y Democracia (FH1001) en 2° semestre.
 * 3. Pensamiento Computacional (FH1037 en Sistemas / FH1002 en Física) en 1° semestre si aplican.
 * 4. Ningún NFI en semestres mayores al 5°.
 * 5. Máximo 2 NFIs en un mismo semestre (no debe haber 3 NFIs en un solo semestre).
 */
export function validateNfiSelection(selectedCodes, nfiList, nfiSemestres = {}) {
    if (selectedCodes.length !== 5) {
        return { valid: false, error: `Debes seleccionar exactamente 5 materias NFI (has seleccionado ${selectedCodes.length}).` };
    }

    const semCounts = {};
    for (const code of selectedCodes) {
        const m = nfiList.find(n => n.codigo === code);
        if (!m) continue;
        const sem = Number(nfiSemestres[code] || m.semestre);

        if (sem > 5 || sem < 1) {
            return { valid: false, error: `La materia ${m.codigo} (${m.nombre}) está asignada al semestre ${sem}. Los NFIs solo se pueden cursar hasta el 5° semestre.` };
        }

        // Reglas de semestres fijos
        if (code === "FH1001" && sem !== 2) {
            return { valid: false, error: "Ciudadanía y Democracia (FH1001) debe cursarse obligatoriamente en el 2° semestre." };
        }
        if ((code === "FH1037" || code === "FH1002") && sem !== 1) {
            return { valid: false, error: "Pensamiento Computacional debe cursarse obligatoriamente en el 1° semestre." };
        }

        semCounts[sem] = (semCounts[sem] || 0) + 1;
        if (semCounts[sem] >= 3) {
            return { valid: false, error: `No puede haber 3 materias NFI en el semestre ${sem} (máximo 2 por semestre).` };
        }
    }

    return { valid: true, error: "" };
}

/**
 * Genera una configuración sugerida por defecto:
 * - 2 profesionalizantes
 * - 1 flexible
 * - 1 línea de énfasis
 * - 2 electivas en matemáticas (en Sistemas)
 * - 5 materias NFI (distribuidas 1 por semestre de 1° a 5°, con Pensamiento Computacional en 1° y Ciudadanía en 2°)
 */
export function getDefaultCustomConfig(pensum) {
    const avail = getAvailablePathways(pensum);
    const prof = avail.profesionalizantes.slice(0, 2);
    const flex = avail.flexibles.length ? avail.flexibles[0] : "";
    const enf = avail.enfasis.length ? avail.enfasis[0] : "";
    const mat = avail.electivasMatematica.slice(0, 2).map(m => m.codigo);

    // Selección inteligente de 5 NFIs respetando semestres 1 a 5
    const nfis = [];
    const nfiSemestres = {};

    // 1. Pensamiento Computacional en Semestre 1 (si existe en la carrera)
    const pc = avail.nfis.find(m => m.codigo === "FH1037" || m.codigo === "FH1002");
    if (pc) {
        nfis.push(pc.codigo);
        nfiSemestres[pc.codigo] = 1;
    }

    // 2. Ciudadanía y Democracia en Semestre 2
    const cd = avail.nfis.find(m => m.codigo === "FH1001");
    if (cd && !nfis.includes(cd.codigo)) {
        nfis.push(cd.codigo);
        nfiSemestres[cd.codigo] = 2;
    }

    // 3. Seleccionar 1 NFI para semestre 3, 4 y 5
    const targetSemesters = [3, 4, 5];
    for (const sem of targetSemesters) {
        if (nfis.length >= 5) break;
        const candidate = avail.nfis.find(m => !nfis.includes(m.codigo) && m.semestre === sem);
        if (candidate) {
            nfis.push(candidate.codigo);
            nfiSemestres[candidate.codigo] = sem;
        }
    }

    // Si aún faltan materias para completar 5, tomar disponibles asignándolas a semestres con cupo (< 2)
    if (nfis.length < 5) {
        for (const m of avail.nfis) {
            if (nfis.includes(m.codigo)) continue;
            // Buscar un semestre entre 1 y 5 con menos de 2 NFIs
            for (let s = 1; s <= 5; s++) {
                const countInS = Object.values(nfiSemestres).filter(val => val === s).length;
                if (countInS < 2) {
                    nfis.push(m.codigo);
                    nfiSemestres[m.codigo] = s;
                    break;
                }
            }
            if (nfis.length === 5) break;
        }
    }

    return {
        profesionalizantes: prof,
        flexible: flex,
        enfasis: enf,
        electivasMatematica: mat,
        nfis: nfis,
        nfiSemestres: nfiSemestres,
        activo: true
    };
}

export function loadCustomConfig(careerId, pensum) {
    const def = getDefaultCustomConfig(pensum);
    try {
        const raw = localStorage.getItem("majormap_custom_" + careerId);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                return {
                    profesionalizantes: Array.isArray(parsed.profesionalizantes) && parsed.profesionalizantes.length ? parsed.profesionalizantes : def.profesionalizantes,
                    flexible: parsed.flexible !== undefined ? parsed.flexible : def.flexible,
                    enfasis: parsed.enfasis !== undefined ? parsed.enfasis : def.enfasis,
                    electivasMatematica: Array.isArray(parsed.electivasMatematica) && parsed.electivasMatematica.length === 2 ? parsed.electivasMatematica : def.electivasMatematica,
                    nfis: Array.isArray(parsed.nfis) && parsed.nfis.length === 5 ? parsed.nfis : def.nfis,
                    nfiSemestres: (parsed.nfiSemestres && Object.keys(parsed.nfiSemestres).length) ? { ...def.nfiSemestres, ...parsed.nfiSemestres } : def.nfiSemestres,
                    activo: parsed.activo !== undefined ? parsed.activo : true
                };
            }
        }
    } catch {}
    return def;
}

export function saveCustomConfig(careerId, config) {
    try {
        localStorage.setItem("majormap_custom_" + careerId, JSON.stringify(config));
    } catch {}
}

/**
 * Determina si una materia pertenece a un grupo específico (profesionalizante, flexible o línea de énfasis),
 * uniendo la columna tipo del CSV principal con los registros de trayectoria_enfasis.csv.
 */
export function courseBelongsToGroup(course, tipoGrupo, grupoNombre, trayectorias = []) {
    if (!grupoNombre || !course) return false;
    const gTarget = grupoNombre.trim().toLowerCase();
    const tTarget = tipoGrupo.trim().toLowerCase();

    // (a) Fila del CSV principal: prefijo + nombre de grupo (ej. "Línea de Énfasis: Infraestructura TI")
    const courseTipo = (course.tipo || "").trim();
    if (courseTipo) {
        const sepIdx = courseTipo.indexOf(":");
        if (sepIdx !== -1) {
            const prefix = courseTipo.substring(0, sepIdx).trim().toLowerCase();
            const groupInTipo = courseTipo.substring(sepIdx + 1).trim().toLowerCase();
            const prefixMatches = (prefix === tTarget) ||
                (tTarget.includes("énfasis") && prefix.includes("enfasis")) ||
                (tTarget.includes("enfasis") && prefix.includes("énfasis"));

            if (prefixMatches && groupInTipo === gTarget) {
                return true;
            }
        }
    }

    // (b) Filas de trayectoria_enfasis.csv donde grupo = <nombre> y tipo_grupo = <tipoGrupo>
    const list = (course.trayectorias && course.trayectorias.length)
        ? course.trayectorias
        : (trayectorias || []);

    for (const t of list) {
        if (t.codigo && t.codigo !== course.codigo) continue;
        const regTipo = (t.tipo_grupo || "").trim().toLowerCase();
        const regGrp = (t.grupo || "").trim().toLowerCase();
        const tipoMatches = (regTipo === tTarget) ||
            (tTarget.includes("énfasis") && regTipo.includes("enfasis")) ||
            (tTarget.includes("enfasis") && regTipo.includes("énfasis"));

        if (tipoMatches && regGrp === gTarget) {
            return true;
        }
    }

    return false;
}

/**
 * Determina si una materia pertenece al pensum personalizado del estudiante:
 * - Materias básicas siempre pertenecen.
 * - 2 Trayectorias Profesionalizantes elegidas.
 * - 1 Trayectoria Flexible elegida (nunca complementarias en matemática).
 * - 1 Línea de Énfasis elegida (une el CSV principal y trayectoria_enfasis.csv).
 * - Exactamente 2 Electivas en Matemáticas elegidas (en Sistemas).
 * - 5 Materias NFI elegidas.
 */
export function isCourseInCustomPlan(course, config, pensum = null) {
    const tipo = (course.tipo || "").trim();

    // Las complementarias en Ingeniería Matemática NUNCA van al pensum
    if (tipo.startsWith("Trayectoria Flexible: Complementarias") || tipo.includes("Complementarias")) {
        return false;
    }

    if (!config || !config.activo) return true;

    // Tronco común obligatorio
    if (tipo.startsWith("Básic") || tipo.startsWith("Basic") || tipo === "") {
        return true;
    }

    // Núcleo de Formación Institucional (deben ser las 5 seleccionadas)
    if (tipo === "NFI") {
        return config.nfis && config.nfis.includes(course.codigo);
    }

    // Electivas en Matemáticas (en Sistemas deben ser exactamente las 2 seleccionadas)
    if (tipo === "Electiva en Matemáticas") {
        return config.electivasMatematica && config.electivasMatematica.includes(course.codigo);
    }

    const trayectorias = (pensum && pensum.trayectorias) || state.pensum?.trayectorias || [];
    let hasCategory = false;

    // 1. Trayectorias profesionalizantes
    const isProf = tipo.startsWith("Trayectoria Profesionalizante:") ||
        trayectorias.some(t => t.codigo === course.codigo && t.tipo_grupo === "Trayectoria Profesionalizante");
    if (isProf) {
        hasCategory = true;
        if (config.profesionalizantes && config.profesionalizantes.some(p =>
            courseBelongsToGroup(course, "Trayectoria Profesionalizante", p, trayectorias)
        )) {
            return true;
        }
    }

    // 2. Trayectoria flexible
    const isFlex = tipo.startsWith("Trayectoria Flexible:") ||
        trayectorias.some(t => t.codigo === course.codigo && t.tipo_grupo === "Trayectoria Flexible");
    if (isFlex) {
        hasCategory = true;
        if (config.flexible && courseBelongsToGroup(course, "Trayectoria Flexible", config.flexible, trayectorias)) {
            return true;
        }
    }

    // 3. Línea de énfasis (cubre "Línea de Énfasis: <nombre>" y las electivas ST1631, ST1632, ST1633)
    const isEnfasis = tipo.startsWith("Línea de Énfasis") || tipo.startsWith("Linea de Enfasis") ||
        trayectorias.some(t => t.codigo === course.codigo && (t.tipo_grupo === "Línea de Énfasis" || t.tipo_grupo === "Linea de Enfasis"));
    if (isEnfasis) {
        hasCategory = true;
        if (config.enfasis && courseBelongsToGroup(course, "Línea de Énfasis", config.enfasis, trayectorias)) {
            return true;
        }
    }

    if (hasCategory) {
        return false;
    }

    return false;
}

export function summarize(pensum, config = null) {
    let courses = pensum.materias;
    if (config && config.activo) {
        courses = courses.filter(course => isCourseInCustomPlan(course, config, pensum));
    } else {
        // Excluir complementarias de matemática incluso en catálogo
        courses = courses.filter(course => !course.tipo?.includes("Complementarias"));
    }
    const approved = courses.filter(course => course.estado === "APROBADA");
    const sumCredits = list => list.reduce((sum, course) => sum + course.creditos, 0);

    return {
        total: courses.length,
        approved: approved.length,
        available: courses.filter(course => course.estado === "HABILITADA").length,
        approvedCredits: sumCredits(approved),
        totalCredits: sumCredits(courses),
        percentage: courses.length ? Math.round(100 * approved.length / courses.length) : 0
    };
}

export function getSemesterCount(pensum, config = null) {
    let courses = pensum.materias;
    if (config && config.activo) {
        courses = courses.filter(course => isCourseInCustomPlan(course, config, pensum));
    } else {
        courses = courses.filter(course => !course.tipo?.includes("Complementarias"));
    }
    const lastSemester = Math.max(0, ...courses.map(course => getCourseEffectiveSemester(course, config)));
    return pensum.carrera === "sistemas" ? Math.max(8, lastSemester) : lastSemester;
}

function normalize(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function filterCourses(courses, filters, config = null, pensum = null) {
    const search = normalize(filters.search.trim());
    return courses.filter(course => {
        // Las complementarias en Matemática nunca se muestran
        if (course.tipo?.includes("Complementarias")) {
            return false;
        }
        if (config && config.activo && !isCourseInCustomPlan(course, config, pensum)) {
            return false;
        }
        const matchesStatus = filters.status === "TODAS" || course.estado === filters.status;
        const matchesSearch = normalize(`${course.codigo} ${course.nombre} ${course.tipo || ""}`).includes(search);
        return matchesStatus && matchesSearch;
    });
}
