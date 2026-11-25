import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as TWEEN from "@tweenjs/tween.js";

let scene, camera, renderer, controls;
let pivoteTapa, pivotePedestal, pivoteManivela, cilindro, figura;
let particulas, particulasPos;

let listener, sound;
let audioloaded = false;

let nivelCuerda = 0;
let dandoCuerda = false;
let abierta = false;
let enMarcha = false;

// Grupo de tweens
const tweenGroup = new TWEEN.Group();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickInicio = new THREE.Vector2();


init();
animationLoop();

function init() {
  configurarEscena();
  configurarLuces();
  configurarAudio();
  crearMesa();
  crearCajaMusica();
  crearParticulas();
  crearHUD();
  configurarEventos();
}

function configurarEscena() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131b2e);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(7.5, 5.8, 7.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.4, 0);
  controls.update();
}

function configurarLuces() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
  dirLight.position.set(6, 12, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  const luzInterior = new THREE.PointLight(0x7dd3fc, 1.2, 7);
  luzInterior.position.set(-0.6, 2.3, 0.2);
  scene.add(luzInterior);
}

function configurarAudio() {
  listener = new THREE.AudioListener();
  camera.add(listener);
  sound = new THREE.Audio(listener);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load(
    "src/25_river-flows-in-you_musicboxmaniacs.com.mp3",
    onAudioCargado,
    undefined,
    onAudioError
  );

  sound.onEnded = alTerminarMelodia;
}

function onAudioCargado(buffer) {
  sound.setBuffer(buffer);
  sound.setLoop(false);
  sound.setVolume(0.75);
  audioloaded = true;
}

function onAudioError(err) {
  console.error("Error cargando el audio:", err);
}

function alTerminarMelodia() {
  if (!enMarcha) return;
  nivelCuerda = 0;
  enMarcha = false;
  actualizarHUD();
  if (abierta) {
    cerrarCaja();
  }
}

function crearMesa() {
  const mesa = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 0.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x222c3f, roughness: 0.6 })
  );
  mesa.position.y = -0.2;
  mesa.receiveShadow = true;
  scene.add(mesa);

  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.03, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 })
  );
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.01;
  scene.add(aro);
}

function crearCajaMusica() {
  const cajaGrupo = new THREE.Group();
  cajaGrupo.position.y = 0.25;
  scene.add(cajaGrupo);

  crearEstructuraCaja(cajaGrupo);
  crearTapaCaja(cajaGrupo);
  crearMecanismoMusical(cajaGrupo);
  crearManivelaLateral(cajaGrupo);
  crearBailarina(cajaGrupo);
}

function crearEstructuraCaja(padre) {
  const matMadera = new THREE.MeshStandardMaterial({ color: 0x6b2d1a, roughness: 0.35 });
  const matTerciopelo = new THREE.MeshStandardMaterial({ color: 0x162d4c, roughness: 0.9 });
  const matOro = new THREE.MeshStandardMaterial({ color: 0xe6be53, metalness: 0.85, roughness: 0.25 });

  const ancho = 4.8, alto = 1.9, fondo = 3.6, grosor = 0.22;

  const coordsPatas = [
    [-2.1, -1.5],
    [2.1, -1.5],
    [-2.1, 1.5],
    [2.1, 1.5],
  ];
  for (let i = 0; i < coordsPatas.length; i++) {
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.25, 16), matOro);
    pata.position.set(coordsPatas[i][0], -0.125, coordsPatas[i][1]);
    pata.castShadow = true;
    padre.add(pata);
  }

  const base = new THREE.Mesh(new THREE.BoxGeometry(ancho, grosor, fondo), matMadera);
  base.position.y = grosor / 2;
  base.castShadow = true;
  padre.add(base);

  const interior = new THREE.Mesh(new THREE.BoxGeometry(ancho - 0.44, 0.1, fondo - 0.44), matTerciopelo);
  interior.position.y = 0.45;
  interior.receiveShadow = true;
  padre.add(interior);

  const molduraInf = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.14, 0.08, fondo + 0.14), matOro);
  molduraInf.position.y = 0.08;
  padre.add(molduraInf);

  const molduraSup = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.12, 0.08, fondo + 0.12), matOro);
  molduraSup.position.y = alto - 0.02;
  padre.add(molduraSup);
  

  const paredes = [
    [ancho, alto, grosor, 0, alto / 2, fondo / 2 - grosor / 2],
    [ancho, alto, grosor, 0, alto / 2, -fondo / 2 + grosor / 2],
    [grosor, alto, fondo - grosor * 2, -ancho / 2 + grosor / 2, alto / 2, 0],
    [grosor, alto, fondo - grosor * 2, ancho / 2 - grosor / 2, alto / 2, 0],
  ];
  for (let i = 0; i < paredes.length; i++) {
    const p = paredes[i];
    const pared = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), matMadera);
    pared.position.set(p[3], p[4], p[5]);
    pared.castShadow = true;
    padre.add(pared);
  }

  const cerradura = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), matOro);
  cerradura.rotation.x = Math.PI / 2;
  cerradura.position.set(0, alto - 0.28, fondo / 2 + 0.02);
  padre.add(cerradura);
}

