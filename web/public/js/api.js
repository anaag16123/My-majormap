/** Único punto de acceso a la API C++ y a las plantillas HTML. */
const templateCache = new Map();

async function requestJson(path, options = {}) {
    const response = await fetch(path, options);
    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Respuesta inválida del servidor. Ejecuta make run y abre localhost:8080.");
    }

    if (!response.ok) {
        throw new Error(data.error || "No se pudo completar la solicitud.");
    }

    return data;
}

function endpoint(path, parameters) {
    return `${path}?${new URLSearchParams(parameters)}`;
}

export const api = {
    getCareers() {
        return requestJson("/api/carreras");
    },

    getPensum(career) {
        return requestJson(endpoint("/api/pensum", { carrera: career }));
    },

    getTrajectories(career) {
        return requestJson(endpoint("/api/trayectorias", { carrera: career }));
    },

    getCourse(career, code) {
        return requestJson(endpoint("/api/materia", { carrera: career, codigo: code }));
    },

    setApproved(career, code, approved) {
        const url = endpoint("/api/aprobada", {
            carrera: career,
            codigo: code,
            aprobada: String(approved)
        });

        return requestJson(url, { method: "POST" });
    },

    getProposals(career, quantity, credits, esExigente = false, trayectorias = []) {
        return requestJson(endpoint("/api/propuestas", {
            carrera: career,
            cantidad: quantity,
            creditos: credits,
            exigente: String(esExigente),
            trayectorias: trayectorias.join(",")
        }));
    },

    // Samu: explicación del bloqueo y alternativas cuando no hay propuestas.
    getBlocking(career, quantity, credits, trayectorias = []) {
        return requestJson(endpoint("/api/bloqueo", {
            carrera: career,
            cantidad: quantity,
            creditos: credits,
            trayectorias: trayectorias.join(",")
        }));
    }
};

export async function loadTemplate(path) {
    if (!templateCache.has(path)) {
        const promise = fetch(`${path}?v=${Date.now()}`, { cache: "no-store" }).then(response => {
            if (!response.ok) {
                throw new Error(`No se pudo cargar ${path}. Verifica que copiaste la carpeta web/public completa.`);
            }
            return response.text();
        });

        templateCache.set(path, promise);
    }

    try {
        return await templateCache.get(path);
    } catch (error) {
        templateCache.delete(path);
        throw error;
    }
}
