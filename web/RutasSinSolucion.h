#ifndef RUTAS_SIN_SOLUCION_H
#define RUTAS_SIN_SOLUCION_H
#include "httplib.h"
#include "Contexto.h"
// Samu: explicacion del bloqueo y alternativas cuando no hay propuestas.
void registrarRutasSinSolucion(httplib::Server& servidor, Contexto& ctx);
#endif
