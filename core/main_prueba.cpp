// Prueba del modulo de Ana: carga el pensum de prueba, arma el grafo
// y muestra el estado de cada materia antes y despues de marcar aprobadas.
#include <iostream>
#include "CargadorPensum.h"
#include "Grafo.h"

void imprimirEstados(const Grafo& grafo) {
    for (const Materia& m : grafo.getCatalogo()) {
        std::cout << "  [" << estadoATexto(grafo.getEstado(m.getCodigo())) << "] "
                  << m.toString() << "\n";
    }
    std::cout << "  Habilitadas: ";
    for (const Materia& m : grafo.getHabilitadas()) std::cout << m.getCodigo() << " ";
    std::cout << "\n\n";
}

int main() {
    std::vector<Materia> materias;
    std::string error;

    if (!CargadorPensum::cargar("data/prueba.csv", materias, error)) {
        std::cout << "Error cargando pensum: " << error << "\n";
        return 1;
    }

    Grafo grafo;
    if (!grafo.construir(materias, error)) {
        std::cout << "Error construyendo grafo: " << error << "\n";
        return 1;
    }

    std::cout << "=== Estudiante nuevo (nada aprobado) ===\n";
    imprimirEstados(grafo);

    std::cout << "=== Aprueba CAL1, INTRO y LOG ===\n";
    grafo.marcarAprobada("CAL1");
    grafo.marcarAprobada("INTRO");
    grafo.marcarAprobada("LOG");
    imprimirEstados(grafo);

    std::cout << "=== Desmarca CAL1 ===\n";
    grafo.desmarcarAprobada("CAL1");
    imprimirEstados(grafo);

    std::cout << "=== Detalle de ADA ===\n  Prerrequisitos: ";
    for (const Materia& m : grafo.getPrerrequisitos("ADA")) std::cout << m.getCodigo() << " ";
    std::cout << "\n\n";

    grafo.marcarAprobada("CAL1");
    std::cout << "=== Correquisitos de FIS1 ===\n";
    std::vector<Materia> sinLab = {materias[grafo.indiceDe("FIS1")]};
    std::vector<Materia> conLab = {materias[grafo.indiceDe("FIS1")], materias[grafo.indiceDe("LABF1")]};
    std::cout << "  Propuesta {FIS1}:        " << (grafo.correquisitosCumplidos("FIS1", sinLab) ? "valida" : "invalida") << "\n";
    std::cout << "  Propuesta {FIS1, LABF1}: " << (grafo.correquisitosCumplidos("FIS1", conLab) ? "valida" : "invalida") << "\n";

    return 0;
}
