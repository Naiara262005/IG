# Práctica S6 y S7: Simulación de Sistema Planetario Interactivo 3D

* **Asignatura:** Informática Gráfica
* **Titulación:** Grado en Ingeniería Informática
* **Centro:** Escuela de Ingeniería Informática (EII), ULPGC
* **Profesor:** Modesto Castrillón Santana
* **Autora:** Naiara Díaz Hernández

---

## 1. Resumen del trabajo realizado

En esta práctica se ha desarrollado una aplicación gráfica interactiva en 3D mediante Three.js que modela un sistema planetario completo. El desarrollo integra los hitos planteados en las sesiones S6 (grafo de escena, cinemática orbital desacoplada, satélites, raycasting e interfaz) y S7 (iluminación dinámica, cálculo de sombras suaves, materiales multicanal Phong, mapeo polar de UVs, entorno panorámico y navegación subjetiva con doble cámara).

El sistema consta de:
* Un Sol central con textura fotográfica y fuente de luz física omnidireccional.
* Los 8 planetas del sistema solar con órbitas independientes y texturas en resolución 2K.
* La Tierra con modelado de superficie multicapa (mapa difuso, mapa de rugosidad en escala de grises y mapa de brillo especular sobre masas oceánicas), capa concéntrica de nubes con transparencia alfa y la Luna orbitando en un plano inclinado.
* Venus con doble capa (superficie geológica y envoltura atmosférica traslúcida).
* Saturno con un sistema de anillos concéntricos con canal de transparencia y remapeo de coordenadas de textura.
* Un cinturón de 1.000 asteroides procedurales orbitando entre Marte y Júpiter renderizado en una única llamada de dibujo.
* Doble sistema de cámaras conmutables: cámara orbital general orientable con selección de seguimiento de astros y cámara subjetiva de nave para vuelo libre.
* Creación paramétrica de planetas interactivos mediante puntero de ratón, soporte para satélites en cascada, borrado selectivo y panel de control `lil-gui`.

---

## 2. Decisiones de diseño y justificación técnica

### 2.1. Cinemática orbital desacoplada frente a jerarquía simple de mallas
Si los planetas se añadieran directamente como hijos (`sol.add(planeta)`), cualquier rotación aplicada sobre el Sol obligaría a todos los planetas a rotar de forma solidaria y bloqueada a la misma velocidad angular (comportamiento similar a satélites geoestacionarios).

* **Solución adoptada:** Los planetas se agregan directamente a la raíz de la escena (`scene.add(planeta)`). Su traslación orbital se calcula en cada iteración del bucle `animate()` mediante ecuaciones horarias independientes almacenadas en `planeta.userData`:
  $$x(t) = \cos(\theta_0 + t \cdot \omega) \cdot d \cdot f_1$$
  $$y(t) = \sin(\theta_0 + t \cdot \omega) \cdot d \cdot f_2$$
  donde $f_1$ y $f_2$ permiten generar trayectorias circulares o elípticas.
* **Rotación intrínseca:** La rotación propia se aplica de forma separada sobre su eje (`planeta.rotation.z`), garantizando que la traslación y el giro de cada cuerpo sean física y computacionalmente independientes.

### 2.2. Inclinación del plano orbital lunar mediante nodo pivote
Para los satélites sí resulta ventajoso el grafo de escena, ya que su posición en el espacio debe acompañar rígidamente al planeta padre mientras este se traslada.

* **Problema:** Si se calcula la órbita de la Luna directamente dentro del planeta aplicando rotaciones, resulta complejo inclinar el plano orbital sin distorsionar el movimiento sobre la eclíptica.
* **Solución adoptada:** Se inserta un nodo intermedio vacío (`THREE.Object3D`) como hijo del planeta. Dicho pivote se rota en el eje $X$ un ángulo fijo (en la Tierra, $5.14^\circ$). La malla de la Luna se añade como hija de este pivote y se anima en un plano 2D local; la jerarquía de Three.js propaga la inclinación y la traslación de forma automática.

### 2.3. Remapeo polar de coordenadas UV en los anillos de Saturno
La textura proporcionada para los anillos (`2k_saturn_ring_alpha.png`) es una franja rectangular horizontal continua de píxeles donde el eje $X$ representa la distancia radial desde el borde interior al exterior.

