import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";

// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
const configCreacion = {
  // Parámetros del planeta a crear
  radio: 0.35,
  velocidad: 1.0,
  color: "#00ff88",
  focoElipse: 1.0,

  // Opción de satélite
  conSatelite: false,
  radioSatelite: 0.08,
  velSatelite: 3.0,
  colorSatelite: "#ffffff",

  // Acción manual desde panel
  borrarUltimo: () => eliminarUltimoPlaneta(),
};

let scene, renderer, camera;
let raycaster, plano;
let grid;
let estrella;

// Listas para la animación en bucle
let Planetas = [];
let Satelites = [];

let t0 = 0;
const accglobal = 0.001;

// ==========================================
// 2. INICIALIZACIÓN Y BUCLE PRINCIPAL
// ==========================================
init();
animate();

function init() {
  t0 = Date.now();

  crearCabeceraInfo();
  prepararEscenaYCamara();
  configurarEventosInteraccion();
  panelInteractivo();

  // Generación del sistema solar base
  dibujarPlanetasFijoSolar();
}

function animate() {
  requestAnimationFrame(animate);
  const ahora = Date.now();

  // Autorrotación del Sol
  if (estrella) {
    estrella.rotation.z += 0.005;
  }

  // Actualización orbital y autorrotación de planetas
  Planetas.forEach((planeta) => {
    if (planeta.userData && planeta.userData.tCreacion !== undefined) {
      const tiempoVida = (ahora - planeta.userData.tCreacion) * accglobal;
      const angulo = planeta.userData.anguloInicial + tiempoVida * planeta.userData.speed;

      planeta.position.x = Math.cos(angulo) * planeta.userData.dist * planeta.userData.f1;
      planeta.position.y = Math.sin(angulo) * planeta.userData.dist * planeta.userData.f2;

      planeta.rotation.z += 0.02; // Giro sobre su propio eje
    }
  });

  // Actualización orbital de satélites alrededor de su planeta padre
  const tiempoGlobal = (ahora - t0) * accglobal;
  Satelites.forEach((luna) => {
    luna.position.x = Math.cos(tiempoGlobal * luna.userData.speed) * luna.userData.dist;
    luna.position.y = Math.sin(tiempoGlobal * luna.userData.speed) * luna.userData.dist;
  });

  renderer.render(scene, camera);
}

// ==========================================
// 3. MÓDULOS DE CREACIÓN DE ASTROS Y ÓRBITAS
// ==========================================
function Estrella(rad, col) {
  const geometry = new THREE.SphereGeometry(rad, 20, 20);
  const material = new THREE.MeshBasicMaterial({ color: col });
  estrella = new THREE.Mesh(geometry, material);
  scene.add(estrella);
}

function Planeta(radio, dist, vel, col, f1, f2, anguloInicial = 0) {
  const geom = new THREE.SphereGeometry(radio, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: col, wireframe: true });
  const planeta = new THREE.Mesh(geom, mat);

  // Crear y asociar su línea de órbita
  const lineaOrbita = dibujarOrbitaPlaneta(dist, f1, f2);

  planeta.userData = {
    dist: dist,
    speed: vel,
    f1: f1,
    f2: f2,
    anguloInicial: anguloInicial,
    tCreacion: Date.now(),
    orbita: lineaOrbita, // Guardamos la referencia para poder borrarla
  };

  planeta.position.set(
    Math.cos(anguloInicial) * dist * f1,
    Math.sin(anguloInicial) * dist * f2,
    0
  );

  Planetas.push(planeta);
  scene.add(planeta);

  return planeta;
}

