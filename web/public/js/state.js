/** Estado compartido y cálculos puros, sin acceso al DOM ni a la red. */
// Valores del parámetro "preferencia" acordados con Wen. El primero es el predeterminado.
export const PREFERENCES = ["suave", "exigente"];

export function createPlanningState() {
    return {
        quantity: 2,
        credits: 7,
        preference: PREFERENCES[0],
        requested: false, // true después de pedir propuestas: activa el recalcular
        proposals: null,
        blocking: null,
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
    planning: createPlanningState()
};

export function summarize(pensum) {
    const courses = pensum.materias;
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

export function getSemesterCount(pensum) {
    const lastSemester = Math.max(0, ...pensum.materias.map(course => course.semestre));
    return pensum.carrera === "sistemas" ? Math.max(9, lastSemester) : lastSemester;
}

function normalize(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function filterCourses(courses, filters) {
    const search = normalize(filters.search.trim());
    return courses.filter(course => {
        const matchesStatus = filters.status === "TODAS" || course.estado === filters.status;
        const matchesSearch = normalize(`${course.codigo} ${course.nombre}`).includes(search);
        return matchesStatus && matchesSearch;
    });
}
