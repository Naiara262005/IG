# Práctica S6 y S7: Simulación de Sistema Planetario Interactivo 3D

* **Asignatura:** Informática Gráfica
* **Titulación:** Grado en Ingeniería Informática
* **Centro:** Escuela de Ingeniería Informática (EII), ULPGC
* **Profesor:** Modesto Castrillón Santana
* **Autora:** Naiara Díaz Hernández
* **Código fuente:** [`src/trabajo_S6-S7.js`](src/trabajo_S6-S7.js)

## Índice

1. [Resumen del trabajo realizado](#1-resumen-del-trabajo-realizado)
2. [Extras implementados](#2-extras-implementados)
3. [Decisiones de diseño y justificación técnica](#3-decisiones-de-diseño-y-justificación-técnica)
4. [Manual de uso y controles](#4-manual-de-uso-y-controles)
5. [Demostración en vídeo](#5-demostración-en-vídeo)
6. [Limitaciones conocidas](#6-limitaciones-conocidas)
7. [Fuentes y recursos utilizados](#7-fuentes-y-recursos-utilizados)
8. [Declaración sobre el uso de herramientas de Inteligencia Artificial](#8-declaración-sobre-el-uso-de-herramientas-de-inteligencia-artificial)


## 1. Resumen del trabajo realizado

En esta práctica se ha desarrollado una aplicación gráfica interactiva en 3D con Three.js que modela un sistema planetario completo. Integra los hitos de la sesión S6 (grafo de escena, cinemática orbital desacoplada, satélites, raycasting e interfaz) y de la sesión S7 (iluminación, sombras suaves, materiales Phong con varios mapas de textura, remapeo polar de UVs, fondo espacial y navegación subjetiva con doble cámara).

El sistema consta de:

* **Sol:** esfera de radio 2 con textura fotográfica (`MeshBasicMaterial`) y una luz puntual (`PointLight`) en el origen que ilumina la escena y proyecta sombras.
* **8 planetas** (Mercurio a Neptuno) con órbitas elípticas independientes, dibujadas como línea, y texturas 2K (1K en el caso de la Tierra).
* **Tierra:** material Phong con mapa difuso, mapa de relieve (`bumpMap`, escala 0,05) y mapa especular (`specularMap`) que potencia el brillo sobre los océanos, más una capa de nubes concéntrica con `alphaMap`. La **Luna** orbita en un plano inclinado 5,14°.
* **Venus:** doble capa, con la superficie y una envoltura atmosférica semitransparente (opacidad 0,9).
* **Saturno:** anillos con textura PNG con canal alfa y UVs remapeadas de forma radial.
* **Cinturón de 1.000 asteroides** procedurales entre Marte y Júpiter, renderizados con una única llamada de dibujo (`InstancedMesh`).
* **Dos cámaras conmutables:** una cámara orbital general (`OrbitControls`), con opción de centrarla en un planeta, y una cámara subjetiva de nave (`FlyControls`) para vuelo libre.
* **Creación interactiva de planetas** con el ratón (con nubes, anillos y una luna opcionales), borrado del último planeta y panel de control `lil-gui`.
* **Fondo espacial** obtenido de la API APOD de la NASA, con textura local como alternativa.

## 2. Extras implementados

* **Fondo espacial dinámico:** se consulta la API APOD de la NASA y, si la entrada del día es una imagen, se usa como fondo de la escena. Si es un vídeo o falla la petición, se usa la textura local `2k_stars_milky_way.jpg`.
* **Creación interactiva de planetas:** un clic izquierdo sobre el plano de la escena (mediante `Raycaster`) crea un planeta cuya órbita pasa por el punto pulsado. Se pueden configurar radio, velocidad, factor de elipticidad, color, nubes, anillos y una luna.
* **Borrado interactivo:** la tecla `B`, la tecla `Delete` o el botón *Borrar Último* eliminan el último planeta de la lista, junto con su línea de órbita y sus lunas.
* **Seguimiento de planetas:** desde el panel se puede elegir uno de los 8 planetas del sistema para que la cámara orbital lo mantenga como punto de mira mientras se mueve.
* **Nave controlable:** la cámara subjetiva permite desplazarse, ascender, descender, alabear y orientar la vista de forma interactiva.
* **Optimización de renderizado:** uso de `InstancedMesh` para el cinturón de asteroides (1 *draw call* para los 1.000 objetos).
* **Identificación de la autora:** cabecera con el nombre superpuesta a la escena en todo momento (y por tanto visible en el vídeo).

## 3. Decisiones de diseño y justificación técnica

### 3.1. Cinemática orbital desacoplada frente a jerarquía simple de mallas

Si los planetas se añadieran como hijos del Sol (`sol.add(planeta)`), cualquier rotación aplicada al Sol se transmitiría a todos ellos, que girarían de forma solidaria con él.

* **Solución adoptada:** los planetas se añaden directamente a la raíz de la escena. En cada iteración de `animate()` se calcula su posición con las ecuaciones paramétricas de una elipse, `x = cos(θ)·dist·f1` e `y = sin(θ)·dist·f2`, con `θ = ánguloInicial + tiempo·velocidad`.
* **Rotación propia:** se aplica por separado sobre `planeta.rotation.z`, de modo que el giro sobre sí mismo es independiente de la traslación orbital. El Sol también gira sobre su eje (`estrella.rotation.z`).

### 3.2. Inclinación del plano orbital lunar mediante nodo pivote

* **Problema:** calcular la órbita de la Luna directamente dentro del planeta no permite inclinar su plano orbital de forma sencilla.
* **Solución adoptada:** se inserta un nodo vacío (`THREE.Object3D`) como hijo del planeta, rotado 5,14° en el eje X. La Luna se añade como hija de ese pivote, que le transmite la inclinación. La línea de la órbita lunar también cuelga del pivote.

### 3.3. Remapeo polar de coordenadas UV en los anillos de Saturno

* **Problema:** `THREE.RingGeometry` genera UVs planares, que deforman una textura de anillos pensada como una franja radial.
* **Solución adoptada:** se recorren los vértices y, para cada uno, se calcula su distancia al centro, normalizada entre el radio interior y el exterior. Ese valor se asigna como `u`, con `v = 0.5`, de modo que la textura se reparte en anillos concéntricos. El material usa la textura PNG con transparencia, `DoubleSide` y opacidad 0,9.

### 3.4. Optimización del cinturón de asteroides con `THREE.InstancedMesh`

* **Solución adoptada:** una única geometría (`DodecahedronGeometry`) y un único material Phong con `flatShading` se comparten entre las 1.000 instancias. Cada asteroide tiene radio orbital entre 9,0 y 10,5, un ángulo inicial aleatorio, una pequeña dispersión en Z, una escala entre 0,5 y 1,8 y su propia velocidad.
* **Animación:** en cada fotograma se recalculan las matrices con un objeto auxiliar (`dummy`) y se marca `instanceMatrix.needsUpdate`, de modo que todo el cinturón se dibuja en una sola llamada.

### 3.5. Superficie terrestre y capas concéntricas

* La Tierra combina textura difusa (`map`), mapa de relieve (`bumpMap`) y mapa especular (`specularMap`) sobre un material `MeshPhongMaterial`.
* Las nubes se sitúan en una esfera concéntrica independiente, hija de la Tierra, con un radio un 5 % mayor (0,42 frente a 0,40) y un `alphaMap`, de modo que la superficie se ve a través de las zonas transparentes. Venus usa el mismo mecanismo para su envoltura atmosférica, aunque sin `alphaMap`.

### 3.6. Colocación de planetas con Raycaster

* **Proyección:** el clic se proyecta con un `Raycaster` contra un `THREE.PlaneGeometry` invisible situado en Z = 0. Del punto de intersección se obtienen la distancia al Sol (radio orbital) y el ángulo inicial del nuevo planeta.
* **Exclusiones:** se ignoran los clics sobre la interfaz de `lil-gui` o sobre botones, los que no sean del botón izquierdo, los realizados en modo nave y los que caen a menos de 2,5 unidades del centro, para no solapar el Sol.

### 3.7. Iluminación y sombras

* **Luz ambiente** (`AmbientLight`, intensidad 0,2) para que la cara no iluminada no quede completamente negra.
* **Luz puntual** (`PointLight`, intensidad 2,5, `decay` 0,5) en el centro del Sol, con sombras activadas (mapa de 1024×1024).
* El renderizador usa `PCFSoftShadowMap` (sombras suaves). Los planetas, la Luna, los anillos y los asteroides proyectan y reciben sombras.

## 4. Manual de uso y controles

### Teclado y ratón

| Acción | Control | Modo activo |
| ----- | ----- | ----- |
| **Alternar vista de cámara** | Tecla `V` o botón *Cambiar Vista (V)* del panel | Ambos |
| **Borrar el último planeta de la lista** | Tecla `B` o `Delete`, o botón *Borrar Último* | Ambos |
| **Crear nuevo planeta** | Clic izquierdo sobre el plano de la escena | General |
| **Rotar / Zoom / Paneo orbital** | Arrastrar con el ratón / rueda / arrastre secundario (`OrbitControls`) | General |
| **Desplazamiento de la nave** | `W` (adelante), `S` (atrás), `A` (izquierda), `D` (derecha) | Nave |
| **Elevación de la nave** | `R` (subir), `F` (bajar) | Nave |
| **Alabeo de la nave** | `Q` / `E` | Nave |
| **Orientar la vista de la nave** | Arrastrar con el ratón o flechas del teclado (cabeceo y guiñada) | Nave |
| **Mostrar / ocultar la rejilla** | Botón *Rejilla on/off* (arriba a la izquierda) | Ambos |

### Panel `lil-gui` («Configurar Astros»)

* **Cámara y Tiempo:** botón para cambiar de vista, deslizador *Paso del Tiempo*, botón *Pausar / Reanudar* y selector *Seguir Astro* (Libre, Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano, Neptuno).
* **Planeta:** *¿Crear Planeta?*, radio, velocidad, excentricidad (factor de elipticidad), color, *¿Añadir Nubes?* y *¿Añadir Anillos?*.
* **Satélite Opcional:** *¿Llevará Luna?*, radio, velocidad y color de la luna.
* **Borrar Último:** elimina el último planeta de la lista.

Los planetas creados por el usuario llevan solo el color elegido (sin textura). Las nubes y los anillos opcionales reutilizan las texturas de nubes de la Tierra y de anillos de Saturno.

## 5. Demostración en vídeo

▶️ [**Ver la demostración en vídeo de la simulación (demo.mp4)**](media/demo.mp4)

La cabecera con el nombre de la autora está fija en el DOM, por lo que aparece durante toda la grabación.

## 6. Limitaciones conocidas

* El clic izquierdo crea un planeta incluso cuando se inicia con él un arrastre para orbitar la cámara (solo se desactiva en modo nave).
* *Borrar Último* actúa sobre el último elemento de la lista de planetas: si no se ha creado ninguno, elimina los planetas del sistema base empezando por Neptuno.
* *Paso del Tiempo* y *Pausar* afectan a las órbitas de planetas y lunas, pero no al cinturón de asteroides ni a las rotaciones propias. Además, al cambiarlo, los planetas pueden dar un salto de posición, porque el ángulo se calcula con el tiempo transcurrido desde su creación.
* *Seguir Astro* reorienta la cámara hacia el planeta, pero no la desplaza con él, y no incluye la Luna ni los planetas creados por el usuario.
* La imagen del día de la NASA no es una panorámica, por lo que puede verse deformada al aplicarse como fondo equirrectangular. Se usa la clave pública `DEMO_KEY`, con límite de peticiones.

## 7. Fuentes y recursos utilizados

1. **Texturas:** [Solar System Scope](https://www.solarsystemscope.com/textures/) (2K) y recursos de la asignatura/ULPGC (1K de la Tierra).
2. **API externa:** [NASA Open APIs (APOD)](https://api.nasa.gov/).
3. **Documentación:** [Three.js Docs](https://threejs.org/docs/), [lil-gui](https://lil-gui.georgealways.com) y guiones S6/S7 (Prof. Modesto Castrillón Santana).

## 8. Declaración sobre el uso de herramientas de Inteligencia Artificial

En cumplimiento con las directrices docentes:

* **Herramientas empleadas:** Asistentes de IA generativa (Gemini).

* **Alcance del soporte recibido:** Asistencia en la depuración de errores, búsqueda de recursos y ayuda en la redacción de la documentación técnica.
* **Enlaces a conversaciones:**

  * [Enlace a la conversación de desarrollo y depuración con Gemini](https://share.gemini.google/LDOkguPr30H5)

* **Supervisión:** Todo el código y la documentación fueron integrados y revisados meticulosamente por la autora.
