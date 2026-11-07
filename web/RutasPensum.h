#ifndef RUTAS_PENSUM_H
#define RUTAS_PENSUM_H

#include "httplib.h"
#include "Contexto.h"

// Rutas de Ana: carreras, pensum con estados, marcar/desmarcar aprobadas.
//   GET  /api/carreras
//   GET  /api/pensum?carrera=ID
//   POST /api/aprobada?carrera=ID&codigo=COD&aprobada=true|false
void registrarRutasPensum(httplib::Server& servidor, Contexto& ctx);

#endif
