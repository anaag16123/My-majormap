import { byId, createElement, createStatus, COURSE_STATES } from "../dom.js";
import { filterCourses, getSemesterCount } from "../state.js";

function createCourseCard(course, onOpenCourse) {
    const info = COURSE_STATES[course.estado] || COURSE_STATES.BLOQUEADA;
    const card = createElement("button", `course-card ${info.className}`);
    card.type = "button";
    card.setAttribute("aria-label", `Ver detalle de ${course.nombre}, ${info.label}`);

    const top = createElement("span", "course-card-top");
    top.append(createElement("span", "course-code", course.codigo), createStatus(course.estado));

    const bottom = createElement("span", "course-card-bottom");
    bottom.append(
        createElement("span", "", `${course.creditos} créditos`),
        createElement("span", "", "Ver detalle ↗")
    );

    card.append(top, createElement("span", "course-name", course.nombre), bottom);
    card.addEventListener("click", () => onOpenCourse(course.codigo));
    return card;
}

function drawSemesters(pensum, filters, onOpenCourse) {
    const host = byId("semester-grid");
    const visible = filterCourses(pensum.materias, filters);
    host.replaceChildren();
    byId("search-summary").textContent = `${visible.length} de ${pensum.materias.length} materias coinciden con tu búsqueda y filtro.`;

    for (let semester = 1; semester <= getSemesterCount(pensum); semester++) {
        const allCourses = pensum.materias.filter(course => course.semestre === semester);
        const courses = visible.filter(course => course.semestre === semester);
        const section = createElement("section", "surface semester");
        const header = createElement("div", "semester-header");
        const title = createElement("h2");
        title.append(
            createElement("span", "semester-number", semester),
            document.createTextNode(`Semestre ${semester}`)
        );
        const credits = allCourses.reduce((sum, course) => sum + course.creditos, 0);
        header.append(title, createElement("small", "", allCourses.length ? `${credits} créditos` : "Sin datos"));
        section.append(header);

        for (const course of courses) section.append(createCourseCard(course, onOpenCourse));

        if (!courses.length) {
            const text = allCourses.length
                ? "No hay coincidencias con este filtro."
                : "Sin materias cargadas en este semestre.";
            section.append(createElement("p", "semester-empty", text));
        }

        host.append(section);
    }
}

export function mountPensum(pensum, filters, { onFilterChange, onOpenCourse }) {
    const count = getSemesterCount(pensum);
    byId("semester-count").textContent = `${count} semestres`;
    const missing = [];
    for (let semester = 1; semester <= count; semester++) {
        if (!pensum.materias.some(course => course.semestre === semester)) missing.push(semester);
    }

    byId("catalog-note").textContent = missing.length
        ? `Se muestran ${count} semestres. Faltan materias por cargar en los semestres ${missing.join(", ")}. El catálogo actual no equivale al pensum oficial completo.`
        : "Este mapa refleja el CSV cargado en el servidor. Confirma con tu equipo que corresponda al pensum oficial.";

    const search = byId("course-search");
    search.value = filters.search;
    const buttons = document.querySelectorAll("[data-filter]");

    function refresh() {
        buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filters.status)));
        drawSemesters(pensum, filters, onOpenCourse);
    }

    search.addEventListener("input", () => {
        onFilterChange({ search: search.value });
        refresh();
    });

    buttons.forEach(button => button.addEventListener("click", () => {
        onFilterChange({ status: button.dataset.filter });
        refresh();
    }));

    refresh();
}
