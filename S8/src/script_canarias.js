import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";

let scene, renderer, camera, controls;
let estrellas, agujas, matTerreno, grupoConos, panelInfo;

// Datos de las imágenes, leídos una sola vez
let datosEscena = null; // { ancho, alto, escalaRelieve, pxLuz, pxRelieve }

// Luz artificial: 1 = encendida, 0 = cielo protegido (se interpola suavemente)
let luzNivel = 1;
let luzObjetivo = 1;

// Destino de la cámara para el viaje entre islas
let moviendo = false;
const destinoPos = new THREE.Vector3();
const destinoMira = new THREE.Vector3();

// Objetos sobre los que se puede hacer clic (conos y sus bases)
const objetosClicables = [];
const raycaster = new THREE.Raycaster();

// Parámetros y opciones editables desde el menú
const parametros = { umbral: 100, alturaMax: 0.9, paso: 3 };
const opciones = {
  isla: "Vista general",
  luzArtificial: true,
  conos: true,
  estrellas: true,
};

// Posición (x, y) de cada isla en el mapa (aproximada)
const islas = {
  "Vista general": null,
  "La Palma": [-3.87, 0.39],
  "El Hierro": [-4.08, -1.48],
  "La Gomera": [-2.55, -0.78],
  "Tenerife": [-1.12, -0.39],
  "Gran Canaria": [0.86, -1.12],
  "Fuerteventura": [3.82, -0.23],
  "Lanzarote": [4.75, 1.12],
};

// Calibración aproximada de la imagen: 200 píxeles por grado.
const lon0 = -18.63;
const lat0 = 29.46;
const pxPorGrado = 200;

// Estilo de cada tipo de punto del CSV
const estilos = {
  observatorio: { altura: 3.5, radio: 0.6, color: 0x66ccff },
  cumbre: { altura: 2.5, radio: 0.4, color: 0x66ffaa },
};

const nombreTipo = {
  observatorio: "Observatorio astronómico",
  cumbre: "Punto más alto de la isla",
};

init();
animate();

// ============================================================
// INICIALIZACIÓN: solo llamadas a funciones
// ============================================================
function init() {
  crearEscena();
  crearFondo();
  crearNiebla();
  crearCamara();
  crearRenderer();
  crearControles();
  crearMar();
  crearLuces();
  crearGrupoConos();
  cargarImagenes();
  crearEstrellas();
  crearMenu();
  crearTitulo();
  crearPanelInfo();
  configurarClics();
  configurarResize();
}

// ============================================================
// ESCENA, CÁMARA Y RENDERER
// ============================================================
function crearEscena() {
  scene = new THREE.Scene();
}

function crearFondo() {
  const fondo = new THREE.TextureLoader().load("src/2k_stars_milky_way.jpg");
  fondo.mapping = THREE.EquirectangularReflectionMapping;
  fondo.colorSpace = THREE.SRGBColorSpace;
  scene.background = fondo;
}

function crearNiebla() {
  // El color es el del mar
  scene.fog = new THREE.FogExp2(0x02060d, 0.03);
}

function crearCamara() {
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, -4.5, 3);
  camera.lookAt(0, 0, 0);
}

function crearRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
}

function crearControles() {
  controls = new OrbitControls(camera, renderer.domElement);
}

function configurarResize() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ============================================================
// ELEMENTOS DE LA ESCENA
// ============================================================
function crearMar() {
  // Mar provisional: plano oscuro grande
  const mar = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: 0x02060d })
  );
  mar.position.z = -0.02;
  scene.add(mar);
}

function crearLuces() {
  scene.add(new THREE.AmbientLight(0x8899bb, 0.15));
  const sol = new THREE.DirectionalLight(0xaaccff, 2.0);
  sol.position.set(-5, -2, 1.5);
  scene.add(sol);
}

function crearGrupoConos() {
  // Grupo para los conos de observatorios y cumbres
  grupoConos = new THREE.Group();
  scene.add(grupoConos);
}