function Luna(padre, dist, radio, vel, col, inclinacion = 0) {
    // Pivote intermedio para inclinar el plano orbital de la luna
    const pivote = new THREE.Object3D();
    pivote.rotation.x = inclinacion; // Inclinación respecto al plano del planeta
    padre.add(pivote);

    const geometry = new THREE.SphereGeometry(radio, 10, 10);
    const material = new THREE.MeshBasicMaterial({ color: col, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.userData = { dist: dist, speed: vel };
    mesh.position.set(dist, 0, 0);

    pivote.add(mesh); // La luna cuelga del pivote inclinado
    Satelites.push(mesh);

    dibujarOrbitaLuna(pivote, dist); // La órbita también se dibuja dentro del pivote
    return mesh;
}

function dibujarOrbitaPlaneta(dist, f1, f2) {
  const curve = new THREE.EllipseCurve(0, 0, dist * f1, dist * f2);
  const points = curve.getPoints(64);
  const geome = new THREE.BufferGeometry().setFromPoints(points);
  const mate = new THREE.LineBasicMaterial({
    color: 0x555555,
    transparent: true,
    opacity: 0.5,
  });

  const orbita = new THREE.Line(geome, mate);
  scene.add(orbita);
  return orbita;
}

function dibujarOrbitaLuna(padre, dist) {
  const curve = new THREE.EllipseCurve(0, 0, dist, dist);
  const points = curve.getPoints(32);
  const geome = new THREE.BufferGeometry().setFromPoints(points);
  const mate = new THREE.LineBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.4,
  });

  const orbitaLuna = new THREE.Line(geome, mate);
  padre.add(orbitaLuna); // La órbita es hija del planeta
}

// ==========================================
// 4. GESTIÓN Y BORRADO (MODULAR)
// ==========================================
function eliminarUltimoPlaneta() {
  if (Planetas.length === 0) return;

  const planeta = Planetas.pop(); // 1. Quitar de la lista de animación

  // 2. Limpiar la línea de su órbita
  if (planeta.userData.orbita) {
    scene.remove(planeta.userData.orbita);
  }

  // 3. Quitar de la lista Satelites las lunas que pertenecían a este planeta
  Satelites = Satelites.filter((luna) => luna.parent !== planeta);

  // 4. Quitar el planeta de la escena 3D (al quitar el padre se ocultan sus hijos)
  scene.remove(planeta);
}

// ==========================================
// 5. CONFIGURACIÓN DEL SISTEMA SOLAR FIJO
// ==========================================
function dibujarPlanetasFijoSolar() {
  Estrella(2.0, 0xffff00);

  Planeta(0.15, 3.5, 4.0, 0x888888, 1.0, 1.1); // Mercurio
  Planeta(0.35, 4.8, 1.5, 0xe3bb76, 1.0, 1.0); // Venus

  const tierra = Planeta(0.4, 6.5, 1.0, 0x0000ff, 1.0, 1.0); // Tierra
  Luna(tierra, 0.8, 0.08, 3.0, 0xffffff); // Luna

  Planeta(0.25, 8.0, 0.5, 0xff0000, 1.0, 1.05); // Marte
  Planeta(1.2, 11.5, 0.2, 0xc88b3a, 1.0, 1.0);  // Júpiter
  Planeta(1.0, 15.0, 0.1, 0xead6b8, 1.0, 1.0);  // Saturno
  Planeta(0.7, 18.5, 0.05, 0x4b70dd, 1.0, 1.0); // Urano
  Planeta(0.68, 22.0, 0.03, 0x274687, 1.0, 1.0);// Neptuno
}

// ==========================================
// 6. ENTORNO, CÁMARA, GUI Y EVENTOS
// ==========================================
function prepararEscenaYCamara() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 15);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  new OrbitControls(camera, renderer.domElement);

  // Rejilla de referencia
  grid = new THREE.GridHelper(50, 50);
  grid.geometry.rotateX(Math.PI / 2);
  grid.position.set(0, 0, 0.05);
  scene.add(grid);

  // Raycaster y plano invisible para recibir clics
  raycaster = new THREE.Raycaster();
  const geometryp = new THREE.PlaneGeometry(80, 80);
  const materialp = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  plano = new THREE.Mesh(geometryp, materialp);
  plano.visible = false;
  scene.add(plano);

  // Botón DOM para la rejilla (Requisito S6)
  crearBotonRejilla();
}

