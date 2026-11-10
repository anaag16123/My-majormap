#include "RutasPropuestas.h"
#include "../logic/Planificador.h"
#include <sstream>
#include <stdexcept>
#include <algorithm>

namespace {

// Tope de propuestas: con pensums reales hay millones de combinaciones.
const std::size_t MAX_PROPUESTAS = 100;
std::string escapar(const std::string& texto) {
    const char* hex = "0123456789abcdef";
    std::string resultado;
    for (unsigned char c : texto) {
        if (c == '"') resultado += "\\\"";
        else if (c == '\\') resultado += "\\\\";
        else if (c < 32) {
            resultado += "\\u00";
            resultado += hex[c >> 4];
            resultado += hex[c & 15];
        } else resultado += static_cast<char>(c);
    }
    return resultado;
}
void error(httplib::Response& res, int estado, const std::string& mensaje) {
    res.status = estado;
    res.set_content("{\"error\":\"" + escapar(mensaje) + "\"}", "application/json; charset=utf-8");
}
std::string materiaJson(const Materia& materia) {
    return "{\"codigo\":\"" + escapar(materia.getCodigo()) + "\",\"nombre\":\"" +
        escapar(materia.getNombre()) + "\",\"creditos\":" + std::to_string(materia.getCreditos()) +
        ",\"tipo\":\"" + escapar(materia.getTipo()) + "\"" +
        ",\"dificultad\":" + std::to_string(materia.getDificultad()) + "}";
}
std::string materiasJson(const std::vector<Materia>& materias) {
    std::string resultado = "[";
    for (std::size_t i = 0; i < materias.size(); ++i) {
        if (i) resultado += ",";
        resultado += materiaJson(materias[i]);
    }
    return resultado + "]";
}
int positivo(const std::string& texto) {
    if (texto.empty() || texto.find_first_not_of("0123456789") != std::string::npos)
        throw std::invalid_argument("Parametro invalido");
    int numero = std::stoi(texto);
    if (numero <= 0) throw std::invalid_argument("Parametro invalido");
    return numero;
}
std::vector<std::string> separarTrayectorias(const std::string& texto) {
    std::vector<std::string> resultado;
    std::stringstream stream(texto);
    std::string trayectoria;
    while (std::getline(stream, trayectoria, ',')) {
        if (!trayectoria.empty() &&
            std::find(resultado.begin(), resultado.end(), trayectoria) == resultado.end()) {
            resultado.push_back(trayectoria);
        }
    }
    return resultado;
}
std::vector<std::string> trayectoriasProfesionalizantes(const Grafo& grafo) {
    const std::string prefijo = "Trayectoria Profesionalizante: ";
    std::vector<std::string> resultado;
    for (const Materia& materia : grafo.getCatalogo()) {
        if (materia.getTipo().compare(0, prefijo.size(), prefijo) != 0) continue;
        std::string nombre = materia.getTipo().substr(prefijo.size());
        if (std::find(resultado.begin(), resultado.end(), nombre) == resultado.end()) {
            resultado.push_back(nombre);
        }
    }
    return resultado;
}
}

void registrarRutasPropuestas(httplib::Server& servidor, Contexto& ctx) {
    servidor.Get("/api/materia", [&ctx](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(ctx.candado);
        auto carrera = ctx.carreras.find(req.get_param_value("carrera"));
        if (carrera == ctx.carreras.end()) return error(res, 404, "Carrera no existe");
        const Grafo& grafo = carrera->second.grafo;
        std::string codigo = req.get_param_value("codigo");
        int indice = grafo.indiceDe(codigo);
        if (indice < 0) return error(res, 404, "Materia no existe");
        const Materia& materia = grafo.getMateria(indice);
        std::string json = materiaJson(materia);
        json.pop_back();
        json += ",\"estado\":\"" + estadoATexto(grafo.getEstado(codigo)) + "\"";
        json += ",\"prerrequisitos\":" + materiasJson(grafo.getPrerrequisitos(codigo));
        json += ",\"correquisitos\":" + materiasJson(grafo.getCorrequisitos(codigo));
        json += ",\"desbloquea\":" + materiasJson(Planificador::desbloqueadas(grafo, codigo)) + "}";
        res.set_content(json, "application/json; charset=utf-8");
    });
    servidor.Get("/api/propuestas", [&ctx](const httplib::Request& req, httplib::Response& res) {
        int cantidad, creditos;
        try {
            cantidad = positivo(req.get_param_value("cantidad"));
            creditos = positivo(req.get_param_value("creditos"));
        } catch (const std::exception&) {
            return error(res, 400, "Cantidad y creditos deben ser enteros positivos validos");
        }
        if (creditos > 24) return error(res, 400, "El máximo por semestre es de 24 créditos");

        // Lectura del parámetro de preferencia/exigencia
        // Permite soportar: exigente=true/1, preferencia=exigente/suave o modo=exigente/suave
        std::string paramExigente = req.get_param_value("exigente");
        if (paramExigente.empty()) {
            paramExigente = req.get_param_value("preferencia");
        }
        if (paramExigente.empty()) {
            paramExigente = req.get_param_value("modo");
        }
        bool esExigente = (paramExigente == "true" || paramExigente == "1" || paramExigente == "exigente");

        Grafo grafo;
        { // Copia consistente: la busqueda no bloquea las otras rutas.
            std::lock_guard<std::mutex> lock(ctx.candado);
            auto carrera = ctx.carreras.find(req.get_param_value("carrera"));
            if (carrera == ctx.carreras.end()) return error(res, 404, "Carrera no existe");
            grafo = carrera->second.grafo;
        }
        const auto disponibles = trayectoriasProfesionalizantes(grafo);
        const auto seleccionadas = separarTrayectorias(req.get_param_value("trayectorias"));
        if (disponibles.size() >= 2 && seleccionadas.size() != 2) {
            return error(res, 400, "Debes seleccionar exactamente dos trayectorias profesionalizantes");
        }
        for (const std::string& seleccionada : seleccionadas) {
            if (std::find(disponibles.begin(), disponibles.end(), seleccionada) == disponibles.end()) {
                return error(res, 400, "La trayectoria profesionalizante seleccionada no existe");
            }
        }
        try {
            // 1. Generación de combinaciones válidas (método de Isa)
            auto propuestas = Planificador::generar(grafo, cantidad, creditos, seleccionadas, MAX_PROPUESTAS, esExigente);

            // 2. Ordenamiento según el criterio del estudiante (suave vs exigente)
            Planificador::ordenarPropuestas(propuestas, esExigente);

            // 3. Serialización del resultado en formato JSON
            std::ostringstream json;
            json << "{\"cantidad\":" << cantidad
                 << ",\"maxCreditos\":" << creditos
                 << ",\"esExigente\":" << (esExigente ? "true" : "false")
                 << ",\"limitado\":" << (propuestas.size() >= MAX_PROPUESTAS ? "true" : "false")
                 << ",\"propuestas\":[";
            for (std::size_t i = 0; i < propuestas.size(); ++i) {
                if (i) json << ',';
                int difTotal = 0;
                for (const auto& m : propuestas[i].materias) {
                    difTotal += m.getDificultad();
                }
                json << "{\"creditos\":" << propuestas[i].creditos
                     << ",\"dificultadTotal\":" << difTotal
                     << ",\"materias\":" << materiasJson(propuestas[i].materias) << '}';
            }
            json << "]}";
            res.set_content(json.str(), "application/json; charset=utf-8");
        } catch (const std::invalid_argument& e) { error(res, 400, e.what()); }
    });
}