// ------------------------------------------------------------
// Carga de imágenes y construcción de terreno, agujas y conos
// ------------------------------------------------------------
function cargarImagenes() {
  const loader = new THREE.TextureLoader();
  Promise.all([
    loader.loadAsync("src/relieve.png"),
    loader.loadAsync("src/luces.png"),
  ]).then(([relieve, luces]) => {
    luces.colorSpace = THREE.SRGBColorSpace;
    prepararDatos(relieve, luces);
    crearTerreno(relieve, luces);
    crearAgujas();
    cargarPuntosCielo();
  });
}

function prepararDatos(relieve, luces) {
  const aspecto = relieve.image.width / relieve.image.height;
  const alto = 4;

  datosEscena = {
    ancho: alto * aspecto,
    alto: alto,
    escalaRelieve: 0.5,
    pxLuz: leerPixeles(luces.image),
    pxRelieve: leerPixeles(relieve.image),
  };
}

function leerPixeles(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

// ------------------------------------------------------------
// Terreno de las islas
// ------------------------------------------------------------
function crearTerreno(relieve, luces) {
  const { ancho, alto, escalaRelieve } = datosEscena;
  const geom = new THREE.PlaneGeometry(ancho, alto, 500, 182);
  matTerreno = new THREE.MeshPhongMaterial({
    color: 0x1a2130,
    shininess: 0,
    displacementMap: relieve,
    displacementScale: escalaRelieve,
    emissive: 0xff9933,
    emissiveMap: luces,
    emissiveIntensity: 2.5,
  });
  scene.add(new THREE.Mesh(geom, matTerreno));
}

// ------------------------------------------------------------
// Agujas de luz
// ------------------------------------------------------------
function crearAgujas() {
  if (!datosEscena) return;
  const { ancho, alto, escalaRelieve, pxLuz, pxRelieve } = datosEscena;
  const w = pxLuz.width;
  const h = pxLuz.height;
  const { umbral, alturaMax, paso } = parametros;

  if (agujas) {
    scene.remove(agujas);
    agujas.geometry.dispose();
    agujas.material.dispose();
    agujas = null;
  }

  const geomAguja = new THREE.ConeGeometry(0.008, 1, 6);
  geomAguja.rotateX(Math.PI / 2);
  geomAguja.translate(0, 0, 0.5);

  const matAguja = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.55 * luzNivel,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  let total = 0;
  for (let j = 0; j < h; j += paso) {
    for (let i = 0; i < w; i += paso) {
      if (pxLuz.data[(j * w + i) * 4] > umbral) total++;
    }
  }

  agujas = new THREE.InstancedMesh(geomAguja, matAguja, total);
  const dummy = new THREE.Object3D();
  const naranja = new THREE.Color(0xff8800);
  const cian = new THREE.Color(0x66ffff);
  const color = new THREE.Color();

  let n = 0;
  for (let j = 0; j < h; j += paso) {
    for (let i = 0; i < w; i += paso) {
      const idx = (j * w + i) * 4;
      const brillo = pxLuz.data[idx];
      if (brillo <= umbral) continue;

      const t = (brillo - umbral) / (255 - umbral);

      const x = (i / w - 0.5) * ancho;
      const y = (0.5 - j / h) * alto;
      const z = (pxRelieve.data[idx] / 255) * escalaRelieve;

      dummy.position.set(x, y, z);
      dummy.scale.set(1, 1, 0.05 + t * alturaMax);
      dummy.updateMatrix();
      agujas.setMatrixAt(n, dummy.matrix);

      color.copy(naranja).lerp(cian, t * t * t);
      agujas.setColorAt(n, color);
      n++;
    }
  }

  agujas.instanceMatrix.needsUpdate = true;
  if (agujas.instanceColor) agujas.instanceColor.needsUpdate = true;
  agujas.visible = luzNivel > 0.01;
  scene.add(agujas);
}

// ------------------------------------------------------------
// Bóveda de estrellas (partículas)
// ------------------------------------------------------------
function crearEstrellas() {
  const total = 4000;
  const posiciones = new Float32Array(total * 3);
  const colores = new Float32Array(total * 3);
  const color = new THREE.Color();

  for (let i = 0; i < total; i++) {
    const theta = Math.random() * Math.PI * 2;
    const z = THREE.MathUtils.randFloat(0.05, 1);
    const r = Math.sqrt(1 - z * z);
    const radio = THREE.MathUtils.randFloat(60, 150);

    posiciones[i * 3] = Math.cos(theta) * r * radio;
    posiciones[i * 3 + 1] = Math.sin(theta) * r * radio;
    posiciones[i * 3 + 2] = z * radio;

    const t = Math.random();
    if (t < 0.6) color.set(0xffffff);
    else if (t < 0.85) color.set(0xaaccff);
    else color.set(0xffddaa);
    colores[i * 3] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colores, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.5,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    fog: false,
  });

  estrellas = new THREE.Points(geom, mat);
  scene.add(estrellas);
}

