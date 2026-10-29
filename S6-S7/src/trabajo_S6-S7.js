import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";
import { FlyControls } from "three/examples/jsm/controls/FlyControls";

// ==========================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// ==========================================
const configCreacion = {
  conPlaneta: true,
  radio: 0.35,
  velocidad: 1.0,
  color: "#00ff88",
  focoElipse: 1.0,

  // Extras proporcionales al radio del planeta
  conNubes: false,
  conAnillos: false,

  // Opción de satélite
  conSatelite: false,
  radioSatelite: 0.08,
  velSatelite: 3.0,
  colorSatelite: "#ffffff",

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

let camaraGeneral, camaraNave;
let controlesOrbitales, controlesNave;
let reloj = new THREE.Clock();
let modoVista = "general";
let velocidadSimulacion = 0.001;

let mallaAsteroides;
const totalAsteroides = 1000;
const datosAsteroides = [];

let astroEnfocado = null;
let distanciaSeguimiento = 2.0;


let luzSol, luzAmbiente;
const textureLoader = new THREE.TextureLoader();
const texTierra = textureLoader.load("src/earthmap1k.jpg");
const texTierraBump = textureLoader.load("src/earthbump1k.jpg");
const texTierraSpec = textureLoader.load("src/earthspec1k.jpg");
const texNubes = textureLoader.load("src/earthcloudmap.jpg");
const texNubesAlpha = textureLoader.load("src/earthcloudmaptrans_invert.jpg");
const texMercurio = textureLoader.load("src/2k_mercury.jpg");
const texVenusSup = textureLoader.load("src/2k_venus_surface.jpg");
const texVenusAtm = textureLoader.load("src/2k_venus_atmosphere.jpg");
const texMarte    = textureLoader.load("src/2k_mars.jpg");
const texJupiter  = textureLoader.load("src/2k_jupiter.jpg");
const texSaturno  = textureLoader.load("src/2k_saturn.jpg");
const texAnillo   = textureLoader.load("src/2k_saturn_ring_alpha.png");
const texUrano    = textureLoader.load("src/2k_uranus.jpg");
const texNeptuno  = textureLoader.load("src/2k_neptune.jpg");

const texFondoEspacio = textureLoader.load("src/2k_stars_milky_way.jpg");

// Sol y Luna
const texSol  = textureLoader.load("src/2k_sun.jpg");
const texLuna = textureLoader.load("src/2k_moon.jpg");
// ==========================================
// 2. INICIALIZACIÓN Y BUCLE PRINCIPAL
// ==========================================
init();
animate();

function init() {
  t0 = Date.now();

  crearCabeceraInfo();
  prepararEscenaYCamara();
  prepararLuces();
  configurarEventosInteraccion();
  panelInteractivo();
  crearCinturonAsteroides(9.0, 10.5);

  // Generación del sistema solar base
  dibujarPlanetasFijoSolar();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = reloj.getDelta();
  const ahora = Date.now();

  // Autorrotación del Sol
  if (estrella) {
    estrella.rotation.z += 0.005;
  }

  // Animación orbital de los planetas
  Planetas.forEach((planeta) => {
    if (planeta.userData && planeta.userData.tCreacion !== undefined) {
      const tiempoVida = (ahora - planeta.userData.tCreacion) * velocidadSimulacion;
      const angulo = planeta.userData.anguloInicial + tiempoVida * planeta.userData.speed;

      planeta.position.x = Math.cos(angulo) * planeta.userData.dist * planeta.userData.f1;
      planeta.position.y = Math.sin(angulo) * planeta.userData.dist * planeta.userData.f2;

      planeta.rotation.z += planeta.userData.velRotacionPropia || 0.02;
    }
  });

  // Animación orbital de las lunas
  const tiempoGlobal = (ahora - t0) * velocidadSimulacion;
  Satelites.forEach((luna) => {
    luna.position.x = Math.cos(tiempoGlobal * luna.userData.speed) * luna.userData.dist;
    luna.position.y = Math.sin(tiempoGlobal * luna.userData.speed) * luna.userData.dist;
  });

  // Animación del cinturón de asteroides
  if (mallaAsteroides) {
    const dummy = new THREE.Object3D();
    const t = ahora * 0.0005;

    for (let i = 0; i < totalAsteroides; i++) {
      const a = datosAsteroides[i];
      const ang = a.angulo + t * a.velocidad;
      dummy.position.set(Math.cos(ang) * a.radio, Math.sin(ang) * a.radio, a.dispersionZ);
      dummy.scale.set(a.escala, a.escala, a.escala);
      dummy.updateMatrix();
      mallaAsteroides.setMatrixAt(i, dummy.matrix);
    }
    mallaAsteroides.instanceMatrix.needsUpdate = true;
  }

  // --- RENDERIZADO Y CONTROL DE CÁMARAS ---
  if (modoVista === "general") {
    if (astroEnfocado) {
      controlesOrbitales.target.copy(astroEnfocado.position);
    }
    controlesOrbitales.update();
    renderer.render(scene, camaraGeneral);
  } else {
    controlesNave.update(delta);
    renderer.render(scene, camaraNave);
  }
}

// ==========================================
// 3. MÓDULOS DE CREACIÓN DE ASTROS Y ÓRBITAS
// ==========================================
function Estrella(rad, col, textura = null) {
  const geometry = new THREE.SphereGeometry(rad, 32, 32);
  const material = new THREE.MeshBasicMaterial({
    color: textura ? 0xffffff : col,
    map: textura || null,
  });
  estrella = new THREE.Mesh(geometry, material);
  scene.add(estrella);

  // Mantenemos la luz puntual en su interior si no la tienes en prepararLuces
  if (!luzSol) {
    luzSol = new THREE.PointLight(0xffffff, 2.5, 0, 0.5);
    luzSol.castShadow = true;
    luzSol.shadow.mapSize.width = 1024;
    luzSol.shadow.mapSize.height = 1024;
    scene.add(luzSol);
  }
}

function Planeta(radio, dist, vel, col, f1, f2, anguloInicial = 0, opciones = {}) {
  const geom = new THREE.SphereGeometry(radio, 16, 16);
  const mat = new THREE.MeshPhongMaterial({ 
    color: opciones.map ? 0xffffff : col,
    shininess: 15 
  });

  // Aplicar los mapas si existen
  if (opciones.map) mat.map = opciones.map;

  // Si tiene mapa de relieve (cordilleras/cráteres)
  if (opciones.bumpMap) {
    mat.bumpMap = opciones.bumpMap;
    mat.bumpScale = opciones.bumpScale || 0.05;
  }

  // Si tiene mapa especular (reflejo en océanos)
  if (opciones.specularMap) {
    mat.specularMap = opciones.specularMap;
    mat.specular = new THREE.Color(0x333333);
  }

  const planeta = new THREE.Mesh(geom, mat);

  //Activar sombras
  planeta.castShadow = true;
  planeta.receiveShadow = true;

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
    velRotacionPropia: 0.01 + Math.random() * 0.02,
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

function Luna(padre, dist, radio, vel, col, inclinacion = 0, textura = null) {
  const pivote = new THREE.Object3D();
  pivote.rotation.x = inclinacion;
  padre.add(pivote);

  const geometry = new THREE.SphereGeometry(radio, 32, 32);
  const material = new THREE.MeshPhongMaterial({
    color: textura ? 0xffffff : col,
    map: textura || null,
    shininess: 5,
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.userData = { dist: dist, speed: vel };
  mesh.position.set(dist, 0, 0);

  pivote.add(mesh);
  Satelites.push(mesh);

  dibujarOrbitaLuna(pivote, dist);
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

function crearCinturonAsteroides(rMin, rMax) {

  const geomRoca = new THREE.DodecahedronGeometry(0.04, 1);
  const matRoca = new THREE.MeshPhongMaterial({ color: 0x887766, flatShading: true });

  mallaAsteroides = new THREE.InstancedMesh(geomRoca, matRoca, totalAsteroides);
  mallaAsteroides.castShadow = true;
  mallaAsteroides.receiveShadow = true;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < totalAsteroides; i++) {
    // Distorsión toroidal en radio y ángulo
    const radio = THREE.MathUtils.randFloat(rMin, rMax);
    const angulo = Math.random() * Math.PI * 2;
    const dispersionZ = THREE.MathUtils.randFloatSpread(0.8);
    const escala = THREE.MathUtils.randFloat(0.5, 1.8);
    const velocidad = THREE.MathUtils.randFloat(0.3, 0.6);

    datosAsteroides.push({ radio, angulo, dispersionZ, escala, velocidad });

    dummy.position.set(Math.cos(angulo) * radio, Math.sin(angulo) * radio, dispersionZ);
    dummy.scale.set(escala, escala, escala);
    dummy.updateMatrix();

    mallaAsteroides.setMatrixAt(i, dummy.matrix);
  }

  scene.add(mallaAsteroides);
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
  Estrella(2.0, 0xffffff, texSol);

  // 1. Mercurio (textura rocosa)
  Planeta(0.15, 3.5, 4.0, 0xffffff, 1.0, 1.1, 0, { map: texMercurio });

  // 2. Venus (superficie volcánica + capa exterior de nubes sulfurosas)
  const venus = Planeta(0.35, 4.8, 1.5, 0xffffff, 1.0, 1.0, 0, { map: texVenusSup });
  añadirNubes(venus, 0.355, texVenusAtm);

  // 3. Tierra (mapa base + relieve en montañas + brillo en agua + nubes con transparencia)
  const tierra = Planeta(0.4, 6.5, 1.0, 0xffffff, 1.0, 1.0, 0, {
    map: texTierra,
    bumpMap: texTierraBump,
    bumpScale: 0.05,
    specularMap: texTierraSpec,
  });
  añadirNubes(tierra, 0.42, texNubes, texNubesAlpha);

  Luna(tierra, 0.8, 0.08, 3.0, 0xffffff, THREE.MathUtils.degToRad(5.14), texLuna); // Luna de la Tierra

  // 4. Marte (textura rojiza de la superficie)
  Planeta(0.25, 8.0, 0.5, 0xffffff, 1.0, 1.05, 0, { map: texMarte });

  // 5. Júpiter (bandas gaseosas)
  Planeta(1.2, 11.5, 0.2, 0xffffff, 1.0, 1.0, 0, { map: texJupiter });

  // 6. Saturno (atmósfera + sus anillos)
  const saturno = Planeta(1.0, 15.0, 0.1, 0xffffff, 1.0, 1.0, 0, { map: texSaturno });
  añadirAnillos(saturno, 1.25, 2.3, texAnillo);

  // 7. Urano (tono cian)
  Planeta(0.7, 18.5, 0.05, 0xffffff, 1.0, 1.0, 0, { map: texUrano });

  // 8. Neptuno (azul profundo con vórtices)
  Planeta(0.68, 22.0, 0.03, 0xffffff, 1.0, 1.0, 0, { map: texNeptuno });
}

function añadirNubes(planeta, radioNubes, texMap, texAlpha = null) {
  const geomNubes = new THREE.SphereGeometry(radioNubes, 32, 32);
  const matNubes = new THREE.MeshPhongMaterial({
    map: texMap,
    transparent: true,
    side: THREE.DoubleSide,
    opacity: 0.9,
  });

  if (texAlpha) matNubes.alphaMap = texAlpha;

  const mallaNubes = new THREE.Mesh(geomNubes, matNubes);
  planeta.add(mallaNubes); // Hijo del planeta[
  return mallaNubes;
}

function añadirAnillos(planeta, radioInterno, radioExterno, texAnillo) {
  const geomAnillo = new THREE.RingGeometry(radioInterno, radioExterno, 64);

  // Mapeo radial UV
  const pos = geomAnillo.attributes.position;
  const uv = geomAnillo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    const u = (dist - radioInterno) / (radioExterno - radioInterno);
    uv.setXY(i, u, 0.5);
  }
  uv.needsUpdate = true;

  const matAnillo = new THREE.MeshPhongMaterial({
    map: texAnillo,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  const mallaAnillo = new THREE.Mesh(geomAnillo, matAnillo);
  mallaAnillo.rotation.x = Math.PI / 2;
  mallaAnillo.castShadow = true;
  mallaAnillo.receiveShadow = true;

  planeta.add(mallaAnillo);
  return mallaAnillo;
}

// ==========================================
// 6. ENTORNO, CÁMARA, GUI Y EVENTOS
// ==========================================
function alternarModoVista() {
  modoVista = (modoVista === "general") ? "nave" : "general";
  controlesOrbitales.enabled = (modoVista === "general");
}

function prepararEscenaYCamara() {
  scene = new THREE.Scene();

  // 1. Llamada a la API de la NASA (APOD)
  fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
    .then(response => response.json())
    .then(data => {
      // Si la NASA publica una imagen hoy, la usamos de fondo
      if (data.media_type === "image") {
        const texFondoDinamico = textureLoader.load(data.url);
        texFondoDinamico.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texFondoDinamico;
      } else {
        // Si publican un vídeo, usamos textura local por defecto
        texFondoEspacio.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texFondoEspacio;
      }
    })
    .catch(error => {
      // Si falla la conexión a la API, usamos la textura local
      console.warn("Fallo en la API de la NASA, usando fondo por defecto.");
      texFondoEspacio.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texFondoEspacio;
    });

  // 1. CÁMARA GENERAL (Mantienes el resto de tu código exactamente igual a partir de aquí)
  camaraGeneral = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camaraGeneral.position.set(0, 0, 15);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  controlesOrbitales = new OrbitControls(camaraGeneral, renderer.domElement);

  // 2. CÁMARA NAVE
  camaraNave = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camaraNave.position.set(0, -6, 1.5);
  camaraNave.lookAt(0, 0, 0);

  controlesNave = new FlyControls(camaraNave, renderer.domElement);
  controlesNave.movementSpeed = 5.0;
  controlesNave.rollSpeed = 0.5;
  controlesNave.dragToLook = true;

  // Rejilla de referencia
  grid = new THREE.GridHelper(50, 50);
  grid.geometry.rotateX(Math.PI / 2);
  grid.position.set(0, 0, 0.05);
  scene.add(grid);

  // Raycaster y plano para colocación interactiva
  raycaster = new THREE.Raycaster();
  const geometryp = new THREE.PlaneGeometry(80, 80);
  const materialp = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  plano = new THREE.Mesh(geometryp, materialp);
  plano.visible = false;
  scene.add(plano);

  crearBotonRejilla();
}

function panelInteractivo() {
  const gui = new GUI({ title: "Configurar Astros" });

  // Carpeta de Vista y Simulación
  const fVista = gui.addFolder("Cámara y Tiempo");
  fVista.add({ cambiar: () => alternarModoVista() }, "cambiar").name("Cambiar Vista (V)");
  fVista.add({ vel: velocidadSimulacion }, "vel", 0, 0.005, 0.0002).name("Paso del Tiempo").onChange(v => velocidadSimulacion = v);
  fVista.add({ pausar: () => { velocidadSimulacion = (velocidadSimulacion === 0) ? 0.001 : 0; } }, "pausar").name("Pausar / Reanudar");

  const opcionesFoco = ["Libre (Centro)", "Mercurio", "Venus", "Tierra", "Marte", "Júpiter", "Saturno", "Urano", "Neptuno"];
  fVista.add({ foco: "Libre (Centro)" }, "foco", opcionesFoco).name("Seguir Astro").onChange((seleccion) => {
    if (seleccion === "Libre (Centro)") {
      astroEnfocado = null;
      controlesOrbitales.target.set(0, 0, 0);
    } else {
      const idxPlaneta = opcionesFoco.indexOf(seleccion) - 1;
      astroEnfocado = Planetas[idxPlaneta];
    }
  });
  fVista.open();

  // Carpeta del Planeta
  const fPlaneta = gui.addFolder("Planeta");
  const fSatelite = gui.addFolder("Satélite Opcional");

  fPlaneta
    .add(configCreacion, "conPlaneta")
    .name("¿Crear Planeta?")
    .onChange((activado) => {
      if (activado) {
        fSatelite.show();
      } else {
        configCreacion.conSatelite = false;
        fSatelite.hide();
      }
    });

  fPlaneta.add(configCreacion, "radio", 0.1, 1.2, 0.05).name("Radio");
  fPlaneta.add(configCreacion, "velocidad", 0.1, 3.0, 0.1).name("Velocidad");
  fPlaneta.add(configCreacion, "focoElipse", 0.8, 1.3, 0.05).name("Excentricidad");
  fPlaneta.addColor(configCreacion, "color").name("Color");
  fPlaneta.add(configCreacion, "conNubes").name("¿Añadir Nubes?");
  fPlaneta.add(configCreacion, "conAnillos").name("¿Añadir Anillos?");
  fPlaneta.open();

  fSatelite.add(configCreacion, "conSatelite").name("¿Llevará Luna?");
  fSatelite.add(configCreacion, "radioSatelite", 0.03, 0.15, 0.01).name("Radio Luna");
  fSatelite.add(configCreacion, "velSatelite", 0.5, 5.0, 0.5).name("Vel. Luna");
  fSatelite.addColor(configCreacion, "colorSatelite").name("Color Luna");
  fSatelite.open();

  if (!configCreacion.conPlaneta) {
    fSatelite.hide();
  }

  gui.add(configCreacion, "borrarUltimo").name("Borrar Último");
}

function configurarEventosInteraccion() {
  document.addEventListener("mousedown", onDocumentMouseDown);

  window.addEventListener("keydown", (event) => {
    // Tecla 'B' o 'Delete' para borrar
    if (event.key === "b" || event.key === "B" || event.key === "Delete") {
      eliminarUltimoPlaneta();
    }
    // Tecla 'V' para alternar la vista entre Nave y General
    if (event.key === "v" || event.key === "V") {
      modoVista = (modoVista === "general") ? "nave" : "general";
      controlesOrbitales.enabled = (modoVista === "general");
    }
  });
  window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
  
    // Actualizar ambas cámaras
    camaraGeneral.aspect = width / height;
    camaraGeneral.updateProjectionMatrix();
  
    camaraNave.aspect = width / height;
    camaraNave.updateProjectionMatrix();
  
    renderer.setSize(width, height);
  });
}

function onDocumentMouseDown(event) {
  // 1. Si estamos pilotando la nave, NO creamos planetas ni lanzamos raycaster
  if (modoVista === "nave") return;

  // 2. Ignorar si pulsamos sobre lil-gui o un botón
  if (event.target.closest(".lil-gui") || event.target.tagName === "BUTTON") return;
  if (event.button !== 0) return;

  const mouse = {
    x: (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
    y: -(event.clientY / renderer.domElement.clientHeight) * 2 + 1,
  };


  raycaster.setFromCamera(mouse, camaraGeneral);
  const intersects = raycaster.intersectObject(plano);

  if (intersects.length > 0) {
    const pt = intersects[0].point;
    const distancia = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
    const anguloClic = Math.atan2(pt.y, pt.x);

    if (distancia < 2.5) return; // Evitar solapar con el Sol

    const colPlaneta = parseInt(configCreacion.color.replace("#", "0x"));

    // Crear planeta
    if (configCreacion.conPlaneta) {
      const nuevoPlaneta = Planeta(
        configCreacion.radio,
        distancia,
        configCreacion.velocidad,
        colPlaneta,
        1.0,
        configCreacion.focoElipse,
        anguloClic
      );

      if (configCreacion.conNubes) {
        const radioNubes = configCreacion.radio * 1.05;
        añadirNubes(nuevoPlaneta, radioNubes, texNubes, texNubesAlpha);
      }

      if (configCreacion.conAnillos) {
        const rInterno = configCreacion.radio * 1.3;
        const rExterno = configCreacion.radio * 2.3;
        añadirAnillos(nuevoPlaneta, rInterno, rExterno, texAnillo);
      }

      if (configCreacion.conSatelite) {
        const colLuna = parseInt(configCreacion.colorSatelite.replace("#", "0x"));
        const distLuna = configCreacion.conAnillos 
          ? configCreacion.radio * 2.5 + configCreacion.radioSatelite
          : configCreacion.radio + configCreacion.radioSatelite + 0.3;
        Luna(nuevoPlaneta, distLuna, configCreacion.radioSatelite, configCreacion.velSatelite, colLuna);
      }
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
  infoDiv.innerHTML = "Naiara Díaz Hernández - Sistema Planetario S7 | [V]: Nave/General | [B]: Borrar";
  document.body.appendChild(infoDiv);
}

function prepararLuces() {
    // 1. Luz Ambiente: ilumina suavemente todo el espacio para que la cara oculta no sea negra pura
    luzAmbiente = new THREE.AmbientLight(0xffffff, 0.2); // Color blanco tenue
    scene.add(luzAmbiente);
  
    // 2. Luz Puntual (El Sol): situada en el origen (0, 0, 0), emite luz radialmente
    luzSol = new THREE.PointLight(0xffffff, 2.5, 0, 0.5);
    luzSol.position.set(0, 0, 0); // En el centro del Sol
    
    // Activar que la luz solar proyecte sombras sobre los planetas y lunas
    luzSol.castShadow = true;
  
    // Configuración de resolución del mapa de sombras (para que se vean nítidas)
    luzSol.shadow.mapSize.width = 1024;
    luzSol.shadow.mapSize.height = 1024;
    luzSol.shadow.camera.near = 0.5;
    luzSol.shadow.camera.far = 100;
  
    scene.add(luzSol);
  }

