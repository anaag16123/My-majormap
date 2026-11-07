#include "AnalizadorBloqueo.h"
#include <algorithm>
#include <functional>
#include <stdexcept>
int AnalizadorBloqueo::minimoCreditos(const Grafo& grafo, int cantidad) {
    if (cantidad <= 0) throw std::invalid_argument("La cantidad debe ser un entero positivo");
    std::vector<Materia> candidatas = grafo.getHabilitadas();
    const std::size_t n = candidatas.size();
    if (static_cast<std::size_t>(cantidad) > n) return -1;
    // Ordenar de menor a mayor credito permite acotar: las siguientes "faltan"
    // materias del vector son las mas baratas que quedan por elegir.
    std::stable_sort(candidatas.begin(), candidatas.end(), [](const Materia& a, const Materia& b) {
        return a.getCreditos() < b.getCreditos();
    });
    std::vector<int> acumulado(n + 1, 0);  // acumulado[i] = creditos de candidatas[0..i-1]
    for (std::size_t i = 0; i < n; ++i) acumulado[i + 1] = acumulado[i] + candidatas[i].getCreditos();
    int mejor = -1;
    std::vector<Materia> parcial;
    std::function<void(std::size_t, int)> buscar = [&](std::size_t inicio, int creditos) {
        const std::size_t faltan = static_cast<std::size_t>(cantidad) - parcial.size();
        if (faltan == 0) {
            // Los correquisitos se revisan al final: pueden entrar mas adelante.
            for (const Materia& m : parcial) {
                if (!grafo.correquisitosCumplidos(m.getCodigo(), parcial)) return;
            }
            if (mejor == -1 || creditos < mejor) mejor = creditos;
            return;
        }
        for (std::size_t i = inicio; i + faltan <= n; ++i) {
            // Cota: lo mas barato posible desde i ya no mejora la mejor solucion.
            int cota = creditos + acumulado[i + faltan] - acumulado[i];
            if (mejor != -1 && cota >= mejor) return;
            parcial.push_back(candidatas[i]);      // Elegir.
            buscar(i + 1, creditos + candidatas[i].getCreditos());  // Explorar.
            parcial.pop_back();                    // Deshacer.
        }
    };
    buscar(0, 0);
    return mejor;
}
namespace {
std::string plural(int numero, const std::string& singular, const std::string& varios) {
    return std::to_string(numero) + " " + (numero == 1 ? singular : varios);
}
// Materias habilitadas que solo pueden cursarse junto con un correquisito no aprobado.
std::string describirCorrequisitos(const Grafo& grafo) {
    std::string texto;
    for (const Materia& m : grafo.getHabilitadas()) {
        std::vector<std::string> pendientes;
        for (const std::string& co : m.getCorrequisitos()) {
            if (!grafo.estaAprobada(co)) pendientes.push_back(co);
        }
        if (pendientes.empty()) continue;
        texto += texto.empty() ? " " : "; ";
        texto += m.getCodigo() + " debe cursarse junto con ";
        for (std::size_t i = 0; i < pendientes.size(); ++i) {
            if (i) texto += ", ";
            texto += pendientes[i];
        }
    }
    return texto.empty() ? texto : texto + ".";
}
}
DiagnosticoBloqueo AnalizadorBloqueo::analizar(const Grafo& grafo, int cantidad, int maxCreditos) {
    if (cantidad <= 0 || maxCreditos <= 0) {
        throw std::invalid_argument("Cantidad y creditos deben ser enteros positivos");
    }
    DiagnosticoBloqueo diagnostico;
    diagnostico.habilitadas = grafo.getHabilitadas();
    const int disponibles = static_cast<int>(diagnostico.habilitadas.size());
    const int minimo = minimoCreditos(grafo, cantidad);
    if (minimo != -1 && minimo <= maxCreditos) return diagnostico;  // Hay solucion.
    diagnostico.bloqueado = true;
    // 1. Causa del bloqueo, de la mas basica a la mas especifica.
    if (disponibles == 0) {
        diagnostico.causa = CausaBloqueo::SIN_HABILITADAS;
        diagnostico.explicacion = "No tienes materias habilitadas: todas están aprobadas o les falta "
            "algún prerrequisito. Revisa tus materias aprobadas en el pensum.";
        return diagnostico;  // Sin habilitadas no hay alternativas posibles.
    }
    if (disponibles < cantidad) {
        diagnostico.causa = CausaBloqueo::POCAS_HABILITADAS;
        diagnostico.explicacion = "Pediste " + plural(cantidad, "materia", "materias") +
            ", pero solo tienes " + plural(disponibles, "materia habilitada", "materias habilitadas") + ".";
    } else if (minimo == -1) {
        diagnostico.causa = CausaBloqueo::CORREQUISITOS;
        diagnostico.explicacion = "No se puede armar una propuesta de exactamente " +
            plural(cantidad, "materia", "materias") + " porque algunos correquisitos obligan a tomar "
            "materias juntas." + describirCorrequisitos(grafo);
    } else {
        diagnostico.causa = CausaBloqueo::CREDITOS_INSUFICIENTES;
        diagnostico.explicacion = "La combinación más liviana de " + plural(cantidad, "materia", "materias") +
            " suma " + plural(minimo, "crédito", "créditos") + " y tu máximo es " +
            plural(maxCreditos, "crédito", "créditos") + ".";
        if (minimo > TOPE_CREDITOS) {
            diagnostico.explicacion += " Eso supera el tope de " + std::to_string(TOPE_CREDITOS) +
                " créditos por semestre.";
        }
    }
    // 2. Alternativa: la mayor cantidad de materias que cabe en el mismo maximo de creditos.
    for (int k = std::min(cantidad - 1, disponibles); k >= 1; --k) {
        int creditos = minimoCreditos(grafo, k);
        if (creditos != -1 && creditos <= maxCreditos) {
            diagnostico.alternativas.push_back({TipoAlternativa::MENOS_MATERIAS, k, maxCreditos,
                "Tomar " + plural(k, "materia", "materias") + " con máximo " +
                plural(maxCreditos, "crédito", "créditos") + "."});
            break;
        }
    }
    // 3. Alternativa: el minimo de creditos para la cantidad pedida, sin pasar el tope.
    if (diagnostico.causa == CausaBloqueo::CREDITOS_INSUFICIENTES && minimo <= TOPE_CREDITOS) {
        diagnostico.alternativas.push_back({TipoAlternativa::MAS_CREDITOS, cantidad, minimo,
            "Subir el máximo a " + plural(minimo, "crédito", "créditos") + " para tomar " +
            plural(cantidad, "materia", "materias") + "."});
    }
    // 4. Si nada de lo anterior sirve y el bloqueo es por correquisitos,
    //    la opcion mas cercana es tomar mas materias para incluirlos juntos.
    if (diagnostico.alternativas.empty() && diagnostico.causa == CausaBloqueo::CORREQUISITOS) {
        const int limite = std::max(maxCreditos, TOPE_CREDITOS);
        for (int k = cantidad + 1; k <= disponibles; ++k) {
            int creditos = minimoCreditos(grafo, k);
            if (creditos == -1 || creditos > limite) continue;
            int maximo = std::max(maxCreditos, creditos);
            diagnostico.alternativas.push_back({TipoAlternativa::MAS_MATERIAS, k, maximo,
                "Tomar " + plural(k, "materia", "materias") + " con máximo " +
                plural(maximo, "crédito", "créditos") + " para incluir los correquisitos juntos."});
            break;
        }
    }
    return diagnostico;
}
std::string causaATexto(CausaBloqueo causa) {
    switch (causa) {
        case CausaBloqueo::SIN_HABILITADAS:        return "SIN_HABILITADAS";
        case CausaBloqueo::POCAS_HABILITADAS:      return "POCAS_HABILITADAS";
        case CausaBloqueo::CORREQUISITOS:          return "CORREQUISITOS";
        case CausaBloqueo::CREDITOS_INSUFICIENTES: return "CREDITOS_INSUFICIENTES";
        default:                                   return "NINGUNA";
    }
}
std::string tipoAlternativaATexto(TipoAlternativa tipo) {
    switch (tipo) {
        case TipoAlternativa::MENOS_MATERIAS: return "MENOS_MATERIAS";
        case TipoAlternativa::MAS_CREDITOS:   return "MAS_CREDITOS";
        default:                              return "MAS_MATERIAS";
    }
}
