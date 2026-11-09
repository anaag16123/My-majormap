#include "Planificador.h"
#include <algorithm>
#include <functional>
#include <stack>
#include <stdexcept>

std::vector<Materia> Planificador::desbloqueadas(const Grafo& grafo, const std::string& codigo) {
    const int origen = grafo.indiceDe(codigo);
    if (origen < 0) throw std::invalid_argument("Materia no existe: " + codigo);
    std::vector<bool> visitadas(grafo.getCantidadMaterias(), false);
    std::stack<int> pila;
    visitadas[origen] = true; // Evita incluir el origen aun si existe un ciclo.
    pila.push(origen);
    const auto& adyacencia = grafo.getAdyacencia();
    while (!pila.empty()) {
        int actual = pila.top();
        pila.pop();
        for (const Arista& arista : adyacencia[actual]) {
            if (arista.tipo != TipoRelacion::PRERREQUISITO || visitadas[arista.destino]) continue;
            visitadas[arista.destino] = true;
            pila.push(arista.destino);
        }
    }
    std::vector<Materia> resultado;
    // Orden estable del catalogo, independiente del orden de las aristas.
    for (int i = 0; i < grafo.getCantidadMaterias(); ++i) {
        if (i != origen && visitadas[i]) resultado.push_back(grafo.getMateria(i));
    }
    return resultado;
}

std::map<std::string, std::vector<Materia>> Planificador::todasLasDesbloqueadas(const Grafo& grafo) {
    std::map<std::string, std::vector<Materia>> resultado;
    for (const Materia& materia : grafo.getCatalogo()) {
        resultado[materia.getCodigo()] = desbloqueadas(grafo, materia.getCodigo());
    }
    return resultado;
}

std::vector<Propuesta> Planificador::generar(const Grafo& grafo, int cantidad, int maxCreditos) {
    if (cantidad <= 0 || maxCreditos <= 0) {
        throw std::invalid_argument("Cantidad y creditos deben ser enteros positivos");
    }
    const auto& candidatas = grafo.getHabilitadas();
    for (const Materia& m : grafo.getCatalogo()) {
        if (m.getCreditos() < 0) throw std::invalid_argument("Una materia tiene creditos negativos");
    }
    std::vector<Propuesta> resultado;
    std::vector<Materia> parcial;
    std::function<void(std::size_t, int)> buscar = [&](std::size_t inicio, int creditos) {
        if (static_cast<int>(parcial.size()) == cantidad) {
            // No se comprueban antes: un correquisito puede agregarse mas adelante.
            for (const Materia& m : parcial) {
                if (!grafo.correquisitosCumplidos(m.getCodigo(), parcial)) return;
            }
            resultado.push_back({parcial, creditos});
            return;
        }
        if (candidatas.size() - inicio < static_cast<std::size_t>(cantidad) - parcial.size()) return;
        for (std::size_t i = inicio; i < candidatas.size(); ++i) {
            const Materia& m = candidatas[i];
            if (grafo.estaAprobada(m.getCodigo())) continue;
            bool cumple = true;
            for (const std::string& pre : m.getPrerrequisitos()) {
                if (!grafo.estaAprobada(pre)) { cumple = false; break; }
            }
            if (!cumple || m.getCreditos() > maxCreditos - creditos) continue;
            parcial.push_back(m); // Elegir.
            buscar(i + 1, creditos + m.getCreditos()); // Explorar.
            parcial.pop_back(); // Deshacer para probar la siguiente combinacion.
        }
    };
    buscar(0, 0);
    return resultado;
}

void Planificador::ordenarPropuestas(std::vector<Propuesta>& propuestas, bool esExigente) {
    // Calcula la dificultad acumulada de todas las materias que componen la propuesta
    auto calcularDificultadTotal = [](const Propuesta& p) {
        int suma = 0;
        for (const Materia& m : p.materias) {
            suma += m.getDificultad();
        }
        return suma;
    };

    if (esExigente) {
        // Modo exigente: ordena de mayor a menor dificultad total.
        // Criterio de desempate: mayor cantidad de créditos.
        std::stable_sort(propuestas.begin(), propuestas.end(),
            [&](const Propuesta& a, const Propuesta& b) {
                int difA = calcularDificultadTotal(a);
                int difB = calcularDificultadTotal(b);
                if (difA != difB) {
                    return difA > difB;
                }
                return a.creditos > b.creditos;
            }
        );
    } else {
        // Modo suave: ordena de menor a mayor dificultad total (menor carga académica).
        // Criterio de desempate: menor cantidad de créditos.
        std::stable_sort(propuestas.begin(), propuestas.end(),
            [&](const Propuesta& a, const Propuesta& b) {
                int difA = calcularDificultadTotal(a);
                int difB = calcularDificultadTotal(b);
                if (difA != difB) {
                    return difA < difB;
                }
                return a.creditos < b.creditos;
            }
        );
    }
}