// ============================================================
// CSV DE PUNTOS (OBSERVATORIOS Y CUMBRES)
// ============================================================
async function cargarPuntosCielo() {
  const respuesta = await fetch("src/cielo.csv");
  if (!respuesta.ok) {
    console.error("No se pudo cargar src/cielo.csv:", respuesta.statusText);
    return;
  }
  const texto = (await respuesta.text()).replace(/^\uFEFF/, "");
  crearConos(parsearCSV(texto));
}

function parsearCSV(texto) {
  const filas = texto
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const cab = filas[0].split(";");
  const idx = {
    nombre: cab.indexOf("nombre"),
    tipo: cab.indexOf("tipo"),
    lat: cab.indexOf("latitud"),
    lon: cab.indexOf("longitud"),
    alt: cab.indexOf("altitud_m"),
  };

  const puntos = [];
  for (let i = 1; i < filas.length; i++) {
    const c = filas[i].split(";");
    puntos.push({
      nombre: c[idx.nombre],
      tipo: c[idx.tipo],
      lat: parseFloat(c[idx.lat]),
      lon: parseFloat(c[idx.lon]),
      alt: parseFloat(c[idx.alt]),
    });
  }
  return puntos;
}

// ------------------------------------------------------------
// Geometría cónica invertida con degradado
// ------------------------------------------------------------
function crearGeomCono(altura, radio, colorHex) {
  const geom = new THREE.ConeGeometry(radio, altura, 48, 1, true);
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, 0, altura / 2);

  const pos = geom.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(colorHex);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getZ(i) / altura;
    const k = Math.pow(1 - t, 0.7);
    col[i * 3] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geom;
}

// ------------------------------------------------------------
// Conos astronómicos
// ------------------------------------------------------------
function crearConos(puntos) {
  const { ancho, alto, escalaRelieve, pxRelieve } = datosEscena;
  const w = pxRelieve.width;
  const h = pxRelieve.height;
  const ventana = 3;

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  const matHitbox = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  puntos.forEach((p) => {
    const estilo = estilos[p.tipo];
    if (!estilo) return;

    const px = Math.round((p.lon - lon0) * pxPorGrado);
    const py = Math.round((lat0 - p.lat) * pxPorGrado);

    let mejor = -1;
    let bi = px;
    let bj = py;
    const j0 = Math.max(0, py - ventana);
    const j1 = Math.min(h - 1, py + ventana);
    const i0 = Math.max(0, px - ventana);
    const i1 = Math.min(w - 1, px + ventana);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const v = pxRelieve.data[(j * w + i) * 4];
        if (v > mejor) {
          mejor = v;
          bi = i;
          bj = j;
        }
      }
    }

    const x = (bi / w - 0.5) * ancho;
    const y = (0.5 - bj / h) * alto;
    const z = (mejor / 255) * escalaRelieve;

    const cono = new THREE.Mesh(
      crearGeomCono(estilo.altura, estilo.radio, estilo.color),
      mat
    );
    cono.position.set(x, y, z);
    cono.userData.punto = p;
    grupoConos.add(cono);
    objetosClicables.push(cono);

    const punto = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 16),
      new THREE.MeshBasicMaterial({ color: estilo.color, fog: false })
    );
    punto.position.set(x, y, z);
    grupoConos.add(punto);

    const hitbox = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), matHitbox);
    hitbox.position.set(x, y, z);
    hitbox.userData.punto = p;
    grupoConos.add(hitbox);
    objetosClicables.push(hitbox);
  });
}