function crearTapaCaja(padre) {
  const matMadera = new THREE.MeshStandardMaterial({ color: 0x7c341e, roughness: 0.35 });
  const matOro = new THREE.MeshStandardMaterial({ color: 0xe6be53, metalness: 0.85, roughness: 0.25 });
  const ancho = 4.8, alto = 1.9, fondo = 3.6;

  pivoteTapa = new THREE.Object3D();
  pivoteTapa.position.set(0, alto, -fondo / 2);
  padre.add(pivoteTapa);

  const tapa = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.06, 0.45, fondo + 0.06), matMadera);
  tapa.position.set(0, 0.225, fondo / 2);
  tapa.castShadow = true;
  pivoteTapa.add(tapa);

  const marco = new THREE.Mesh(new THREE.BoxGeometry(ancho - 0.5, 0.05, fondo - 0.5), matOro);
  marco.position.set(0, 0.46, fondo / 2);
  pivoteTapa.add(marco);

  const espejo = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho - 0.8, fondo - 0.8),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 0.9, roughness: 0.1 })
  );
  espejo.rotation.x = Math.PI / 2;
  espejo.position.set(0, -0.01, fondo / 2);
  pivoteTapa.add(espejo);
}

function crearMecanismoMusical(padre) {
  const matOro = new THREE.MeshStandardMaterial({ color: 0xe6be53, metalness: 0.85, roughness: 0.25 });
  const matAcero = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.2 });

  // Cilindro musical
  cilindro = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 24), matOro);
  cilindro.rotation.z = Math.PI / 2;
  cilindro.position.set(1.0, 0.85, -0.35);
  padre.add(cilindro);

  for (let i = 0; i < 28; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), matAcero);
    const ang = (i / 28) * Math.PI * 6;
    pin.position.set((i / 28 - 0.5) * 1.25, Math.cos(ang) * 0.29, Math.sin(ang) * 0.29);
    pin.rotation.x = ang;
    cilindro.add(pin);
  }

  // Peine metálico
  const peine = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.06, 0.4), matAcero);
  peine.position.set(1.0, 0.88, 0.1);
  padre.add(peine);
}

function crearManivelaLateral(padre) {
  const matOro = new THREE.MeshStandardMaterial({ color: 0xe6be53, metalness: 0.85, roughness: 0.25 });
  const matPomo = new THREE.MeshStandardMaterial({ color: 0x8c3b24, roughness: 0.35 });

  pivoteManivela = new THREE.Object3D();
  pivoteManivela.position.set(2.4, 1.05, 0);
  padre.add(pivoteManivela);

  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 16), matOro);
  eje.rotation.z = Math.PI / 2;
  eje.position.x = 0.35;

  const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), matOro);
  brazo.position.set(0.65, 0.38, 0);

  const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), matPomo);
  pomo.position.set(0.82, 0.78, 0);

  const zonaClic = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.01, depthWrite: false })
  );
  zonaClic.position.set(0.55, 0.4, 0);

  pivoteManivela.add(eje);
  pivoteManivela.add(brazo);
  pivoteManivela.add(pomo);
  pivoteManivela.add(zonaClic);
}

