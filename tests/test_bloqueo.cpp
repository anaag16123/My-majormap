#include "../logic/AnalizadorBloqueo.h"
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
// minimoCreditos debe coincidir con el minimo de todas las combinaciones de generar.
void verificarMinimo(const Grafo& g) {
    for (int k = 1; k <= g.getCantidadMaterias() + 1; ++k) {
        int esperado = -1;
        for (const auto& p : Planificador::generar(g, k, 1000)) {
            if (esperado == -1 || p.creditos < esperado) esperado = p.creditos;
        }
        assert(AnalizadorBloqueo::minimoCreditos(g, k) == esperado);
    }
}
// El diagnostico coincide con generar y cada alternativa propuesta si tiene solucion.
DiagnosticoBloqueo analizar(const Grafo& g, int cantidad, int creditos) {
    DiagnosticoBloqueo d = AnalizadorBloqueo::analizar(g, cantidad, creditos);
    assert(d.bloqueado == Planificador::generar(g, cantidad, creditos).empty());
    for (const auto& a : d.alternativas) {
        assert(!Planificador::generar(g, a.cantidad, a.maxCreditos).empty());
        assert(!a.descripcion.empty());
    }
    return d;
}
int main() {
    std::vector<Materia> materias;
    std::string error;
    assert(CargadorPensum::cargar("data/prueba.csv", materias, error));
    Grafo g;
    assert(g.construir(materias, error));
    // Sin aprobadas, las habilitadas son CAL1 (4), INTRO (3) y LOG (3).
    verificarMinimo(g);
    assert(AnalizadorBloqueo::minimoCreditos(g, 2) == 6);
    assert(AnalizadorBloqueo::minimoCreditos(g, 4) == -1);
    // Con solucion no hay bloqueo ni alternativas.
    auto d = analizar(g, 2, 7);
    assert(!d.bloqueado && d.causa == CausaBloqueo::NINGUNA && d.alternativas.empty());
    // Creditos insuficientes: menos materias o subir al minimo necesario.
    d = analizar(g, 2, 5);
    assert(d.bloqueado && d.causa == CausaBloqueo::CREDITOS_INSUFICIENTES);
    assert(!d.explicacion.empty());
    assert(codigos(d.habilitadas) == std::set<std::string>({"CAL1", "INTRO", "LOG"}));
    assert(d.alternativas.size() == 2);
    assert(d.alternativas[0].tipo == TipoAlternativa::MENOS_MATERIAS);
    assert(d.alternativas[0].cantidad == 1 && d.alternativas[0].maxCreditos == 5);
    assert(d.alternativas[1].tipo == TipoAlternativa::MAS_CREDITOS);
    assert(d.alternativas[1].cantidad == 2 && d.alternativas[1].maxCreditos == 6);
    // Pocas habilitadas: la mayor cantidad posible con los mismos creditos.
    d = analizar(g, 50, 100);
    assert(d.causa == CausaBloqueo::POCAS_HABILITADAS);
    assert(d.alternativas.size() == 1);
    assert(d.alternativas[0].tipo == TipoAlternativa::MENOS_MATERIAS);
    assert(d.alternativas[0].cantidad == 3 && d.alternativas[0].maxCreditos == 100);
    // Con aprobadas cambian las habilitadas: CAL2, POO, FIS1, LABF1 y DISC.
    for (const char* codigo : {"CAL1", "INTRO", "LOG"}) g.marcarAprobada(codigo);
    verificarMinimo(g);
    d = analizar(g, 5, 10);
    assert(d.causa == CausaBloqueo::CREDITOS_INSUFICIENTES);
    assert(d.alternativas.size() == 2);
    assert(d.alternativas[0].cantidad == 4 && d.alternativas[0].maxCreditos == 10);
    assert(d.alternativas[1].cantidad == 5 && d.alternativas[1].maxCreditos == 14);
    // Todo aprobado: no hay habilitadas ni alternativas.
    for (const auto& m : materias) g.marcarAprobada(m.getCodigo());
    d = analizar(g, 1, 10);
    assert(d.causa == CausaBloqueo::SIN_HABILITADAS);
    assert(d.habilitadas.empty() && d.alternativas.empty());
    // Correquisitos mutuos: una sola materia es imposible, la cercana es tomar ambas.
    std::vector<Materia> par = {
        Materia("A", "A", 1, 3, 1, {}, {"B"}), Materia("B", "B", 1, 2, 1, {}, {"A"})};
    assert(g.construir(par, error));
    verificarMinimo(g);
    d = analizar(g, 1, 10);
    assert(d.causa == CausaBloqueo::CORREQUISITOS);
    assert(d.explicacion.find("A debe cursarse junto con B") != std::string::npos);
    assert(d.alternativas.size() == 1);
    assert(d.alternativas[0].tipo == TipoAlternativa::MAS_MATERIAS);
    assert(d.alternativas[0].cantidad == 2 && d.alternativas[0].maxCreditos == 10);
    // Si el maximo no alcanza para ambas, la alternativa sube los creditos al minimo.
    d = analizar(g, 1, 4);
    assert(d.alternativas.size() == 1);
    assert(d.alternativas[0].cantidad == 2 && d.alternativas[0].maxCreditos == 5);
    // Tope de 24: no se propone subir creditos por encima del tope acordado.
    std::vector<Materia> pesadas = {
        Materia("X", "X", 1, 10, 1, {}, {}), Materia("Y", "Y", 1, 10, 1, {}, {}),
        Materia("Z", "Z", 1, 10, 1, {}, {})};
    assert(g.construir(pesadas, error));
    d = analizar(g, 3, 20);
    assert(d.causa == CausaBloqueo::CREDITOS_INSUFICIENTES);
    assert(d.explicacion.find("24") != std::string::npos);
    assert(d.alternativas.size() == 1);
    assert(d.alternativas[0].tipo == TipoAlternativa::MENOS_MATERIAS);
    assert(d.alternativas[0].cantidad == 2 && d.alternativas[0].maxCreditos == 20);
    // Parametros invalidos.
    bool lanzo = false;
    try { AnalizadorBloqueo::analizar(g, 0, 10); } catch (const std::invalid_argument&) { lanzo = true; }
    assert(lanzo);
    lanzo = false;
    try { AnalizadorBloqueo::analizar(g, 1, 0); } catch (const std::invalid_argument&) { lanzo = true; }
    assert(lanzo);
    std::cout << "Todas las pruebas del analizador de bloqueo pasaron.\n";
}
