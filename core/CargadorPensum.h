#ifndef CARGADOR_PENSUM_H
#define CARGADOR_PENSUM_H

#include <string>
#include <vector>
#include "Materia.h"

// Lee un pensum desde un archivo CSV separado por punto y coma (;).
// Formato de cada linea (la primera linea es el encabezado y se ignora):
// codigo;nombre;semestre;creditos;dificultad;prerrequisitos;correquisitos
// Las listas de prerrequisitos y correquisitos van separadas por comas, o vacias.
// Ejemplo: ED;Estructuras de datos;3;3;4;POO;
class CargadorPensum {
public:
    static bool cargar(const std::string& ruta,
                       std::vector<Materia>& materias,
                       std::string& error);
};

#endif
