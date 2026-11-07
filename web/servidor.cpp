// Servidor web de My MajorMap. Sirve la pagina (web/public) y la API JSON.
// Ejecutar desde la raiz del proyecto: web\servidor.exe
#include <iostream>
#include "httplib.h"
#include "Contexto.h"
#include "RutasPensum.h"
#include "RutasPropuestas.h"
#include "RutasSinSolucion.h"
#include "../core/CargadorPensum.h"
// Aqui se incluye el header de las rutas de cada integrante, ej. #include "RutasPropuestas.h"

static bool agregarCarrera(Contexto& ctx, const std::string& id,
                           const std::string& nombre, const std::string& archivo) {
    std::vector<Materia> materias;
    std::string error;
    if (!CargadorPensum::cargar(archivo, materias, error)) {
        std::cerr << "Error cargando " << archivo << ": " << error << "\n";
        return false;
    }
    Carrera& c = ctx.carreras[id];
    c.id = id;
    c.nombre = nombre;
    c.archivo = archivo;
    if (!c.grafo.construir(materias, error)) {
        std::cerr << "Error construyendo grafo de " << nombre << ": " << error << "\n";
        return false;
    }
    return true;
}

int main() {
    Contexto ctx;

    // Por ahora las tres carreras usan el pensum de prueba.
    // Cuando Lau suba los reales, solo se cambia el nombre del CSV.
    bool ok = agregarCarrera(ctx, "sistemas",   "Ingenieria de Sistemas", "data/prueba.csv")
           && agregarCarrera(ctx, "matematica", "Matematica",             "data/prueba.csv")
           && agregarCarrera(ctx, "fisica",     "Fisica",                 "data/prueba.csv");
    if (!ok) return 1;

    httplib::Server servidor;
    if (!servidor.set_mount_point("/", "web/public")) {
        std::cerr << "No encuentro web/public. Ejecuta desde la raiz del proyecto.\n";
        return 1;
    }

    // Cada integrante crea su propio par RutasXxx.h/.cpp con una funcion
    // registrarRutasXxx(httplib::Server&, Contexto&) (ver RutasPensum.cpp de modelo)
    // y la registra aqui con una linea. Asi nadie toca el codigo de los demas.
    registrarRutasPensum(servidor, ctx);               // Ana: pensum y aprobadas
    registrarRutasPropuestas(servidor, ctx);        // Isa: DFS y backtracking (generar propuestas)
    // registrarRutasPriorizacion(servidor, ctx);      // Wen: priorizacion / ordenar propuestas
    registrarRutasSinSolucion(servidor, ctx);         // Samu: explicacion sin solucion y recalcular
    // Recuerda agregar tu .cpp al comando de compilacion.

    std::cout << "My MajorMap en http://localhost:8080  (Ctrl+C para cerrar)\n";
    if (!servidor.listen("127.0.0.1", 8080)) {
        std::cerr << "No pude abrir el puerto 8080 (esta ocupado?)\n";
        return 1;
    }
    return 0;
}
