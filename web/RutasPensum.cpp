#include "RutasPensum.h"

#include <sstream>

namespace {

// Escapa un texto para meterlo dentro de un string JSON.
std::string esc(const std::string& s) {
    std::string r;
    for (char c : s) {
        switch (c) {
            case '"':  r += "\\\""; break;
            case '\\': r += "\\\\"; break;
            case '\n': r += "\\n";  break;
            case '\r': break;
            default:   r += c;
        }
    }
    return r;
}

std::string listaJson(const std::vector<std::string>& v) {
    std::string r = "[";
    for (size_t i = 0; i < v.size(); i++) {
        if (i) r += ",";
        r += "\"" + esc(v[i]) + "\"";
    }
    return r + "]";
}

std::string pensumJson(const Carrera& c) {
    const Grafo& g = c.grafo;
    std::ostringstream o;
    o << "{\"carrera\":\"" << esc(c.id) << "\",\"nombre\":\"" << esc(c.nombre)
      << "\",\"materias\":[";
    bool primera = true;
    for (const Materia& m : g.getCatalogo()) {
        if (!primera) o << ",";
        primera = false;
        o << "{\"codigo\":\"" << esc(m.getCodigo()) << "\""
          << ",\"nombre\":\"" << esc(m.getNombre()) << "\""
          << ",\"semestre\":" << m.getSemestre()
          << ",\"creditos\":" << m.getCreditos()
          << ",\"dificultad\":" << m.getDificultad()
          << ",\"tipo\":\"" << esc(m.getTipo()) << "\""
          << ",\"prerrequisitos\":" << listaJson(m.getPrerrequisitos())
          << ",\"correquisitos\":" << listaJson(m.getCorrequisitos())
          << ",\"estado\":\"" << estadoATexto(g.getEstado(m.getCodigo())) << "\"}";
    }
    o << "],\"trayectorias\":[";
    bool primerReg = true;
    for (const auto& t : c.trayectorias) {
        if (!primerReg) o << ",";
        primerReg = false;
        o << "{\"codigo\":\"" << esc(t.codigo) << "\""
          << ",\"nombre\":\"" << esc(t.nombre) << "\""
          << ",\"grupo\":\"" << esc(t.grupo) << "\""
          << ",\"tipo_grupo\":\"" << esc(t.tipoGrupo) << "\"}";
    }
    o << "]}";
    return o.str();
}

std::string trayectoriasJson(const Carrera& c) {
    std::ostringstream o;
    o << "[";
    bool primerReg = true;
    for (const auto& t : c.trayectorias) {
        if (!primerReg) o << ",";
        primerReg = false;
        o << "{\"codigo\":\"" << esc(t.codigo) << "\""
          << ",\"nombre\":\"" << esc(t.nombre) << "\""
          << ",\"grupo\":\"" << esc(t.grupo) << "\""
          << ",\"tipo_grupo\":\"" << esc(t.tipoGrupo) << "\"}";
    }
    o << "]";
    return o.str();
}

void responderError(httplib::Response& res, int status, const std::string& msg) {
    res.status = status;
    res.set_content("{\"error\":\"" + esc(msg) + "\"}", "application/json; charset=utf-8");
}

}  // namespace

void registrarRutasPensum(httplib::Server& servidor, Contexto& ctx) {
    servidor.Get("/api/carreras", [&ctx](const httplib::Request&, httplib::Response& res) {
        std::string r = "[";
        bool primera = true;
        for (const auto& par : ctx.carreras) {
            if (!primera) r += ",";
            primera = false;
            r += "{\"id\":\"" + esc(par.second.id) + "\",\"nombre\":\"" + esc(par.second.nombre) + "\"}";
        }
        r += "]";
        res.set_content(r, "application/json; charset=utf-8");
    });

    servidor.Get("/api/pensum", [&ctx](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(ctx.candado);
        auto it = ctx.carreras.find(req.get_param_value("carrera"));
        if (it == ctx.carreras.end()) return responderError(res, 404, "Carrera no existe");
        res.set_content(pensumJson(it->second), "application/json; charset=utf-8");
    });

    servidor.Get("/api/trayectorias", [&ctx](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(ctx.candado);
        auto it = ctx.carreras.find(req.get_param_value("carrera"));
        if (it == ctx.carreras.end()) return responderError(res, 404, "Carrera no existe");
        res.set_content(trayectoriasJson(it->second), "application/json; charset=utf-8");
    });

    servidor.Post("/api/aprobada", [&ctx](const httplib::Request& req, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(ctx.candado);
        auto it = ctx.carreras.find(req.get_param_value("carrera"));
        if (it == ctx.carreras.end()) return responderError(res, 404, "Carrera no existe");

        Grafo& g = it->second.grafo;
        std::string codigo = req.get_param_value("codigo");
        bool aprobar = req.get_param_value("aprobada") == "true";

        // El Grafo recalcula las habilitadas (BFS) dentro de estos metodos.
        bool ok = aprobar ? g.marcarAprobada(codigo) : g.desmarcarAprobada(codigo);
        if (!ok) return responderError(res, 404, "Materia no existe: " + codigo);
        res.set_content(pensumJson(it->second), "application/json; charset=utf-8");
    });
}