// ============================================================
// INTERFAZ: MENÚ, TÍTULO, LEYENDA Y PANEL DE INFORMACIÓN
// ============================================================
function crearMenu() {
  const gui = new GUI({ title: "Canarias de noche" });

  gui
    .add(opciones, "isla", Object.keys(islas))
    .name("Ir a")
    .onChange((nombre) => irAIsla(nombre));

  gui
    .add(opciones, "luzArtificial")
    .name("Luz artificial")
    .onChange((v) => {
      luzObjetivo = v ? 1 : 0;
    });

  gui.add(scene.fog, "density", 0, 0.15, 0.005).name("Niebla");

  const fCapas = gui.addFolder("Capas");
  fCapas
    .add(opciones, "conos")
    .name("Conos")
    .onChange((v) => {
      grupoConos.visible = v;
      if (!v) ocultarInfo();
    });
  fCapas
    .add(opciones, "estrellas")
    .name("Estrellas")
    .onChange((v) => {
      if (estrellas) estrellas.visible = v;
    });
}

function irAIsla(nombre) {
  const p = islas[nombre];
  if (p === null) {
    destinoMira.set(0, 0, 0);
    destinoPos.set(0, -4.5, 3);
  } else {
    destinoMira.set(p[0], p[1], 0.2);
    destinoPos.set(p[0], p[1] - 1.6, 1.0);
  }
  moviendo = true;
}

function crearTitulo() {
  const titulo = document.createElement("div");
  titulo.style.position = "absolute";
  titulo.style.top = "20px";
  titulo.style.left = "24px";
  titulo.style.color = "#fff";
  titulo.style.fontFamily = "Helvetica, Arial, sans-serif";
  titulo.style.pointerEvents = "none";
  titulo.style.textShadow = "0 0 12px rgba(0,0,0,0.9)";
  titulo.innerHTML = `
    <div style="font-size:28px; font-weight:700; letter-spacing:2px;">CANARIAS DE NOCHE</div>
    <div style="font-size:14px; opacity:0.8; margin-top:4px;">
      Contaminación lumínica y Cielo Starlight
    </div>
    <div style="font-size:12px; opacity:0.6; margin-top:6px;">
      Naiara Díaz Hernández · Informática Gráfica
    </div>`;
  document.body.appendChild(titulo);

  const leyenda = document.createElement("div");
  leyenda.style.position = "absolute";
  leyenda.style.bottom = "20px";
  leyenda.style.left = "24px";
  leyenda.style.maxWidth = "440px";
  leyenda.style.color = "#fff";
  leyenda.style.fontFamily = "Helvetica, Arial, sans-serif";
  leyenda.style.fontSize = "12px";
  leyenda.style.lineHeight = "1.5";
  leyenda.style.opacity = "0.8";
  leyenda.style.pointerEvents = "none";
  leyenda.style.textShadow = "0 0 8px rgba(0,0,0,0.9)";
  leyenda.innerHTML = `
    Cada aguja es un punto de luz artificial: cuanto más alta, más intensa.<br>
    Conos azules: observatorios astronómicos. Conos verdes: puntos más altos insulares.<br>
    Relieve proporcional a la altitud real, con exageración vertical ×6.<br>
    Haz clic en un cono para ver sus datos. Apaga la "Luz artificial" en el menú para ver el cielo protegido.<br>
    <span style="opacity:0.6">Datos: NASA Worldview / VIIRS (luz nocturna, 2021), Tangram Heightmapper (relieve SRTM/ASTER), Solar System Scope (fondo), coordenadas de observatorios de Wikipedia.</span>`;
  document.body.appendChild(leyenda);
}

