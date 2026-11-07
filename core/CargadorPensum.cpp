#include "CargadorPensum.h"

#include <fstream>
#include <sstream>

static std::string recortar(const std::string& texto) {
    size_t inicio = texto.find_first_not_of(" \t\r\n");
    if (inicio == std::string::npos) return "";
    size_t fin = texto.find_last_not_of(" \t\r\n");
    return texto.substr(inicio, fin - inicio + 1);
}

static std::vector<std::string> separar(const std::string& texto, char separador) {
    std::vector<std::string> partes;
    std::stringstream ss(texto);
    std::string parte;
    while (std::getline(ss, parte, separador)) {
        partes.push_back(recortar(parte));
    }
    // getline no devuelve el ultimo campo si esta vacio (ej. "a;b;")
    if (!texto.empty() && texto.back() == separador) partes.push_back("");
    return partes;
}

static std::vector<std::string> separarLista(const std::string& texto) {
    std::vector<std::string> lista;
    for (const std::string& codigo : separar(texto, ',')) {
        if (!codigo.empty()) lista.push_back(codigo);
    }
    return lista;
}

bool CargadorPensum::cargar(const std::string& ruta,
                            std::vector<Materia>& materias,
                            std::string& error) {
    std::ifstream archivo(ruta);
    if (!archivo.is_open()) {
        error = "No se pudo abrir el archivo: " + ruta;
        return false;
    }

    materias.clear();
    std::string linea;
    int numeroLinea = 0;

    while (std::getline(archivo, linea)) {
        numeroLinea++;
        linea = recortar(linea);
        if (numeroLinea == 1 || linea.empty()) continue; // encabezado o linea vacia

        std::vector<std::string> campos = separar(linea, ';');
        if (campos.size() < 5) {
            error = "Linea " + std::to_string(numeroLinea) + ": faltan campos";
            return false;
        }
        while (campos.size() < 7) campos.push_back("");

        try {
            materias.emplace_back(campos[0],
                                  campos[1],
                                  std::stoi(campos[2]),
                                  std::stoi(campos[3]),
                                  std::stoi(campos[4]),
                                  separarLista(campos[5]),
                                  separarLista(campos[6]));
        } catch (...) {
            error = "Linea " + std::to_string(numeroLinea) +
                    ": semestre, creditos y dificultad deben ser numeros";
            return false;
        }
    }
    return true;
}
