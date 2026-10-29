# Práctica S6 y S7: Simulación de Sistema Planetario Interactivo 3D

* **Asignatura:** Informática Gráfica

* **Titulación:** Grado en Ingeniería Informática

* **Centro:** Escuela de Ingeniería Informática (EII), ULPGC

* **Profesor:** Modesto Castrillón Santana

* **Autora:** Naiara Díaz Hernández

* **Código fuente:** [`src/trabajo_S6-S7.js`](src/trabajo_S6-S7.js)

## 1. Resumen del trabajo realizado

En esta práctica se ha desarrollado una aplicación gráfica interactiva en 3D mediante Three.js que modela un sistema planetario completo. El desarrollo integra los hitos planteados en las sesiones S6 (grafo de escena, cinemática orbital desacoplada, satélites, raycasting e interfaz) y S7 (iluminación dinámica, cálculo de sombras suaves, materiales multicanal Phong, mapeo polar de UVs, entorno panorámico y navegación subjetiva con doble cámara).

El sistema consta de:

* Un Sol central con textura fotográfica y fuente de luz física omnidireccional.

* Los 8 planetas del sistema solar con órbitas independientes y texturas en resolución 2K (1K en el caso de la Tierra).

* La Tierra con modelado de superficie multicapa (mapa difuso, mapa de rugosidad en escala de grises y mapa de brillo especular sobre masas oceánicas), capa concéntrica de nubes con transparencia alfa y la Luna orbitando en un plano inclinado.

* Venus con doble capa (superficie geológica y envoltura atmosférica traslúcida).

* Saturno con un sistema de anillos concéntricos con canal de transparencia y remapeo de coordenadas de textura.

* Un cinturón de 1.000 asteroides procedurales orbitando entre Marte y Júpiter renderizado en una única llamada de dibujo.

* Doble sistema de cámaras conmutables: cámara orbital general orientable con selección de seguimiento de astros y cámara subjetiva de nave para vuelo libre.

* Creación paramétrica de planetas interactivos mediante puntero de ratón, soporte para satélites opcionales, borrado selectivo y panel de control `lil-gui`.

* Consumo de API Externa (NASA APOD): Integración asíncrona de datos reales para generar un cielo espacial dinámico que cambia a diario.

## 2. Extras implementados (Mejoras sobre los requisitos base)

Para dotar al simulador de mayor robustez y atractivo visual, se han implementado las siguientes características avanzadas:

* **Fondo espacial dinámico:** Consumo de la API de la NASA para actualizar el skybox diariamente.

* **Interactividad avanzada:** Creación paramétrica de planetas haciendo clic en el espacio (Raycasting) y borrado dinámico del planeta, su órbita y sus satélites.

* **Seguimiento dinámico:** Sistema algebraico para que la cámara orbital persiga a cualquier astro en movimiento.

* **Optimización de renderizado:** Uso de `InstancedMesh` para generar un cinturón de asteroides masivo sin penalizar los *draw calls*.

* **Identificación del autor:** Cabecera con el nombre de la autora superpuesta a la escena en todo momento..

## 3. Decisiones de diseño y justificación técnica

### 3.1. Cinemática orbital desacoplada frente a jerarquía simple de mallas

Si los planetas se añadieran directamente como hijos (`sol.add(planeta)`), cualquier rotación aplicada sobre el Sol obligaría a todos los planetas a rotar de forma solidaria y bloqueada a la misma velocidad angular.

* **Solución adoptada:** Los planetas se agregan directamente a la raíz de la escena. Su traslación orbital se calcula en cada iteración del bucle `animate()` mediante ecuaciones horarias independientes.

* **Rotación intrínseca:** La rotación propia se aplica de forma separada sobre su eje (`planeta.rotation.z`), garantizando independencia física.

### 3.2. Inclinación del plano orbital lunar mediante nodo pivote

* **Problema:** Calcular la órbita de la Luna directamente dentro del planeta distorsiona el movimiento si se inclina el plano.

* **Solución adoptada:** Se inserta un nodo intermedio vacío (`THREE.Object3D`) como hijo del planeta, rotado $5.14^\circ$. La Luna se añade como hija de este pivote, propagando la inclinación automáticamente.