function panelInteractivo() {
  const gui = new GUI({ title: "Configurar Astros" });

  const fPlaneta = gui.addFolder("Planeta");
  fPlaneta.add(configCreacion, "radio", 0.1, 1.2, 0.05).name("Radio");
  fPlaneta.add(configCreacion, "velocidad", 0.1, 3.0, 0.1).name("Velocidad");
  fPlaneta.add(configCreacion, "focoElipse", 0.8, 1.3, 0.05).name("Excentricidad");
  fPlaneta.addColor(configCreacion, "color").name("Color");

  const fSatelite = gui.addFolder("Satélite Opcional");
  fSatelite.add(configCreacion, "conSatelite").name("¿Llevará Luna?");
  fSatelite.add(configCreacion, "radioSatelite", 0.03, 0.15, 0.01).name("Radio Luna");
  fSatelite.add(configCreacion, "velSatelite", 0.5, 5.0, 0.5).name("Vel. Luna");
  fSatelite.addColor(configCreacion, "colorSatelite").name("Color Luna");

  gui.add(configCreacion, "borrarUltimo").name("🗑️ Borrar Último");
}

function configurarEventosInteraccion() {
  // Clic para crear planeta
  document.addEventListener("mousedown", onDocumentMouseDown);

  // Tecla 'B' o 'Delete' para borrado rápido
  window.addEventListener("keydown", (event) => {
    if (event.key === "b" || event.key === "B" || event.key === "Delete") {
      eliminarUltimoPlaneta();
    }
  });
}

function onDocumentMouseDown(event) {
  // Ignorar si pulsamos sobre lil-gui o un botón
  if (event.target.closest(".lil-gui") || event.target.tagName === "BUTTON") return;
  if (event.button !== 0) return; // Solo clic izquierdo

  const mouse = {
    x: (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
    y: -(event.clientY / renderer.domElement.clientHeight) * 2 + 1,
  };

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plano);

  if (intersects.length > 0) {
    const pt = intersects[0].point;
    const distancia = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    const anguloClic = Math.atan2(pt.y, pt.x);

    if (distancia < 2.5) return; // Evitar solapar con el Sol

    const colPlaneta = parseInt(configCreacion.color.replace("#", "0x"));

    // 1. Crear el planeta
    const nuevoPlaneta = Planeta(
      configCreacion.radio,
      distancia,
      configCreacion.velocidad,
      colPlaneta,
      1.0,
      configCreacion.focoElipse,
      anguloClic
    );

    // 2. Si se marcó el satélite, crearlo acoplado al planeta
    if (configCreacion.conSatelite) {
      const colLuna = parseInt(configCreacion.colorSatelite.replace("#", "0x"));
      const distLuna = configCreacion.radio + configCreacion.radioSatelite + 0.3;
      Luna(nuevoPlaneta, distLuna, configCreacion.radioSatelite, configCreacion.velSatelite, colLuna);
    }
  }
}

function crearBotonRejilla() {
  const btn = document.createElement("button");
  btn.innerHTML = "Rejilla on/off";
  btn.style.position = "absolute";
  btn.style.top = "10px";
  btn.style.left = "10px";
  btn.style.zIndex = "10";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    grid.visible = !grid.visible;
  });
}

function crearCabeceraInfo() {
  const infoDiv = document.createElement("div");
  infoDiv.style.position = "absolute";
  infoDiv.style.top = "30px";
  infoDiv.style.width = "100%";
  infoDiv.style.textAlign = "center";
  infoDiv.style.color = "#fff";
  infoDiv.style.fontWeight = "bold";
  infoDiv.style.backgroundColor = "transparent";
  infoDiv.style.zIndex = "1";
  infoDiv.style.fontFamily = "Monospace";
  infoDiv.innerHTML = "Naiara Díaz Hernández - Sistema Planetario S6";
  document.body.appendChild(infoDiv);
}