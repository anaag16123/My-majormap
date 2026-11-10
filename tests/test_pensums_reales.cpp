#include "../core/CargadorPensum.h"
#include "../core/Grafo.h"
#include <cassert>
#include <iostream>
#include <string>
#include <vector>

void verificarPensum(const std::string& archivo, const std::string& nombreCarrera) {
    std::vector<Materia> materias;
    std::string error;
    bool ok = CargadorPensum::cargar(archivo, materias, error);
    if (!ok) {
        std::cerr << "Fallo al cargar " << archivo << ": " << error << "\n";
    }
    assert(ok);
    assert(!materias.empty());

    // Verificar dificultad en escala de 1 a 5 y que los NFIs lleguen maximo al 5 semestre
    for (const auto& m : materias) {
        assert(m.getDificultad() >= 1 && m.getDificultad() <= 5);
        assert(!m.getCodigo().empty());
        assert(!m.getNombre().empty());
        assert(m.getSemestre() >= 1);
        assert(m.getCreditos() >= 0);
        if (m.getTipo() == "NFI") {
            assert(m.getSemestre() <= 5);
        }
    }

    Grafo g;
    ok = g.construir(materias, error);
    if (!ok) {
        std::cerr << "Fallo al construir grafo de " << nombreCarrera << " (" << archivo << "): " << error << "\n";
    }
    assert(ok);
    assert(g.getCantidadMaterias() == static_cast<int>(materias.size()));

    std::cout << "[OK] " << nombreCarrera << " cargada correctamente (" << materias.size() << " materias).\n";
}

int main() {
    std::cout << "Verificando pensums reales...\n";
    verificarPensum("data/ingenieria_sistemas.csv", "Ingenieria de Sistemas");
    verificarPensum("data/ingenieria_matematica.csv", "Ingenieria Matematica");
    verificarPensum("data/ingenieria_fisica.csv", "Ingenieria Fisica");

    // Verificar independencia de estados entre carreras
    std::vector<Materia> matSis, matMat;
    std::string error;
    assert(CargadorPensum::cargar("data/ingenieria_sistemas.csv", matSis, error));
    assert(CargadorPensum::cargar("data/ingenieria_matematica.csv", matMat, error));

    Grafo gSis, gMat;
    assert(gSis.construir(matSis, error));
    assert(gMat.construir(matMat, error));

    // Supongamos que marcamos aprobada NM1001 en sistemas (Calculo 1)
    assert(gSis.marcarAprobada("NM1001"));
    assert(gSis.estaAprobada("NM1001"));
    // En matematica, su codigo de calculo o sus materias no deben tener aprobada la de sistemas
    assert(gMat.indiceDe("NM1001") == -1 || !gMat.estaAprobada("NM1001"));

    std::cout << "[OK] Estados independientes entre carreras verificados con exito.\n";

    // Verificar trayectoria_enfasis.csv y reglas de ST1631, ST1632, ST1633
    std::vector<RegistroTrayectoria> registros;
    assert(CargadorPensum::cargarTrayectorias("data/trayectoria_enfasis.csv", registros, error));
    assert(!registros.empty());

    std::vector<Materia> matFis;
    assert(CargadorPensum::cargar("data/ingenieria_fisica.csv", matFis, error));
    Grafo gFis;
    assert(gFis.construir(matFis, error));

    // Verificar que todas las materias de trayectoria_enfasis.csv existan en su carrera
    for (const auto& reg : registros) {
        if (reg.programa.find("Sistemas") != std::string::npos) {
            assert(gSis.indiceDe(reg.codigo) >= 0);
        } else if (reg.programa.find("Física") != std::string::npos || reg.programa.find("Fisica") != std::string::npos) {
            assert(gFis.indiceDe(reg.codigo) >= 0);
        }
    }

    // Comprobar apariciones de ST1631, ST1632, ST1633
    std::vector<std::string> electivas = {"ST1631", "ST1632", "ST1633"};
    for (const auto& cod : electivas) {
        // En Sistemas deben salir en Infraestructura TI, Desarrollo de Software y Sistemas de Información
        bool enInfra = false, enDesSoft = false, enSisInf = false, enOtras = false;
        // En Física deben salir únicamente en Desarrollo de Software
        bool enFisDesSoft = false, enFisOtras = false;

        for (const auto& reg : registros) {
            if (reg.codigo != cod) continue;
            if (reg.programa.find("Sistemas") != std::string::npos) {
                if (reg.grupo == "Infraestructura TI") enInfra = true;
                else if (reg.grupo == "Desarrollo de Software") enDesSoft = true;
                else if (reg.grupo == "Sistemas de Información") enSisInf = true;
                else enOtras = true;
            } else if (reg.programa.find("Física") != std::string::npos || reg.programa.find("Fisica") != std::string::npos) {
                if (reg.grupo == "Desarrollo de Software") enFisDesSoft = true;
                else enFisOtras = true;
            }
        }
        assert(enInfra);
        assert(enDesSoft);
        assert(enSisInf);
        assert(!enOtras);

        assert(enFisDesSoft);
        assert(!enFisOtras);
    }
    std::cout << "[OK] Reglas especiales para ST1631, ST1632 y ST1633 verificadas con exito.\n";

    std::cout << "Todas las verificaciones de pensums reales pasaron exitosamente.\n";
    return 0;
}
