CXX = c++
CXXFLAGS = -std=c++17 -Wall -Wextra -pedantic -pthread
CORE = core/Materia.cpp core/Grafo.cpp core/CargadorPensum.cpp
LOGIC = logic/Planificador.cpp logic/AnalizadorBloqueo.cpp
WEB = web/servidor.cpp web/RutasPensum.cpp web/RutasPropuestas.cpp web/RutasSinSolucion.cpp

.PHONY: all run test clean
all: build/servidor
build:
	mkdir -p build
build/servidor: $(CORE) $(LOGIC) $(WEB) $(wildcard core/*.h logic/*.h web/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) $(WEB) -o $@
run: build/servidor
	./build/servidor
build/pruebas: $(CORE) $(LOGIC) tests/test_planificador.cpp $(wildcard core/*.h logic/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) tests/test_planificador.cpp -o $@
build/pruebas_bloqueo: $(CORE) $(LOGIC) tests/test_bloqueo.cpp $(wildcard core/*.h logic/*.h) | build
	$(CXX) $(CXXFLAGS) $(CORE) $(LOGIC) tests/test_bloqueo.cpp -o $@
test: build/pruebas build/pruebas_bloqueo
	./build/pruebas
	./build/pruebas_bloqueo
clean:
	rm -f build/servidor build/pruebas build/pruebas_bloqueo
