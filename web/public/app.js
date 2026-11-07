const selCarrera = document.getElementById("carrera");
const contPensum = document.getElementById("pensum");
const mensaje = document.getElementById("mensaje");

const CLASE = { APROBADA: "aprobada", HABILITADA: "habilitada", BLOQUEADA: "bloqueada" };

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error || "Error del servidor");
  return datos;
}

function dibujar(pensum) {
  const porSemestre = {};
  for (const m of pensum.materias) (porSemestre[m.semestre] = porSemestre[m.semestre] || []).push(m);

  contPensum.innerHTML = "";
  Object.keys(porSemestre).sort((a, b) => a - b).forEach(sem => {
    const col = document.createElement("section");
    col.className = "semestre";
    const titulo = document.createElement("h2");
    titulo.textContent = "Semestre " + sem;
    col.appendChild(titulo);

    for (const m of porSemestre[sem]) {
      const div = document.createElement("div");
      div.className = "materia " + CLASE[m.estado];
      const req = m.prerrequisitos.length ? "Req: " + m.prerrequisitos.join(", ") : "Sin prerrequisitos";
      const co = m.correquisitos.length ? " | Co: " + m.correquisitos.join(", ") : "";
      for (const [cls, texto] of [
        ["cod", m.codigo],
        ["nom", m.nombre],
        ["det", m.creditos + " cr | Dif " + m.dificultad + " | " + req + co],
      ]) {
        const el = document.createElement("div");
        el.className = cls;
        el.textContent = texto;
        div.appendChild(el);
      }
      div.title = m.estado === "BLOQUEADA" ? "Bloqueada: faltan requisitos" : "Clic para marcar/desmarcar";
      div.addEventListener("click", () => alternar(pensum.carrera, m));
      col.appendChild(div);
    }
    contPensum.appendChild(col);
  });
}

async function alternar(carrera, materia) {
  mensaje.textContent = "";
  // Una materia bloqueada no se puede aprobar: le faltan requisitos.
  if (materia.estado === "BLOQUEADA") {
    mensaje.textContent = materia.codigo + " esta bloqueada: aprueba primero sus requisitos.";
    return;
  }
  const aprobar = materia.estado !== "APROBADA";
  try {
    const url = "/api/aprobada?carrera=" + encodeURIComponent(carrera) +
                "&codigo=" + encodeURIComponent(materia.codigo) +
                "&aprobada=" + aprobar;
    dibujar(await pedir(url, { method: "POST" }));
  } catch (e) { mensaje.textContent = e.message; }
}

async function cargarPensum() {
  mensaje.textContent = "";
  try {
    dibujar(await pedir("/api/pensum?carrera=" + encodeURIComponent(selCarrera.value)));
  } catch (e) { mensaje.textContent = e.message; }
}

async function iniciar() {
  try {
    const carreras = await pedir("/api/carreras");
    for (const c of carreras) selCarrera.add(new Option(c.nombre, c.id));
    selCarrera.addEventListener("change", cargarPensum);
    await cargarPensum();
  } catch (e) { mensaje.textContent = e.message; }
}
iniciar();
