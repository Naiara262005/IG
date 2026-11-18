// Mar nocturno digital - versión legible (equivale a la versión tiny de 510 bytes)
// Base: ejemplos de The Book of Shaders (rejilla con fract/floor, random, smoothstep)
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

// Número pseudoaleatorio entre 0 y 1 a partir de una posición
float random(vec2 s) {
  return fract(sin(dot(s, vec2(12.9, 78.2))) * 43758.5);
}

void main() {
  float t = u_time;

  // Coordenadas de -1 a 1 con el centro en (0,0), corregidas por la proporción de la ventana
  vec2 st = gl_FragCoord.xy / u_resolution * 2. - 1.;
  st.x *= u_resolution.x / u_resolution.y;

  // Rejilla de celdas, deformada con senos para que ondule como el agua
  vec2 p = st * 7.336;
  p += .3 * vec2(sin(p.y * .8 + t), cos(p.x * .8 + t));
  vec2 id = floor(p); // identificador de cada celda

  // Punto circular suave en el centro de cada celda
  float punto = 1. - smoothstep(.1, .3, length(fract(p) - .5));

  // Ola diagonal que avanza con el tiempo, con un desfase aleatorio por celda
  float onda = .5 + .5 * sin(st.x * 3. + st.y * 2. - t * 2. + random(id) * 2.);

  // Destello: cada celda tiene su propio ciclo y solo brilla un instante (pow muy alto)
  float chispa = pow(.5 + .5 * sin(t * 2. + random(id + 7.) * 40.), 30.);

  // Colores: azul oscuro, azul verdoso y blanco azulado para el destello
  vec3 oscuro = vec3(0., .12, .48);
  vec3 claro = vec3(0., .44, .44);
  vec3 brillo = vec3(.6, .9, 1.);

  vec3 color = mix(oscuro, claro, punto * onda);
  color += brillo * chispa * punto;

  gl_FragColor = vec4(color, 1.);
}
