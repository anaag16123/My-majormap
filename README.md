# My MajorMap

Aplicación web, escrita en C++, que ayuda a estudiantes de EAFIT a decidir **qué materias cursar el próximo semestre**. Modela el pensum de cada carrera como un grafo, calcula qué materias están habilitadas según lo que ya se aprobó, y propone combinaciones de materias que cumplan las condiciones del estudiante (cantidad de materias, máximo de créditos, prerrequisitos y correquisitos). Si no existe ninguna combinación, explica por qué y sugiere alternativas.

Proyecto del curso **Análisis y Diseño de Algoritmos**, EAFIT 2026-2.

## Qué puede hacer

- Elegir una de las tres carreras con pensum real: Ingeniería de Sistemas, Ingeniería Matemática e Ingeniería Física.
- Ver el pensum por semestres, con color según el estado de cada materia (aprobada, habilitada, bloqueada).
- Marcar y desmarcar materias aprobadas. Las materias habilitadas se recalculan al instante.
- Elegir las dos trayectorias profesionalizantes de la carrera.
- Pedir propuestas de semestre: una cantidad exacta de materias, con un máximo de créditos (tope de 24 por semestre).
- Preferir una carga **suave** (menos dificultad primero) o **exigente** (más dificultad primero).
- Si no hay propuestas, ver la causa del bloqueo y alternativas (menos materias, más créditos, etc.).
- Recalcular las propuestas automáticamente al cambiar las materias aprobadas.

## Cómo funciona (resumen de los algoritmos)

| Parte | Técnica | Dónde |
|---|---|---|
| Pensum como grafo | Lista de adyacencia: cada materia es un nodo y cada prerrequisito una arista | `core/Grafo.cpp` |
| Materias habilitadas | **BFS** desde las materias sin prerrequisitos pendientes; se recalcula al aprobar o desaprobar | `core/Grafo.cpp` |
| Estados | `APROBADA`, `HABILITADA`, `BLOQUEADA` | `core/Grafo.cpp` |
| Correquisitos | Válidos si ya están aprobados o van en la misma propuesta | `core/Grafo.cpp` |
| Materias que se desbloquean | **DFS** iterativo con pila sobre las aristas de prerrequisito | `logic/Planificador.cpp` |
| Generar propuestas | **Backtracking** (elegir, explorar, deshacer) con poda por créditos y cantidad | `logic/Planificador.cpp` |
| Priorización suave / exigente | Ordenamiento estable por dificultad total de la propuesta | `logic/Planificador.cpp` |
| Sin solución | Búsqueda con cota (**branch and bound**) del mínimo de créditos posible y diagnóstico de la causa | `logic/AnalizadorBloqueo.cpp` |

**Límite de resultados.** Con pensums reales hay millones de combinaciones. Por eso el servidor devuelve como máximo **100 propuestas**, explorando primero las materias más fáciles (modo suave) o más difíciles (modo exigente). Si se recortó la lista, la respuesta trae `"limitado": true` y la página lo avisa.

## Estructura del proyecto

```
My-majormap/
├── core/               Modelo: Materia, Grafo, CargadorPensum
├── logic/              Algoritmos: Planificador (DFS, backtracking, orden), AnalizadorBloqueo
├── web/
│   ├── servidor.cpp    Arranque del servidor y registro de rutas
│   ├── Contexto.h      Estado compartido (carreras, trayectorias, candado)
│   ├── RutasPensum.*       API del pensum, aprobadas y trayectorias
│   ├── RutasPropuestas.*   API de propuestas y detalle de materia
│   ├── RutasSinSolucion.*  API de diagnóstico de bloqueo
│   ├── httplib.h       Librería cpp-httplib (un solo archivo)
│   └── public/         Interfaz (index.html, js/, css/, views/, components/)
├── data/               Pensums reales en CSV y trayectorias
└── tests/              Pruebas del planificador, del bloqueo y de los pensums reales
```

## Requisitos

- Compilador de C++ con soporte de C++17 (en Windows, MinGW g++).
- Un navegador moderno.

## Cómo compilar y ejecutar

Todo se ejecuta **desde la raíz del proyecto**, porque el servidor busca `web/public` y `data/` con rutas relativas.

### Windows (CMD)

```
g++ -std=c++17 -Wall -o web\servidor.exe web\servidor.cpp web\RutasPensum.cpp web\RutasPropuestas.cpp web\RutasSinSolucion.cpp logic\Planificador.cpp logic\AnalizadorBloqueo.cpp core\Grafo.cpp core\Materia.cpp core\CargadorPensum.cpp -lws2_32
web\servidor.exe
```

### Linux o macOS

```
g++ -std=c++17 -pthread -o servidor web/servidor.cpp web/RutasPensum.cpp web/RutasPropuestas.cpp web/RutasSinSolucion.cpp logic/Planificador.cpp logic/AnalizadorBloqueo.cpp core/Grafo.cpp core/Materia.cpp core/CargadorPensum.cpp
./servidor
```

Luego abre **http://localhost:8080**. Para cerrar el servidor usa Ctrl+C.