function crearPanelInfo() {
  panelInfo = document.createElement("div");
  panelInfo.style.position = "absolute";
  panelInfo.style.bottom = "20px";
  panelInfo.style.right = "24px";
  panelInfo.style.minWidth = "220px";
  panelInfo.style.padding = "12px 16px";
  panelInfo.style.background = "rgba(5, 12, 24, 0.85)";
  panelInfo.style.border = "1px solid rgba(120, 200, 255, 0.4)";
  panelInfo.style.borderRadius = "6px";
  panelInfo.style.color = "#fff";
  panelInfo.style.fontFamily = "Helvetica, Arial, sans-serif";
  panelInfo.style.fontSize = "13px";
  panelInfo.style.lineHeight = "1.5";
  panelInfo.style.pointerEvents = "none";
  panelInfo.style.display = "none";
  document.body.appendChild(panelInfo);
}

function mostrarInfo(p) {
  panelInfo.innerHTML = `
    <div style="font-size:15px; font-weight:700; margin-bottom:4px;">${p.nombre}</div>
    <div style="opacity:0.8;">${nombreTipo[p.tipo] || p.tipo}</div>
    <div>Altitud: ${p.alt} m</div>
    <div>Lat ${p.lat.toFixed(4)}°, Lon ${p.lon.toFixed(4)}°</div>`;
  panelInfo.style.display = "block";
}

function ocultarInfo() {
  panelInfo.style.display = "none";
}

// ------------------------------------------------------------
// Detección de clics sobre conos
// ------------------------------------------------------------
function configurarClics() {
  let inicio = null;

  renderer.domElement.addEventListener("pointerdown", (e) => {
    inicio = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!inicio) return;
    const movido = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    inicio = null;
    if (movido < 4) alHacerClic(e);
  });
}

function alHacerClic(e) {
  if (!grupoConos.visible) {
    ocultarInfo();
    return;
  }
  const r = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const impactos = raycaster.intersectObjects(objetosClicables, false);

  if (impactos.length > 0) {
    mostrarInfo(impactos[0].object.userData.punto);
  } else {
    ocultarInfo();
  }
}

// ============================================================
// BUCLE DE ANIMACIÓN
// ============================================================
function animate() {
  requestAnimationFrame(animate);

  actualizarLuzArtificial();
  actualizarEstrellas();
  actualizarCamara();

  controls.update();
  renderer.render(scene, camera);
}

// Transición suave entre luz artificial encendida y cielo protegido
function actualizarLuzArtificial() {
  luzNivel += (luzObjetivo - luzNivel) * 0.05;
  if (Math.abs(luzObjetivo - luzNivel) < 0.001) luzNivel = luzObjetivo;

  if (matTerreno) matTerreno.emissiveIntensity = 2.5 * luzNivel;
  if (agujas) {
    agujas.material.opacity = 0.55 * luzNivel;
    agujas.visible = luzNivel > 0.01;
  }
}

// Las estrellas crecen al apagar la luz y giran muy despacio alrededor de z
function actualizarEstrellas() {
  if (!estrellas) return;
  estrellas.material.size = 0.5 + (1 - luzNivel) * 0.6;
  estrellas.rotation.z += 0.0003;
}

// Viaje suave de la cámara hacia la isla elegida
function actualizarCamara() {
  if (!moviendo) return;
  camera.position.lerp(destinoPos, 0.05);
  controls.target.lerp(destinoMira, 0.05);
  if (camera.position.distanceTo(destinoPos) < 0.01) moviendo = false;
}