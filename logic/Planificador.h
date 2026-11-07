#ifndef PLANIFICADOR_H
#define PLANIFICADOR_H
#include "../core/Grafo.h"
#include <map>
#include <string>
#include <vector>

struct Propuesta {
    std::vector<Materia> materias;
    int creditos;
};
class Planificador {
public:
    // Alcanzabilidad por aristas de prerrequisito; no incluye correquisitos.
    static std::vector<Materia> desbloqueadas(const Grafo& grafo, const std::string& codigo);
    static std::map<std::string, std::vector<Materia>> todasLasDesbloqueadas(const Grafo& grafo);
    // Exactamente cantidad materias y a lo sumo maxCreditos. Sin duplicados.
    static std::vector<Propuesta> generar(const Grafo& grafo, int cantidad, int maxCreditos);
};
#endif