Notas:
- La compilación puede tardar varios minutos porque `httplib.h` es muy grande.
- No compiles con el servidor abierto: en Windows el enlazador falla con `ld returned 5`. Ciérralo antes con `taskkill /IM servidor.exe /F`.
- Si la página se ve desactualizada, recarga con Ctrl+F5.

## Pruebas

Desde la raíz del proyecto, en Windows (CMD):

```
g++ -std=c++17 -o pruebas.exe tests	est_planificador.cpp logic\Planificador.cpp core\Grafo.cpp core\Materia.cpp core\CargadorPensum.cpp
pruebas.exe

g++ -std=c++17 -o pruebas_bloqueo.exe tests	est_bloqueo.cpp logic\Planificador.cpp logic\AnalizadorBloqueo.cpp core\Grafo.cpp core\Materia.cpp core\CargadorPensum.cpp
pruebas_bloqueo.exe

g++ -std=c++17 -o pruebas_reales.exe tests	est_pensums_reales.cpp logic\Planificador.cpp core\Grafo.cpp core\Materia.cpp core\CargadorPensum.cpp
pruebas_reales.exe
```

En Linux o macOS cambia `\` por `/` y quita `.exe`. Cada una imprime "pasaron" si todo va bien:

- `tests/test_planificador.cpp`: DFS, backtracking, créditos, correquisitos y ordenamiento suave/exigente.
- `tests/test_bloqueo.cpp`: causas de bloqueo y alternativas.
- `tests/test_pensums_reales.cpp`: carga de los tres pensums reales y reglas especiales.

## Formato de los datos

Cada carrera es un CSV con separador `;` en `data/`:

```
codigo;nombre;semestre;creditos;dificultad;prerrequisitos;correquisitos;tipo
```

- `prerrequisitos` y `correquisitos` son listas de códigos de materia (vacío si no hay).
- `dificultad` es un número que usa la priorización suave/exigente.
- `tipo` indica el componente de la materia, por ejemplo `Trayectoria Profesionalizante: Blockchain`.

`data/trayectoria_enfasis.csv` lista, por programa, los grupos de trayectorias y de énfasis. `data/prueba.csv` es un pensum pequeño para pruebas.

Para agregar una carrera: crear su CSV en `data/` y registrarla en `web/servidor.cpp` con `agregarCarrera(ctx, id, nombre, archivo)`.

## API

Todas las respuestas son JSON. En error devuelven `{"error": "..."}` con el código HTTP correspondiente.

| Método | Ruta | Parámetros | Qué hace |
|---|---|---|---|
| GET | `/api/carreras` | | Lista las carreras |
| GET | `/api/pensum` | `carrera` | Materias de la carrera con su estado |
| POST | `/api/aprobada` | `carrera`, `codigo`, `aprobada=true\|false` | Marca o desmarca una materia y devuelve el pensum actualizado |
| GET | `/api/trayectorias` | `carrera` | Trayectorias disponibles |
| GET | `/api/materia` | `carrera`, `codigo` | Detalle de una materia |
| GET | `/api/propuestas` | `carrera`, `cantidad`, `creditos` (máx. 24), `exigente=true\|false`, `trayectorias=A,B` | Propuestas ordenadas (máx. 100) |
| GET | `/api/bloqueo` | `carrera`, `cantidad`, `creditos`, `trayectorias=A,B` | Diagnóstico y alternativas cuando no hay propuestas |

Las carreras tienen los ids `sistemas`, `matematica` y `fisica`. En carreras con trayectorias profesionalizantes, `/api/propuestas` exige elegir exactamente dos.

## Decisiones de diseño

- **Sin base de datos:** el estado vive en memoria y se pierde al cerrar el servidor. Las materias aprobadas se marcan de nuevo en cada sesión.
- **Un archivo de rutas por módulo:** cada uno expone `registrarRutasXxx(servidor, ctx)` y se registra con una línea en `web/servidor.cpp`.
- **Seguridad entre hilos:** el estado compartido se protege con un mutex. Las búsquedas pesadas trabajan sobre una copia del grafo para no bloquear las otras rutas.
- **Máximo de 24 créditos por semestre**, acordado por el equipo.

## Limitaciones conocidas

- Las propuestas están limitadas a las 100 mejores según la preferencia, no es el top exacto de todo el pensum.
- Los pensums y la dificultad de cada materia son los cargados en los CSV; no se consultan fuentes externas.
- El servidor escucha solo en `127.0.0.1:8080`, pensado para uso local.

## Equipo y responsabilidades

| Integrante | Módulo |
|---|---|
| Ana | Modelo del pensum (Materia, Grafo con BFS y estados, CargadorPensum), servidor web y vista del pensum con aprobadas |
| Isa | Generación de propuestas (DFS y backtracking), detalle de materia y base de la interfaz |
| Lau | Pensums reales, dificultad por materia, trayectorias y selector de carrera |
| Samu | Caso sin solución: explicación, alternativas y recalcular |
| Wen | Priorización suave/exigente, formulario y lista de propuestas |


