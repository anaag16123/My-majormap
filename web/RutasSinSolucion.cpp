#include "RutasSinSolucion.h"
#include "../logic/AnalizadorBloqueo.h"
#include <sstream>
#include <stdexcept>
namespace {
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
int positivo(const std::string& texto) {
    if (texto.empty() || texto.find_first_not_of("0123456789") != std::string::npos)
        throw std::invalid_argument("Parametro invalido");
    int numero = std::stoi(texto);
    if (numero <= 0) throw std::invalid_argument("Parametro invalido");
    return numero;
}
std::string diagnosticoJson(const DiagnosticoBloqueo& d) {
    std::ostringstream json;
    json << "{\"bloqueado\":" << (d.bloqueado ? "true" : "false")
         << ",\"causa\":\"" << causaATexto(d.causa) << "\""
         << ",\"explicacion\":\"" << escapar(d.explicacion) << "\""
         << ",\"topeCreditos\":" << AnalizadorBloqueo::TOPE_CREDITOS
         << ",\"alternativas\":[";
    for (std::size_t i = 0; i < d.alternativas.size(); ++i) {
        const Alternativa& a = d.alternativas[i];
        if (i) json << ',';
        json << "{\"tipo\":\"" << tipoAlternativaATexto(a.tipo) << "\",\"cantidad\":" << a.cantidad
             << ",\"maxCreditos\":" << a.maxCreditos
             << ",\"descripcion\":\"" << escapar(a.descripcion) << "\"}";
    }
    json << "],\"habilitadas\":[";
    for (std::size_t i = 0; i < d.habilitadas.size(); ++i) {
        const Materia& m = d.habilitadas[i];
        if (i) json << ',';
        json << "{\"codigo\":\"" << escapar(m.getCodigo()) << "\",\"nombre\":\"" << escapar(m.getNombre())
             << "\",\"creditos\":" << m.getCreditos() << '}';
    }
    json << "]}";
    return json.str();
}
}
void registrarRutasSinSolucion(httplib::Server& servidor, Contexto& ctx) {
    // GET /api/bloqueo?carrera=..&cantidad=..&creditos=..
    // Mismos parametros que /api/propuestas. Si hay propuestas devuelve bloqueado=false.
    servidor.Get("/api/bloqueo", [&ctx](const httplib::Request& req, httplib::Response& res) {
        int cantidad, creditos;
        try {
            cantidad = positivo(req.get_param_value("cantidad"));
            creditos = positivo(req.get_param_value("creditos"));
        } catch (const std::exception&) {
            return error(res, 400, "Cantidad y creditos deben ser enteros positivos validos");
        }
        // trayectorias=A,B (opcional), igual que en /api/propuestas.
        std::vector<std::string> trayectorias;
        {
            std::stringstream partes(req.get_param_value("trayectorias"));
            std::string parte;
            while (std::getline(partes, parte, ',')) if (!parte.empty()) trayectorias.push_back(parte);
        }
        Grafo grafo;
        { // Copia consistente, igual que en /api/propuestas.
            std::lock_guard<std::mutex> lock(ctx.candado);
            auto carrera = ctx.carreras.find(req.get_param_value("carrera"));
            if (carrera == ctx.carreras.end()) return error(res, 404, "Carrera no existe");
            grafo = carrera->second.grafo;
        }
        try {
            res.set_content(diagnosticoJson(AnalizadorBloqueo::analizar(grafo, cantidad, creditos, trayectorias)),
                            "application/json; charset=utf-8");
        } catch (const std::invalid_argument& e) { error(res, 400, e.what()); }
    });
}
