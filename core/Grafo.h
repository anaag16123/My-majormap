#ifndef GRAFO_H
#define GRAFO_H

#include <string>
#include <unordered_map>
#include <vector>
#include "Materia.h"

// Tipo de relacion que representa una arista.
enum class TipoRelacion { PRERREQUISITO, CORREQUISITO };

// Estado de una materia para el codigo de colores de la interfaz.
enum class EstadoMateria { APROBADA, HABILITADA, BLOQUEADA };

// Arista dirigida: de una materia "origen" hacia la materia que la necesita.
// Ejemplo: Calculo I -> Calculo II (Calculo I desbloquea Calculo II).
struct Arista {
    int destino;          // indice de la materia destino en el catalogo
    TipoRelacion tipo;
};

// Grafo dirigido de la malla curricular con lista de adyacencia.
// Los nodos se guardan por indice en el vector "catalogo".
class Grafo {
private:
    std::vector<Materia> catalogo;                       // todas las materias de la carrera
    std::vector<std::vector<Arista>> adyacencia;         // adyacencia[i] = aristas que salen de la materia i
    std::unordered_map<std::string, int> indicePorCodigo; // codigo -> indice en catalogo

    std::vector<Materia> aprobadas;    // materias que el estudiante marco como aprobadas
    std::vector<Materia> habilitadas;  // materias que puede cursar el proximo semestre
    std::vector<bool> esAprobada;      // auxiliar para consultar en O(1)
    std::vector<EstadoMateria> estados;

    void reconstruirAprobadas();

public:
    Grafo();

    // Construye el grafo a partir del catalogo. Devuelve false y llena "error"
    // si hay codigos repetidos o requisitos que apuntan a materias que no existen.
    bool construir(const std::vector<Materia>& materias, std::string& error);

    // Marcar / desmarcar aprobadas. Recalculan las habilitadas automaticamente.
    bool marcarAprobada(const std::string& codigo);
    bool desmarcarAprobada(const std::string& codigo);
    bool estaAprobada(const std::string& codigo) const;

    // Busqueda en anchura (BFS) que identifica las materias habilitadas
    // y asigna el estado de cada materia. O(V + E).
    void calcularHabilitadas();

    // Para la regla de correquisitos en el backtracking:
    // cada correquisito debe estar aprobado o ir en la misma propuesta.
    bool correquisitosCumplidos(const std::string& codigo,
                                const std::vector<Materia>& propuesta) const;

    // Consultas
    int indiceDe(const std::string& codigo) const;  // -1 si no existe
    const Materia& getMateria(int indice) const;
    EstadoMateria getEstado(const std::string& codigo) const;
    std::vector<Materia> getPrerrequisitos(const std::string& codigo) const;
    std::vector<Materia> getCorrequisitos(const std::string& codigo) const;

    const std::vector<Materia>& getCatalogo() const;
    const std::vector<Materia>& getAprobadas() const;
    const std::vector<Materia>& getHabilitadas() const;
    const std::vector<std::vector<Arista>>& getAdyacencia() const; // para el DFS de Isa
    int getCantidadMaterias() const;
};

std::string estadoATexto(EstadoMateria estado);

#endif
