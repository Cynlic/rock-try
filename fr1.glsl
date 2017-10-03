precision mediump float;
varying highp vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D uSampler2;

uniform vec2 resolution;
uniform int time;


const int MAX_MARCHING_STEPS = 200;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.0001;
const float RATE = 20.0;

mat3 rotate = mat3(
                   1.0, 0.0, 0.0,
                   0.0, cos(float(time)*RATE * (2.0 * 3.14)), -sin(float(time)*RATE * (2.0 * 3.14)),
                   0.0, sin(float(time)*RATE * (2.0 * 3.14)), cos(float(time)*RATE  * (2.0 * 3.14))
                   );

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float sphereSDF(vec3 samplePoint) {
    return length(samplePoint) - 1.0;
}

float cubeSDF(vec3 p){
  vec3 d = abs(p)-vec3(1.0, 1.0, 1.0);

  float insideDistance = min(max(d.x, max(d.y, d.z)), 0.0);
  float outsideDistance = length(max(d, 0.0));

  return insideDistance + outsideDistance;
}

float sdfTorus(vec3 p, vec2 t){
  return length( vec2 (length (p.xz)-t.x, p.y)) - t.y;
}
/*
float  displace(vec3 v){
  return (sin(1.0*v.x)*sin(2.0*v.y)*sin(3.0*v.z));
}

float displaceT(vec3 p, vec2 t){
  float d1 = sdfTorus(p, t);
  float d2 = displace(p);
  return  d2*3.0*sin(float(time)/20.0) + d1*3.0*abs(cos(float(time)/20.0));
  }*/

vec3 displace(vec3 v){
  return vec3(sin(sin(float(time)/1000.0)*10.0*v.x), sin( cos(float(time)/1000.0)*10.0*v.y), sin(tan (float(time)/1000.0)*10.0*v.z));
}

float displaceT(vec3 p, vec2 t){
  float d1 = sdfTorus(p, t);
  float d2 = sdfTorus(displace(p), t);
  return  d1 - d2;
}
float sdfPlane(vec3 p){
  return p.y;
}

float sceneSDF1(vec3 samplePoint){
  return max (sphereSDF(samplePoint/1.2) *1.2, 1.0 * cubeSDF(samplePoint)*1.2);
}

float sceneSDF2(vec3 samplePoint){
 return sphereSDF(samplePoint/1.2);
}

float sceneSDF(vec3 samplePoint){
  return min(
             displaceT((samplePoint + vec3(0.0, 2.0 * cos(float(time)/RATE), (-4.0+ 4.0* sin(float(time)/RATE)))) * rotate, vec2(0.3, 0.1)),
                  //sdfTorus((samplePoint + vec3(0.0, -0.25, 0.0))* rotate ,  vec2(0.3 ,0.1)),
             max(sdfPlane(samplePoint *  vec3(0.0, float(time), 0.0)), -sphereSDF(samplePoint*vec3(0.0, cos(float(time))*10.0+40.0, 0.0)))
             );

  
//sdfPlane(samplePoint * vec3(0.0, float(time)/100.0, float(time)/100.0)));
  //return sdfTorus(samplePoint*rotate, vec2(0.3, 0.1));
}

float shortestDistanceToSurface(vec3 eye, vec3 marchingDirection, float start, float end){
  float depth = start;
  for (int i = 0; i < MAX_MARCHING_STEPS; i++){
    float dist = sceneSDF(eye+depth * marchingDirection);
    if (dist < EPSILON){
      return depth;
    }
    depth += dist;
    if (depth >= end){
      return end;
    }
  }
  return end;
}

vec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord){
  vec2 xy = fragCoord - size / 2.0;
  float z = size.y / tan(radians(fieldOfView)/ 2.0);
  return normalize(vec3(xy, -z));
}

vec3 estimateNormal(vec3 p) {
    return normalize(vec3(
        sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z  + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
    ));
}

vec3 phongContribForLight(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye,
                          vec3 lightPos, vec3 lightIntensity) {
    vec3 N = estimateNormal(p);
    vec3 L = normalize(lightPos - p);
    vec3 V = normalize(eye - p);
    vec3 R = normalize(reflect(-L, N));

    float dotLN = dot(L, N);
    float dotRV = dot(R, V);
    if (dotLN < 0.0) {
        // Light not visible from this point on the surface
        return vec3(0.0, 0.0, 0.0);
    }
    if (dotRV < 0.0) {
        // Light reflection in opposite direction as viewer, apply only diffuse
        // component
        return lightIntensity * (k_d * dotLN);
    }
    return lightIntensity * (k_d * dotLN + k_s * pow(dotRV, alpha));
}


vec3 phongIllumination(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye) {
    const vec3 ambientLight = 0.5 * vec3(1.0, 1.0, 1.0);
    vec3 color = ambientLight * k_a;
    vec3 light1Pos = vec3(4.0 * sin(float(time)/200.0),
                          2.0,
                          4.0 * cos(float(time)/200.0));
    vec3 light1Intensity = vec3(0.4, 0.4, 0.4);
    color += phongContribForLight(k_d, k_s, alpha, p, eye,
                                  light1Pos,
                                  light1Intensity);
    return color;
}

void main() {
  vec3 dir = rayDirection(45.0, resolution, gl_FragCoord.xy);
  vec3 eye = vec3(0.0, 1.0, 15.0);
  float dist = shortestDistanceToSurface(eye, dir, MIN_DIST, MAX_DIST);
  vec3 sky = texture2D(uSampler2, vTextureCoord).xyz;
  vec3 dSky = displace(sky);

  //vec2 r = reflect(vec4(vTextureCoord, 0.0, 1.0), vec4(1.0,0.0, 0.0, 1.0)).xy;
  //vec3 rSky = texture2D(uSampler2, r).xyz;
  vec3 water = texture2D(uSampler, vTextureCoord).xyz;
  vec3 dwater = displace(water) ;
  if (dist > MAX_DIST - EPSILON){
    gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0)+ vec4((sky+ dSky) +
                                                  0.2 *
                                                  vec3(rand(vec2(float(time), 1.0)), cos(gl_FragCoord.x*float(time)/2000.0)
                                                       *sin(gl_FragCoord.y*float(time)/2000.0), rand(vec2(float(time), 1.0)) ),
                                                  1.0);
    return;
}

  vec3 p = eye + dist * dir;
  vec3 K_a = vec3(0.0, 1.0, (dist)/9.0);
  vec3 K_d = water + dwater;
  vec3 K_s = vec3(1.0, 1.0, 1.0);
  float shininess = 2.0;

  vec3 color = phongIllumination(K_a, K_d, K_s, shininess, p, eye);
  gl_FragColor = vec4(color, 1.0);
}
