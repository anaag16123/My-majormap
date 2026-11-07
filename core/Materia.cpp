#include "Materia.h"

Materia::Materia() : semestre(0), creditos(0), dificultad(0) {}

Materia::Materia(const std::string& codigo,
                 const std::string& nombre,
                 int semestre,
                 int creditos,
                 int dificultad,
                 const std::vector<std::string>& prerrequisitos,
                 const std::vector<std::string>& correquisitos)
    : codigo(codigo),
      nombre(nombre),
      semestre(semestre),
      creditos(creditos),
      dificultad(dificultad),
      prerrequisitos(prerrequisitos),
      correquisitos(correquisitos) {}

const std::string& Materia::getCodigo() const { return codigo; }
const std::string& Materia::getNombre() const { return nombre; }
int Materia::getSemestre() const { return semestre; }
int Materia::getCreditos() const { return creditos; }
int Materia::getDificultad() const { return dificultad; }
const std::vector<std::string>& Materia::getPrerrequisitos() const { return prerrequisitos; }
const std::vector<std::string>& Materia::getCorrequisitos() const { return correquisitos; }

std::string Materia::toString() const {
    return codigo + " - " + nombre +
           " | Semestre " + std::to_string(semestre) +
           " | " + std::to_string(creditos) + " creditos" +
           " | Dificultad " + std::to_string(dificultad) + "/5";
}
