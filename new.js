main();

function main(){

    const canvas = document.querySelector("#glCanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Initialize the GL context
    const gl = canvas.getContext("webgl");

    // Only continue if WebGL is available and working
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTextureCoord;

    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

    const fsSource = `
precision mediump float;
   varying highp vec2 vTextureCoord;

    uniform sampler2D uSampler;

uniform vec2 resolution; 
uniform int time;


const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.0001;

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
 mat3 rotate = mat3(
1.0, 0.0, 0.0,
0.0, cos(float(time)  * (2.0 * 3.14)), -sin(float(time) * (2.0 * 3.14)),
0.0, sin(float(time)  * (2.0 * 3.14)), cos(float(time)  * (2.0 * 3.14))
);
return min (
max (sdfTorus((samplePoint + vec3(0.0, -0.25, 0.0))* rotate , vec2(0.3 + (0.3 * (1.0+ sin(float(time)/200.0))), 0.1)), -cubeSDF(samplePoint -  vec3(0.0,- 0.50, -1.0))),
sdfPlane(samplePoint * vec3(0.0, float(time), float(time))));
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
vec3 eye = vec3(0.0, 0.5, 5.0);
float dist = shortestDistanceToSurface(eye, dir, MIN_DIST, MAX_DIST);
if (dist > MAX_DIST - EPSILON){
    gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
return;
}

vec3 p = eye + dist * dir;
vec3 K_a = vec3((sin(dist) + 1.0)/2.0, 0.2, (cos(dist) + 1.0)/2.0);

vec3 K_d = texture2D(uSampler, vTextureCoord).xyz;
vec3 K_s = vec3(1.0, 1.0, 1.0);
float shininess = 2.0;

vec3 color = phongIllumination(K_a, K_d, K_s, shininess, p, eye);
gl_FragColor = vec4(color, 1.0) ;
    }
  `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            resolution: gl.getUniformLocation(shaderProgram, 'resolution'),
            time: gl.getUniformLocation(shaderProgram, 'time'),
        },
    };

    const buffers =  initBuffers(gl);
    var texture = loadTexture(gl, "jeeza.jpg");
    var copyVideo = false;
    var video = setupVideo("vid.mp4", copyVideo);
    console.log(texture);

    var then = 0.0;
    var d = new Date;
    var time = 0;

    function render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - then;
        then = now;
        d = new Date;

        if (true){
            updateTexture(gl, texture, video);
        }

        drawScene(gl, programInfo, buffers, texture, d);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initBuffers(gl) {

    // Create a buffer for the square's positions.

    const positionBuffer = gl.createBuffer();

    // Select the positionBuffer as the one to apply buffer
    // operations to from here out.

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Now create an array of positions for the square.

    const positions = [
        -1.0, -1.0,  1.0,
        1.0, -1.0,  1.0,
        1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array(positions),
                  gl.STATIC_DRAW);

    const textureCoordBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    
    // Create its tex coords too.
    const texs = [
        0.0,  0.0,
        1.0,  1.0,
        0.0,  1.0,
        1.0,  0.0,
    ];

    gl.bufferData(gl.ARRAY_BUFFER,
                  new Float32Array(texs),
                  gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();

    const indices = [
        3,  2,  0, 2,  1,  0,];

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                  new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        textureCoord: textureCoordBuffer,
        indices: indexBuffer,
    };
}

function drawScene(gl, programInfo, buffers, texture, date) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
    // and 100 units away from the camera.
 

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix,
                   fieldOfView,
                   1.0,
                   zNear,
                   zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(modelViewMatrix,     // destination matrix
                 modelViewMatrix,     // matrix to translate
                 [-0.0, 0.0, -3.42]);  // amount to translate

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  {
    const numComponents = 3;  // pull out 2 values per iteration
    const type = gl.FLOAT;    // the data in the buffer is 32bit floats
    const normalize = false;  // don't normalize
    const stride = 0;         // how many bytes to get from one set of values to the next
                              // 0 = use type and numComponents above
    const offset = 0;         // how many bytes inside the buffer to start from
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
      
  }
    {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.textureCoord);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);

    
    gl.uniform2fv(programInfo.uniformLocations.resolution, [window.innerWidth, window.innerHeight]);
    gl.uniform1i(programInfo.uniformLocations.time, date.getMilliseconds());
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);

    // Bind the texture to texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Tell the shader we bound the texture to texture unit 0
    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  {
      const vertexCount = 6;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}
