CXX = c++
CXXFLAGS = -std=c++17 -Wall -Wextra -pedantic -pthread
CORE = core/Materia.cpp core/Grafo.cpp core/CargadorPensum.cpp
LOGIC = logic/Planificador.cpp logic/AnalizadorBloqueo.cpp
WEB = web/servidor.cpp web/RutasPensum.cpp web/RutasPropuestas.cpp web/RutasSinSolucion.cpp

LDLIBS =
ifeq ($(OS),Windows_NT)
    LDLIBS += -lws2_32
endif

.PHONY: all run test clean
all: build/servidor
build:
	mkdir -p build 2>nul || mkdir build 2>/dev/null || true
build/servidor: $(CORE) $(LOGIC) $(WEB) $(wildcard core/*.h logic/*.h web/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) $(WEB) -o $@ $(LDLIBS)
run: build/servidor
	./build/servidor
build/pruebas: $(CORE) $(LOGIC) tests/test_planificador.cpp $(wildcard core/*.h logic/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) tests/test_planificador.cpp -o $@ $(LDLIBS)
build/pruebas_bloqueo: $(CORE) $(LOGIC) tests/test_bloqueo.cpp $(wildcard core/*.h logic/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) tests/test_bloqueo.cpp -o $@ $(LDLIBS)
build/test_pensums_reales: $(CORE) tests/test_pensums_reales.cpp $(wildcard core/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) tests/test_pensums_reales.cpp -o $@ $(LDLIBS)
test: build/pruebas build/pruebas_bloqueo build/test_pensums_reales
	./build/pruebas
	./build/pruebas_bloqueo
	./build/test_pensums_reales
clean:
	rm -f build/servidor build/pruebas build/pruebas_bloqueo build/test_pensums_reales build/*.exe
