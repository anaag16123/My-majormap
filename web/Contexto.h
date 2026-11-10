#ifndef CONTEXTO_H
#define CONTEXTO_H

#include <map>
#include <mutex>
#include <string>
#include <vector>
#include "../core/Grafo.h"
#include "../core/CargadorPensum.h"

// Estado compartido del servidor. Todas las rutas (las de Ana y las que
// agregue Isa) reciben una referencia a este objeto.
struct Carrera {
    std::string id;       // identificador corto usado en la URL, ej. "sistemas"
    std::string nombre;   // nombre que ve el usuario
    std::string archivo;  // CSV con el pensum
    Grafo grafo;          // grafo ya construido con ese pensum
    std::vector<RegistroTrayectoria> trayectorias; // Mapeos cargados de trayectoria_enfasis.csv
};

struct Contexto {
    std::map<std::string, Carrera> carreras;  // id -> carrera
    std::mutex candado;                       // httplib atiende peticiones en varios hilos
};

#endif