* **Problema:** Por defecto, `THREE.RingGeometry` mapea las coordenadas UV de forma planar cartesiana, provocando que la textura se deforme o corte en cuatro cuadrantes rectangulares.
* **Solución adoptada:** En la función `añadirAnillos()`, se itera sobre los atributos de posición de la geometría calculando la distancia euclídea de cada vértice al centro ($r = \sqrt{x^2 + y^2}$) y normalizándola entre el radio interior y exterior:
  $$u = \frac{r - r_{int}}{r_{ext} - r_{int}}$$
  Asignando $(u, 0.5)$ a las coordenadas UV, la franja se proyecta en anillos concéntricos perfectos con soporte para su canal de opacidad.

### 2.4. Optimización del cinturón de asteroides con `THREE.InstancedMesh`
* **Problema:** Crear 1.000 mallas individuales (`THREE.Mesh`) con sus respectivas transformaciones penaliza severamente el rendimiento en JavaScript, obligando al motor a ejecutar 1.000 llamadas de dibujo (*draw calls*) por fotograma.
* **Solución adoptada:** Se emplea `THREE.InstancedMesh` con una geometría compartida de baja carga poligonal (`DodecahedronGeometry(0.04, 1)`). Mediante un objeto auxiliar `dummy` (`THREE.Object3D`), se calculan las matrices de posición y escala con dispersión toroidal en memoria y se suben a la GPU en un único búfer, manteniendo la tasa de refresco a 60 FPS estables.

### 2.5. Superficie terrestre fotorrealista y capas concéntricas
Para evitar un aspecto plástico y plano:
* La Tierra combina en su `MeshPhongMaterial` la textura difusa (`map`), un mapa de elevación en escala de grises (`bumpMap`) ponderado con `bumpScale: 0.05` para proyectar microrrelieve ante la luz rasante del Sol, y un mapa especular (`specularMap`) donde los continentes oscuros eliminan el reflejo y los océanos claros reflejan la luz solar.
* La atmósfera de nubes no se pinta sobre la textura base, sino en una esfera concéntrica independiente con radio un 5% mayor y `alphaMap: texNubesAlpha`, permitiendo ver la rotación de nubes a diferente velocidad sobre el suelo.

### 2.6. Proyección interactiva y prevención de conflictos con la cámara
* **Raycaster sobre plano invisible:** En lugar de proyectar contra el `GridHelper` (lo cual es impreciso debido a los huecos entre líneas), se proyecta contra un `THREE.PlaneGeometry` no visible situado en $Z = 0$.
* **Aislamiento en modo vuelo:** Al conmutar a la cámara de la nave (`FlyControls`), el escuchador del evento `mousedown` aborta su ejecución (`if (modoVista === "nave") return;`) y desactiva `OrbitControls`. Esto evita que arrastrar el ratón para orientar la nave cree planetas indeseados en el fondo o desate excepciones de proyección.

---

## 3. Implementación modular del código

El archivo `src/trabajo_S7.js` organiza la lógica en módulos funcionales bien diferenciados:

1. **`prepararEscenaYCamara()`:** Inicializa la escena con fondo estelar panorámico (`scene.background = texFondoEspacio`), configura `camaraGeneral` con `OrbitControls`, `camaraNave` con `FlyControls`, el plano de colisión y el asistente de rejilla.
2. **`prepararLuces()`:** Define una luz ambiente tenue (`AmbientLight`, intensidad 0.2) para dar lectura a las caras ocultas de los planetas y una luz puntual solar (`PointLight`, intensidad 2.5) con generación de sombras suaves (`castShadow = true`, mapa de $1024 \times 1024$ píxeles).
3. **`Planeta(radio, dist, vel, col, f1, f2, anguloInicial, opciones)`:** Fábrica universal de cuerpos celestes. Recibe un objeto de opciones que permite asignar de forma opcional `map`, `bumpMap` y `specularMap`, genera la elipse orbital visualizadora y almacena la metadata cinemática en `userData`.
4. **`Luna(padre, dist, radio, vel, col, inclinacion, textura)`:** Instancia satélites acoplados mediante el patrón pivote-hijo con ángulo de inclinación configurable.
5. **`añadirNubes()` y `añadirAnillos()`:** Funciones auxiliares independientes que agregan capas atmosféricas translúcidas o discos con UV polares a cualquier planeta.
6. **`crearCinturonAsteroides(rMin, rMax)`:** Distribuye 1.000 rocas en geometría instanciada entre los radios 9.0 y 10.5.
7. **`panelInteractivo()`:** Construye la interfaz reactiva mediante `lil-gui`, estructurada en carpetas de control temporal, selección de foco de cámara y generador dinámico de planetas con visibilidad condicional para satélites.
8. **`animate()`:** Ciclo de renderizado principal que computa las traslaciones orbitales con delta de tiempo escalable, actualiza la matriz del cinturón de asteroides, sincroniza el objetivo de cámara y conmuta el render según la vista activa.

