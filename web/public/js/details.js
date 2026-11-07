import { loadTemplate } from "./api.js";
import { byId, createElement, createStatus } from "./dom.js";

/** El diálogo solo presenta datos; la escritura de aprobadas vive en el controlador. */
export async function initializeDetails(onToggle, onClose) {
    byId("dialog-container").innerHTML = await loadTemplate("components/detalle.html");
    const dialog = byId("course-dialog");
    const toggle = byId("detail-toggle");
    let current = null;
    let saving = false;

    byId("detail-close").onclick = () => dialog.close();
    dialog.addEventListener("close", onClose);

    function toggleLabel(course) {
        return course.estado === "APROBADA" ? "Desmarcar como aprobada" : "✓ Marcar como aprobada";
    }

    toggle.onclick = async () => {
        if (!current || saving || current.estado === "BLOQUEADA") return;
        const selected = current;
        saving = true;
        toggle.disabled = true;
        toggle.textContent = "Actualizando…";
        try {
            await onToggle(selected);
        } catch (error) {
            byId("detail-message").textContent = error.message;
        } finally {
            saving = false;
            toggle.disabled = current?.estado === "BLOQUEADA";
            if (current) toggle.textContent = toggleLabel(current);
        }
    };

    return {
        close() {
            dialog.close();
        },

        open(course) {
            current = course;
            byId("detail-code").textContent = course.codigo;
            byId("detail-title").textContent = course.nombre;
            byId("detail-credits").textContent = `${course.creditos} créditos`;
            byId("detail-status").replaceChildren(createStatus(course.estado));

            const lists = [
                ["detail-prerequisites", course.prerrequisitos],
                ["detail-corequisites", course.correquisitos],
                ["detail-unlocks", course.desbloquea]
            ];
            for (const [id, courses] of lists) {
                const list = byId(id);
                list.replaceChildren();
                for (const item of courses) list.append(createElement("li", "", `${item.codigo} · ${item.nombre}`));
                if (!courses.length) {
                    list.append(createElement("li", "", id === "detail-unlocks" ? "No tiene materias dependientes por prerrequisitos." : "Ninguno."));
                }
            }

            byId("detail-message").textContent = course.estado === "BLOQUEADA"
                ? "Esta materia está bloqueada. Revisa sus prerrequisitos y los requisitos de sus correquisitos."
                : "";
            toggle.textContent = toggleLabel(course);
            toggle.disabled = course.estado === "BLOQUEADA" || saving;
            if (!dialog.open) dialog.showModal();
        }
    };
}
