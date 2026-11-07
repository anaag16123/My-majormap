#include "Grafo.h"

#include <queue>
#include <stdexcept>

Grafo::Grafo() {}

bool Grafo::construir(const std::vector<Materia>& materias, std::string& error) {
    catalogo = materias;
    int n = static_cast<int>(catalogo.size());

    adyacencia.assign(n, std::vector<Arista>());
    indicePorCodigo.clear();
    aprobadas.clear();
    habilitadas.clear();
    esAprobada.assign(n, false);
    estados.assign(n, EstadoMateria::BLOQUEADA);

    // 1. Indexar materias por codigo
    for (int i = 0; i < n; i++) {
        const std::string& codigo = catalogo[i].getCodigo();
        if (indicePorCodigo.count(codigo)) {
            error = "Codigo repetido: " + codigo;
            return false;
        }
        indicePorCodigo[codigo] = i;
    }

    // 2. Crear aristas: requisito -> materia que lo necesita
    for (int i = 0; i < n; i++) {
        for (const std::string& pre : catalogo[i].getPrerrequisitos()) {
            int origen = indiceDe(pre);
            if (origen == -1) {
                error = catalogo[i].getCodigo() + " tiene un prerrequisito que no existe: " + pre;
                return false;
            }
            adyacencia[origen].push_back({i, TipoRelacion::PRERREQUISITO});
        }
        for (const std::string& co : catalogo[i].getCorrequisitos()) {
            int origen = indiceDe(co);
            if (origen == -1) {
                error = catalogo[i].getCodigo() + " tiene un correquisito que no existe: " + co;
                return false;
            }
            adyacencia[origen].push_back({i, TipoRelacion::CORREQUISITO});
        }
    }

    calcularHabilitadas();
    return true;
}

void Grafo::reconstruirAprobadas() {
    aprobadas.clear();
    for (int i = 0; i < getCantidadMaterias(); i++) {
        if (esAprobada[i]) aprobadas.push_back(catalogo[i]);
    }
}

bool Grafo::marcarAprobada(const std::string& codigo) {
    int i = indiceDe(codigo);
    if (i == -1) return false;
    esAprobada[i] = true;
    reconstruirAprobadas();
    calcularHabilitadas();
    return true;
}

bool Grafo::desmarcarAprobada(const std::string& codigo) {
    int i = indiceDe(codigo);
    if (i == -1) return false;
    esAprobada[i] = false;
    reconstruirAprobadas();
    calcularHabilitadas();
    return true;
}

bool Grafo::estaAprobada(const std::string& codigo) const {
    int i = indiceDe(codigo);
    return i != -1 && esAprobada[i];
}

void Grafo::calcularHabilitadas() {
    int n = getCantidadMaterias();
    std::vector<bool> visitado(n, false);
    std::vector<bool> candidata(n, false);
    std::queue<int> cola;

    // Punto de partida del BFS:
    // - materias sin prerrequisitos (raices del grafo)
    // - materias aprobadas (desde ellas se exploran las que desbloquean)
    for (int i = 0; i < n; i++) {
        if (catalogo[i].getPrerrequisitos().empty() || esAprobada[i]) {
            visitado[i] = true;
            cola.push(i);
        }
    }

    while (!cola.empty()) {
        int u = cola.front();
        cola.pop();

        if (esAprobada[u]) {
            // Aprobada: se exploran las materias que desbloquea
            for (const Arista& a : adyacencia[u]) {
                if (a.tipo == TipoRelacion::PRERREQUISITO && !visitado[a.destino]) {
                    visitado[a.destino] = true;
                    cola.push(a.destino);
                }
            }
        } else {
            // No aprobada: es candidata si TODOS sus prerrequisitos estan aprobados.
            // No se expande, porque lo que ella desbloquea aun no se puede cursar.
            bool todos = true;
            for (const std::string& pre : catalogo[u].getPrerrequisitos()) {
                if (!esAprobada[indiceDe(pre)]) {
                    todos = false;
                    break;
                }
            }
            candidata[u] = todos;
        }
    }

    // Correquisitos: cada uno debe estar aprobado o poder cursarse a la vez
    // (ser candidato). Si se descarta una, puede afectar a otra, por eso se repite.
    bool cambio = true;
    while (cambio) {
        cambio = false;
        for (int i = 0; i < n; i++) {
            if (!candidata[i]) continue;
            for (const std::string& co : catalogo[i].getCorrequisitos()) {
                int j = indiceDe(co);
                if (!esAprobada[j] && !candidata[j]) {
                    candidata[i] = false;
                    cambio = true;
                    break;
                }
            }
        }
    }

    // Asignar estados y llenar el vector de habilitadas
    habilitadas.clear();
    for (int i = 0; i < n; i++) {
        if (esAprobada[i]) {
            estados[i] = EstadoMateria::APROBADA;
        } else if (candidata[i]) {
            estados[i] = EstadoMateria::HABILITADA;
            habilitadas.push_back(catalogo[i]);
        } else {
            estados[i] = EstadoMateria::BLOQUEADA;
        }
    }
}

bool Grafo::correquisitosCumplidos(const std::string& codigo,
                                   const std::vector<Materia>& propuesta) const {
    int i = indiceDe(codigo);
    if (i == -1) return false;

    for (const std::string& co : catalogo[i].getCorrequisitos()) {
        if (estaAprobada(co)) continue;
        bool enPropuesta = false;
        for (const Materia& m : propuesta) {
            if (m.getCodigo() == co) {
                enPropuesta = true;
                break;
            }
        }
        if (!enPropuesta) return false;
    }
    return true;
}

int Grafo::indiceDe(const std::string& codigo) const {
    auto it = indicePorCodigo.find(codigo);
    return it == indicePorCodigo.end() ? -1 : it->second;
}

const Materia& Grafo::getMateria(int indice) const {
    return catalogo.at(indice);
}

EstadoMateria Grafo::getEstado(const std::string& codigo) const {
    int i = indiceDe(codigo);
    if (i == -1) throw std::invalid_argument("Materia no existe: " + codigo);
    return estados[i];
}

std::vector<Materia> Grafo::getPrerrequisitos(const std::string& codigo) const {
    std::vector<Materia> resultado;
    int i = indiceDe(codigo);
    if (i == -1) return resultado;
    for (const std::string& pre : catalogo[i].getPrerrequisitos()) {
        resultado.push_back(catalogo[indiceDe(pre)]);
    }
    return resultado;
}

std::vector<Materia> Grafo::getCorrequisitos(const std::string& codigo) const {
    std::vector<Materia> resultado;
    int i = indiceDe(codigo);
    if (i == -1) return resultado;
    for (const std::string& co : catalogo[i].getCorrequisitos()) {
        resultado.push_back(catalogo[indiceDe(co)]);
    }
    return resultado;
}

const std::vector<Materia>& Grafo::getCatalogo() const { return catalogo; }
const std::vector<Materia>& Grafo::getAprobadas() const { return aprobadas; }
const std::vector<Materia>& Grafo::getHabilitadas() const { return habilitadas; }
const std::vector<std::vector<Arista>>& Grafo::getAdyacencia() const { return adyacencia; }
int Grafo::getCantidadMaterias() const { return static_cast<int>(catalogo.size()); }

std::string estadoATexto(EstadoMateria estado) {
    switch (estado) {
        case EstadoMateria::APROBADA:   return "APROBADA";
        case EstadoMateria::HABILITADA: return "HABILITADA";
        default:                        return "BLOQUEADA";
    }
}