### 3.3. Remapeo polar de coordenadas UV en los anillos de Saturno

* **Problema:** `THREE.RingGeometry` mapea las coordenadas UV de forma planar, deformando texturas horizontales.

* **Solución adoptada:** Se itera sobre los vértices calculando la distancia euclídea al centro normalizada entre el radio interior y exterior, asignando $(u, 0.5)$ a las coordenadas UV para lograr anillos concéntricos perfectos.

### 3.4. Optimización del cinturón de asteroides con `THREE.InstancedMesh`

* **Solución adoptada:** Se emplea `THREE.InstancedMesh` con una geometría compartida. Mediante un objeto auxiliar `dummy`, se calculan matrices de posición/escala con dispersión toroidal y se suben a la GPU en un único búfer, manteniendo una tasa de refresco fluida.

### 3.5. Superficie terrestre fotorrealista y capas concéntricas

* La Tierra combina textura difusa (`map`), mapa de elevación (`bumpMap`) y mapa especular (`specularMap`).

* * La atmósfera de nubes se sitúa en una esfera concéntrica independiente con radio un 5% mayor y `alphaMap`, permitiendo ver la superficie terrestre a través de las zonas transparentes.

### 3.6. Prevención de conflictos de Raycaster y Cámara

* **Colisión:** Proyección contra un `THREE.PlaneGeometry` invisible en $Z = 0$.

* **Exclusiones:** Se descartan clics sobre la interfaz de `lil-gui` o botones flotantes, y se respeta un radio de seguridad alrededor del Sol para evitar solapamientos.

## 4. Manual de uso y controles

### Teclado y ratón

| Acción | Control | Modo activo | 
| ----- | ----- | ----- | 
| **Alternar vista de cámara** | Tecla `V` | General / Nave | 
| **Borrar último planeta creado** | Tecla `B` o `Delete` | General | 
| **Crear nuevo planeta** | Clic izquierdo sobre el plano | General | 
| **Rotar / Zoom / Paneo orbital** | Arrastrar ratón / Rueda de desplazamiento | General | 
| **Desplazamiento de nave** | Teclas `W` (adelante), `S` (atrás), `A` (izq.), `D` (der.) | Nave | 
| **Elevación de nave** | Teclas `R` (subir), `F` (bajar) | Nave | 
| **Alabeo de nave** | Teclas `Q` / `E` | Nave | 

### Opciones de la interfaz `lil-gui`

* **Cámara y Tiempo:** Conmutar vista, regular paso del tiempo (deslizador y pausa) y seleccionar astro para seguimiento.

* **Planeta / Satélite:** Parámetros de creación (radio, velocidad, excentricidad, color, nubes, anillos, luna).

## 5. Demostración visual e interactiva

A continuación se muestra el enlace a la demostración en vídeo completa:

▶️ [**Clic aquí para ver la demostración en vídeo de la simulación (demo.mp4)**](media/demo.mp4)

* **Acreditación de autoría:** La escena cuenta con un encabezado fijo en el DOM superior visible durante toda la ejecución.

## 6. Fuentes y recursos utilizados

1. **Texturas:** [Solar System Scope](https://www.solarsystemscope.com/textures/) (2K) y recursos de la ULPGC (1K Tierra).

2. **APIs Externas:** [NASA Open APIs (APOD)](https://api.nasa.gov/).

3. **Documentación:** [Three.js Docs](https://threejs.org/docs/) y Guiones S6/S7 (Prof. Modesto Castrillón Santana).

## 7. Declaración sobre el uso de herramientas de Inteligencia Artificial

En cumplimiento con las directrices docentes:

* **Herramientas empleadas:** Asistentes de IA generativa (Gemini).

* **Alcance del soporte recibido:** Asistencia en la depuración de errores, búsqueda de recursos y ayuda en la redacción de la documentación técnica.
* **Enlaces a conversaciones:**

  * [Enlace a la conversación de desarrollo y depuración con Gemini](https://share.gemini.google/LDOkguPr30H5)

* **Supervisión:** Todo el código y la documentación fueron integrados y revisados meticulosamente por la autora.