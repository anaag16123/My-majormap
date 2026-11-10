#ifndef MATERIA_H
#define MATERIA_H

#include <string>
#include <vector>

// Una materia del pensum. Es el nodo del grafo.
class Materia {
private:
    std::string codigo;
    std::string nombre;
    int semestre;
    int creditos;
    int dificultad;                          // escala acordada por el equipo (ej. 1 a 5)
    std::string tipo;                        // categoría del CSV, incluida la trayectoria
    std::vector<std::string> prerrequisitos; // codigos de materias que deben estar aprobadas
    std::vector<std::string> correquisitos;  // codigos que deben estar aprobadas o cursarse a la vez

public:
    Materia();
    Materia(const std::string& codigo,
            const std::string& nombre,
            int semestre,
            int creditos,
            int dificultad,
            const std::vector<std::string>& prerrequisitos,
            const std::vector<std::string>& correquisitos,
            const std::string& tipo = "");

    const std::string& getCodigo() const;
    const std::string& getNombre() const;
    int getSemestre() const;
    int getCreditos() const;
    int getDificultad() const;
    const std::string& getTipo() const;
    const std::vector<std::string>& getPrerrequisitos() const;
    const std::vector<std::string>& getCorrequisitos() const;

    std::string toString() const;
};

#endif
