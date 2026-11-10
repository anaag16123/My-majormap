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
    // Materias habilitadas que el estudiante puede elegir: descarta las de una
    // trayectoria profesionalizante que no seleccionó (lista vacia = sin filtro).
    static std::vector<Materia> habilitadasPermitidas(
        const Grafo& grafo, const std::vector<std::string>& trayectoriasProfesionalizantes);
    // Exactamente cantidad materias y a lo sumo maxCreditos. Sin duplicados.
    static std::vector<Propuesta> generar(
        const Grafo& grafo,
        int cantidad,
        int maxCreditos,
        const std::vector<std::string>& trayectoriasProfesionalizantes = {},
        // 0 = sin limite. Si es > 0, la busqueda se detiene al encontrar esa cantidad de
        // propuestas y prueba primero las materias mas faciles (suave) o mas dificiles (exigente).
        std::size_t maxResultados = 0,
        bool exigente = false);
    // Ordena las propuestas según la preferencia de exigencia:
    // - Modo suave (esExigente = false): menor dificultad/carga académica (menor a mayor).
    // - Modo exigente (esExigente = true): mayor dificultad total (mayor a menor).
    static void ordenarPropuestas(std::vector<Propuesta>& propuestas, bool esExigente);
};
#endif