function crearBailarina(padre) {
  const matOro = new THREE.MeshStandardMaterial({ color: 0xe6be53, metalness: 0.85, roughness: 0.25 });
  const matVestido = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.2 });
  const matPiel = new THREE.MeshStandardMaterial({ color: 0xfde8d7, roughness: 0.35 });

  const estanque = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 0.04, 32),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 })
  );
  estanque.position.set(-0.95, 0.48, 0.15);
  padre.add(estanque);

  pivotePedestal = new THREE.Object3D();
  pivotePedestal.position.set(-0.95, 0.5, 0.15);
  padre.add(pivotePedestal);

  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 0.1, 32), matOro);
  pivotePedestal.add(disco);

  figura = new THREE.Group();
  pivotePedestal.add(figura);

  const pierna = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.48, 12), matPiel);
  pierna.position.y = 0.26;
  figura.add(pierna);

  const tutu = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, 28), matVestido);
  tutu.position.y = 0.54;
  tutu.castShadow = true;
  figura.add(tutu);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.36, 16), matVestido);
  torso.position.y = 0.78;
  figura.add(torso);

  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), matPiel);
  cabeza.position.y = 1.08;
  figura.add(cabeza);

  const brazos = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 10, 24, Math.PI), matPiel);
  brazos.position.y = 1.12;
  figura.add(brazos);
}

function crearParticulas() {
  const count = 60;
  const geom = new THREE.BufferGeometry();
  particulasPos = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    particulasPos[i * 3] = (Math.random() - 0.5) * 3.6;
    particulasPos[i * 3 + 1] = 2.0 + Math.random() * 2.4;
    particulasPos[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
  }

  geom.setAttribute("position", new THREE.BufferAttribute(particulasPos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xbae6fd,
    size: 0.09,
    transparent: true,
    opacity: 0.0,
  });

  particulas = new THREE.Points(geom, mat);
  scene.add(particulas);
}

// --- LÓGICA DE CUERDA Y APERTURA ---