---

## 4. Manual de uso y controles

### Teclado y ratón

| Acción | Control | Modo activo |
|---|---|---|
| **Alternar vista de cámara** | Tecla `V` | General / Nave |
| **Borrar último planeta creado** | Tecla `B` o `Delete` | General |
| **Crear nuevo planeta** | Clic izquierdo sobre el plano | General |
| **Rotar / Zoom / Paneo orbital** | Arrastrar ratón / Rueda de desplazamiento | General |
| **Fijar / seguir planeta** | Selector "Seguir Astro" en la GUI | General |
| **Desplazamiento de nave** | Teclas `W` (adelante), `S` (atrás), `A` (izq.), `D` (der.) | Nave |
| **Elevación de nave** | Teclas `R` (subir), `F` (bajar) | Nave |
| **Alabeo de nave** | Teclas `Q` / `E` | Nave |
| **Orientación de nave** | Arrastrar con clic izquierdo presionado | Nave |
| **Conmutar rejilla de referencia** | Botón en pantalla "Rejilla on/off" | Ambos |

### Opciones de la interfaz `lil-gui`

* **Cámara y Tiempo:** Permite conmutar la vista, regular la velocidad del paso del tiempo mediante deslizador (de 0 a 0.005), pausar y reanudar la simulación, y seleccionar un astro del sistema solar para que la cámara orbital lo siga de forma continua en su recorrido.
* **Planeta:** Habilita la colocación interactiva, define radio, velocidad orbital, excentricidad elíptica, color base, e inclusión de nubes o anillos.
* **Satélite Opcional:** Se despliega dinámicamente si se activa la creación de planeta; configura si este nacerá con una luna acoplada, su radio, velocidad y color.
* **Borrar Último:** Botón que retira de la simulación el último planeta creado junto con su órbita y satélites dependientes.

---

## 5. Demostración en vídeo y acreditación de autoría

La ejecución de la práctica, las diferentes vistas de cámara, el comportamiento de las sombras y la interactividad completa se ilustran en el siguiente registro audiovisual:

<div align="center">
  <video src="media/demo.mp4" controls width="85%" style="max-width: 100%; border-radius: 6px;">
    Tu navegador no soporta la reproducción directa de vídeo HTML5.
  </video>
  <p><em>Vídeo 1: Demostración funcional del simulador (vistas de cámara, cinemática y sombras).</em></p>
</div>
* **Acreditación de autoría:** La escena cuenta con un encabezado fijo en el DOM superior (`Naiara Díaz Hernández - Sistema Planetario S7`), visible de manera ininterrumpida a lo largo de toda la grabación.

---

## 6. Fuentes y recursos utilizados

1. **Texturas planetarias y espaciales:**
   * Texturas de 2K del Sol, Mercurio, Venus, Marte, Júpiter, Saturno (y anillos), Urano, Neptuno, Luna y fondo estelar de la Vía Láctea procedentes del catálogo abierto de [Solar System Scope](https://www.solarsystemscope.com/textures/) (licencia Creative Commons Reconocimiento 4.0 Internacional).
   * Mapas de textura de la Tierra (`earthmap1k`, `earthbump1k`, `earthspec1k`, `earthcloudmap` y `earthcloudmaptrans_invert`) correspondientes a los recursos de la sesión S7 facilitados en la asignatura.
2. **Documentación y bibliotecas de referencia:**
   * Three.js Documentation ([threejs.org/docs](https://threejs.org/docs/)): módulos `PerspectiveCamera`, `WebGLRenderer`, `MeshPhongMaterial`, `PointLight`, `InstancedMesh`, `OrbitControls` y `FlyControls`.
   * Lil-gui Documentation ([lil-gui.georgealways.com](https://lil-gui.georgealways.com/)).
   * Material docente y guiones de las sesiones S6 y S7 de Informática Gráfica, EII, ULPGC (Prof. Modesto Castrillón Santana).

---

## 7. Declaración sobre el uso de herramientas de Inteligencia Artificial

En cumplimiento con las directrices docentes relativas a la transparencia en el uso de modelos de lenguaje:

* **Herramientas empleadas:** Asistentes de IA generativa (Gemini).
* **Alcance del soporte recibido:**
  * Asistencia en la depuración de errores, búsqueda de recursos y ayuda en la redacción de la documentación técnica.
* **Supervisión:** Todo fue integrado, revisado y adaptado por la autora.
