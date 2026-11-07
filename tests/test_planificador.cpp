#include "../logic/Planificador.h"
#include "../core/CargadorPensum.h"
#include <cassert>
#include <iostream>
#include <set>
#include <stdexcept>
std::set<std::string> codigos(const std::vector<Materia>& materias) {
    std::set<std::string> r;
    for (const auto& m : materias) r.insert(m.getCodigo());
    return r;
}
int main() {
    std::vector<Materia> materias;
    std::string error;
    assert(CargadorPensum::cargar("data/prueba.csv", materias, error));
    Grafo g;
    assert(g.construir(materias, error));
    assert(codigos(Planificador::desbloqueadas(g, "INTRO")) == std::set<std::string>({"POO", "ED", "ADA"}));
    assert(codigos(Planificador::desbloqueadas(g, "CAL1")) == std::set<std::string>({"CAL2", "FIS1"}));
    assert(Planificador::desbloqueadas(g, "ADA").empty());
    assert(Planificador::todasLasDesbloqueadas(g).size() == materias.size());
    assert(Planificador::generar(g, 2, 7).size() == 3);
    assert(Planificador::generar(g, 2, 6).size() == 1);
    assert(Planificador::generar(g, 2, 5).empty());
    assert(Planificador::generar(g, 50, 100).empty());
    g.marcarAprobada("CAL1");
    auto propuestas = Planificador::generar(g, 2, 4);
    assert(propuestas.size() == 1);
    assert(codigos(propuestas[0].materias) == std::set<std::string>({"FIS1", "LABF1"}));
    assert(propuestas[0].creditos == 4);
    for (const auto& p : Planificador::generar(g, 1, 10)) {
        assert(!codigos(p.materias).count("FIS1"));
        assert(!codigos(p.materias).count("LABF1"));
    }
    g.marcarAprobada("LABF1");
    bool encontro = false;
    for (const auto& p : Planificador::generar(g, 1, 3)) {
        if (codigos(p.materias).count("FIS1")) encontro = true;
    }
    assert(encontro);
    g.desmarcarAprobada("CAL1");
    for (const auto& p : Planificador::generar(g, 2, 10)) {
        assert(!codigos(p.materias).count("CAL2"));
        assert(!codigos(p.materias).count("FIS1"));
    }
    // Requisito dentro de la misma propuesta NO sustituye una aprobacion previa.
    assert(Planificador::generar(g, 1, 10).size() == 3);
    // Ciclo: DFS termina y excluye el origen; diamante: sin duplicados.
    std::vector<Materia> ciclo = {
        Materia("A", "A", 1, 1, 1, {"B"}, {}),
        Materia("B", "B", 1, 1, 1, {"A"}, {})};
    assert(g.construir(ciclo, error));
    assert(codigos(Planificador::desbloqueadas(g, "A")) == std::set<std::string>({"B"}));
    std::vector<Materia> diamante = {
        Materia("A", "A", 1, 1, 1, {}, {}), Materia("B", "B", 1, 1, 1, {"A"}, {}),
        Materia("C", "C", 1, 1, 1, {"A"}, {}), Materia("D", "D", 1, 1, 1, {"B", "C"}, {})};
    assert(g.construir(diamante, error));
    assert(Planificador::desbloqueadas(g, "A").size() == 3);
    bool lanzo = false;
    try { Planificador::generar(g, 0, 7); } catch (const std::invalid_argument&) { lanzo = true; }
    assert(lanzo);
    lanzo = false;
    try { Planificador::desbloqueadas(g, "NO_EXISTE"); } catch (const std::invalid_argument&) { lanzo = true; }
    assert(lanzo);
    std::cout << "Todas las pruebas del planificador pasaron.\n";
}