function reproducirSonidoCuerda() {
  const ctx = listener.context;
  for (let i = 0; i < 4; i++) {
    const t = ctx.currentTime + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(850 + i * 110, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }
}

function darCuerda() {
  if (dandoCuerda || nivelCuerda >= 3) return;

  if (listener.context.state === "suspended") {
    listener.context.resume().then(ejecutarVueltaCuerda);
  } else {
    ejecutarVueltaCuerda();
  }
}

function ejecutarVueltaCuerda() {
  dandoCuerda = true;
  reproducirSonidoCuerda();

  const rotInicial = pivoteManivela.rotation.x;
  const tweenVuelta = new TWEEN.Tween({ rx: rotInicial }, tweenGroup)
    .to({ rx: rotInicial + Math.PI * 2 }, 450)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(function (coords) {
      pivoteManivela.rotation.x = coords.rx;
    })
    .onComplete(alTerminarVueltaCuerda);

  tweenVuelta.start();
}

function alTerminarVueltaCuerda() {
  dandoCuerda = false;
  nivelCuerda = nivelCuerda + 1;
  actualizarHUD();

  if (nivelCuerda === 3 && abierta) {
    arrancarMusicaYMecanismo();
  }
}

function arrancarMusicaYMecanismo() {
  if (enMarcha) return;
  enMarcha = true;
  actualizarHUD();

  if (audioloaded && !sound.isPlaying) {
    sound.play();
  }

  const tweenParticulas = new TWEEN.Tween({ op: particulas.material.opacity }, tweenGroup)
    .to({ op: 0.85 }, 1200)
    .onUpdate(function (coords) {
      particulas.material.opacity = coords.op;
    });

  const tweenArriba = new TWEEN.Tween({ y: 0 }, tweenGroup)
    .to({ y: 0.14 }, 750)
    .easing(TWEEN.Easing.Sinusoidal.InOut)
    .onUpdate(function (coords) {
      figura.position.y = coords.y;
    });

  const tweenAbajo = new TWEEN.Tween({ y: 0.14 }, tweenGroup)
    .to({ y: 0 }, 750)
    .easing(TWEEN.Easing.Sinusoidal.InOut)
    .onUpdate(function (coords) {
      figura.position.y = coords.y;
    });

  tweenArriba.chain(tweenAbajo);
  tweenAbajo.chain(tweenArriba);

  tweenParticulas.start();
  tweenArriba.start();
}

function abrirCaja() {
  if (abierta) return;
  abierta = true;
  actualizarHUD();

  if (listener.context.state === "suspended") {
    listener.context.resume();
  }

  const tweenTapa = new TWEEN.Tween({ a: pivoteTapa.rotation.x }, tweenGroup)
    .to({ a: -Math.PI * 0.6 }, 1400)
    .easing(TWEEN.Easing.Back.Out)
    .onUpdate(function (coords) {
      pivoteTapa.rotation.x = coords.a;
    });

  const tweenSubir = new TWEEN.Tween({ y: pivotePedestal.position.y }, tweenGroup)
    .to({ y: 1.95 }, 1100)
    .easing(TWEEN.Easing.Exponential.InOut)
    .onUpdate(function (coords) {
      pivotePedestal.position.y = coords.y;
    })
    .onComplete(alTerminarApertura);

  tweenTapa.chain(tweenSubir);
  tweenTapa.start();
}

function alTerminarApertura() {
  if (nivelCuerda === 3 && abierta) {
    arrancarMusicaYMecanismo();
  }
}

function cerrarCaja() {
  if (!abierta) return;
  abierta = false;
  enMarcha = false;
  dandoCuerda = false;
  tweenGroup.removeAll();
  actualizarHUD();

  if (audioloaded && sound.isPlaying) {
    sound.stop();
  }

  const tweenOcultar = new TWEEN.Tween({ op: particulas.material.opacity }, tweenGroup)
    .to({ op: 0 }, 700)
    .onUpdate(function (coords) {
      particulas.material.opacity = coords.op;
    });

  const tweenBajar = new TWEEN.Tween(
    { y: pivotePedestal.position.y, fy: figura.position.y },
    tweenGroup
  )
    .to({ y: 0.5, fy: 0 }, 900)
    .onUpdate(function (coords) {
      pivotePedestal.position.y = coords.y;
      figura.position.y = coords.fy;
    });

  const tweenCerrar = new TWEEN.Tween({ a: pivoteTapa.rotation.x }, tweenGroup)
    .to({ a: 0 }, 1100)
    .onUpdate(function (coords) {
      pivoteTapa.rotation.x = coords.a;
    });

  tweenBajar.chain(tweenCerrar);
  tweenOcultar.start();
  tweenBajar.start();
}

// --- EVENTOS Y HUD ---

function configurarEventos() {
  window.addEventListener("resize", onWindowResize);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
}

function detectarManivela(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObject(pivoteManivela, true).length > 0;
}

function onPointerMove(event) {
  if (detectarManivela(event)) {
    renderer.domElement.style.cursor = "pointer";
  } else {
    renderer.domElement.style.cursor = "grab";
  }
}

function onPointerDown(event) {
  clickInicio.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
  const distancia = clickInicio.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
  if (distancia < 10 && detectarManivela(event)) {
    darCuerda();
  }
}

function onKeyDown(event) {
  const tecla = event.key.toLowerCase();
  if (tecla === "a") {
    if (abierta) {
      cerrarCaja();
    } else {
      abrirCaja();
    }
  }
}

function crearHUD() {
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;bottom:16px;left:16px;color:#f8fafc;font-family:sans-serif;background:rgba(15,23,42,0.82);" +
    "padding:10px 16px;border-radius:10px;border:1px solid #e6be53;pointer-events:none;line-height:1.45;";
  hud.innerHTML =
    '<strong style="color:#fde68a;">Caja de Música · River Flows in You</strong> — Naiara Díaz Hernández<br>' +
    '<small>Cuerda: <b id="lbl-cuerda" style="color:#fde68a;">0/3</b> · Clic en manivela: dar cuerda · Tecla <b>A</b>: abrir/cerrar';
  document.body.appendChild(hud);
}

function actualizarHUD() {
  const etiqueta = document.getElementById("lbl-cuerda");
  if (etiqueta) {
    etiqueta.textContent = nivelCuerda + "/3";
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- BUCLE DE ANIMACIÓN ---

function animationLoop() {
  requestAnimationFrame(animationLoop);

  tweenGroup.update();
  controls.update();

  if (enMarcha) {
    actualizarElementosEnMarcha();
  }

  renderer.render(scene, camera);
}

function actualizarElementosEnMarcha() {
  pivotePedestal.rotation.y += 0.025;
  pivoteManivela.rotation.x -= 0.045;

  for (let i = 0; i < particulasPos.length / 3; i++) {
    particulasPos[i * 3 + 1] += 0.008;
    if (particulasPos[i * 3 + 1] > 4.5) {
      particulasPos[i * 3 + 1] = 2.0;
    }
  }
  particulas.geometry.attributes.position.needsUpdate = true;
}