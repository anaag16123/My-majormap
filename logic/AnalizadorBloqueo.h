#ifndef ANALIZADOR_BLOQUEO_H
#define ANALIZADOR_BLOQUEO_H
#include "../core/Grafo.h"
#include <string>
#include <vector>
// Causa por la que ninguna combinacion cumple las condiciones del estudiante.
enum class CausaBloqueo {
    NINGUNA,                // si hay combinaciones: no esta bloqueado
    SIN_HABILITADAS,        // no hay ninguna materia que se pueda cursar
    POCAS_HABILITADAS,      // hay menos habilitadas que la cantidad pedida
    CORREQUISITOS,          // los correquisitos impiden armar exactamente esa cantidad
    CREDITOS_INSUFICIENTES  // la combinacion mas liviana supera el maximo de creditos
};
enum class TipoAlternativa {
    MENOS_MATERIAS,  // misma cantidad de creditos, menos materias
    MAS_CREDITOS,    // misma cantidad de materias, mas creditos (sin pasar el tope)
    MAS_MATERIAS     // solo cuando un correquisito obliga a tomar materias juntas
};
// Parametros con los que si existe al menos una combinacion valida.
struct Alternativa {
    TipoAlternativa tipo;
    int cantidad;
    int maxCreditos;
    std::string descripcion;
};
struct DiagnosticoBloqueo {
    bool bloqueado = false;
    CausaBloqueo causa = CausaBloqueo::NINGUNA;
    std::string explicacion;
    std::vector<Alternativa> alternativas;
    std::vector<Materia> habilitadas;  // opciones disponibles para el caso
};
class AnalizadorBloqueo {
public:
    // Maximo de creditos por semestre acordado por el equipo.
    static constexpr int TOPE_CREDITOS = 24;
    // Menor suma de creditos de una combinacion valida de exactamente "cantidad"
    // materias habilitadas (con correquisitos cumplidos). -1 si no existe ninguna.
    static int minimoCreditos(const Grafo& grafo, int cantidad,
                              const std::vector<std::string>& trayectorias = {});
    // Explica por que no hay combinaciones y propone las alternativas mas cercanas.
    // Si si hay combinaciones, devuelve bloqueado = false.
    static DiagnosticoBloqueo analizar(const Grafo& grafo, int cantidad, int maxCreditos,
                                       const std::vector<std::string>& trayectorias = {});
};
std::string causaATexto(CausaBloqueo causa);
std::string tipoAlternativaATexto(TipoAlternativa tipo);
#endif
