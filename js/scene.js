// ----------------------------------------------------------
// Created by Matthew Wilson
// Created for UBC CPSC 314, September 2022, Assignment 1 
// Updated 2023-01-05 with triangular terrain
// ----------------------------------------------------------

// ----------------------SCENE SETUP-------------------------

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xb3e6e4);
document.body.appendChild(renderer.domElement);

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(80, aspect, 0.1, 100);
camera.position.set(0,12,0);

const ambientLight = new THREE.AmbientLight(0x4a4a4a);
scene.add(ambientLight);
const light = new THREE.PointLight(0xffffff);
scene.add(light);

// -----------------------MATERIALS--------------------------

const blockMaterial = new THREE.MeshLambertMaterial({vertexColors:true});

// --------------PROCEDURAL VOXEL GENERATION-----------------
// mesh info
const facesPerUnit = 2;
const verticesPerFace = 3;
const numDimensions = 3;
const itemSizePerUnit = facesPerUnit * verticesPerFace * numDimensions;

// terrain info
const noise = new perlinNoise3d();
const chunkSize = 10; // in square units
// don't set these values too large or performance will drop greatly 
const numberChunksXZ = 10;
const worldReferencePos = new THREE.Vector3(-10,0,-10);

// PROCEDURAL GENERATION PROPERTIES
// -- play with these values to switch up the terrain that is generated
// -- lower the scale can help improve performance
const scale = 8;
const smoothness = 8;
// --------------------

const chunkPool = [];

// Generate the chunks
for(let i = 0; i < numberChunksXZ; i++) {
    for(let k = 0; k < numberChunksXZ; k++) {
      var chunk = generateChunk(i * chunkSize, k * chunkSize);
      scene.add(chunk);
      chunkPool.push(chunk);
    }
}

// Generate a chunk
function generateChunk(x,z) {
    var geometry = new THREE.BufferGeometry();
    var mesh = new THREE.Mesh(geometry, blockMaterial);
    mesh.position.set(x + worldReferencePos.x, 0, z + worldReferencePos.z); 
    buildChunkMesh(mesh);
    return mesh;
  }

// Create the mesh for a chunk
function buildChunkMesh(mesh) {
    const numUnits = chunkSize * chunkSize;
    const maxItemSize =  numUnits * itemSizePerUnit;
    const meshVertices = new Float32Array(maxItemSize);
    const normals = new Float32Array(maxItemSize);
    const colors = new Float32Array(maxItemSize);
    
    var x = mesh.position.x;
    var z = mesh.position.z;
    
    const vertices = []; // [numUnits + chunkSize * 2 + 1]
    // Use perlin noise to generate vertex positions
    for(let i = 0; i <= chunkSize; i++) {
      for(let k = 0; k <= chunkSize; k++) {
        // var height = getNoise(x + i,0, z + k, smoothness / 4.0, scale / 4.0);
        // height += getNoise(x + i,0, z + k, smoothness / 2.0, scale / 2.0);
        // height += getNoise(x + i,0, z + k, smoothness, scale);
        var height = getNoise(x + i,0, z + k, 10, 10);
        vertices.push(new THREE.Vector3(i, height, k));
      }
    }

    // Build the faces for each unit
    var itemCount = 0;
    for(let i = 0; i < chunkSize; i++) {
        for(let k = 0; k < chunkSize; k++) {
            const index = i*(chunkSize + 1) + k;
            const v0 = vertices[index];
            const v1 = vertices[index + 1];
            const v2 = vertices[index + chunkSize + 1];
            const v3 = vertices[index + chunkSize + 2];
            generateUnit(v0, v1, v2, v3, meshVertices, normals, colors, itemCount);
            itemCount += itemSizePerUnit;
        }
      }

    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(meshVertices.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, itemCount), numDimensions));
  }

  // 3D Perlin Noise value
  // smooth - controls variability of output (higher -> smoother terrain)
  // scale - controls size of output (higher -> larger scale terrain)
  function getNoise(x, y, z, smooth = 1, scale = 1) {
    return noise.get(x / smooth, y / smooth, z / smooth) * scale;
  }

// Add unit made up of two faces to mesh
function generateUnit(v0, v1, v2, v3, meshVertices, meshNormals, meshColors, itemCount) {

    const vertices = new Float32Array([
      v0.x, v0.y, v0.z,
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,

      v1.x, v1.y, v1.z,
      v3.x, v3.y, v3.z,
      v2.x, v2.y, v2.z
    ]);

    const n1 = calculateNormal(v0,v1,v2);
    const n2 = calculateNormal(v1,v3,v2);

    const normals = new Float32Array([
      n1.x, n1.y, n1.z,
      n1.x, n1.y, n1.z,
      n1.x, n1.y, n1.z,

      n2.x, n2.y, n2.z,
      n2.x, n2.y, n2.z,
      n2.x, n2.y, n2.z
    ]);

    for(var i = itemCount; i < itemCount + itemSizePerUnit; i += 3) {
        meshColors.set([0.45],i);
        meshColors.set([0.6],i + 1);
        meshColors.set([0.15],i + 2);
    }
    
    meshVertices.set(vertices, itemCount);
    meshNormals.set(normals, itemCount);
  }

  function calculateNormal(v0, v1, v2) {
    return vectorCrossProduct(subtractVectors(v1, v0), subtractVectors(v2, v0));
  }

  function subtractVectors(v0, v1) {
    return new THREE.Vector3(v0.x - v1.x, v0.y - v1.y, v0.z - v1.z);
  }

  function vectorCrossProduct(v0, v1) {
    return new THREE.Vector3(v0.y * v1.z - v1.y * v0.z, v1.x * v0.z - v0.x * v1.z, v0.x * v1.y - v1.x * v0.y);
  }

  // if chunk is too far from player, move the chunk closer and regen
  function chunkloader() {
    chunkPool.forEach(chunk => {
    const threshold = (chunkSize * numberChunksXZ) / 2.0;
    
    if(camera.position.x - chunk.position.x > threshold) {
        chunk.position.set(chunk.position.x + chunkSize * numberChunksXZ, chunk.position.y, chunk.position.z);
        buildChunkMesh(chunk);
    } else if(camera.position.x - chunk.position.x < -threshold) {
        chunk.position.set(chunk.position.x - chunkSize * numberChunksXZ, chunk.position.y, chunk.position.z);
        buildChunkMesh(chunk);
    }

    if(camera.position.z - chunk.position.z > threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z + chunkSize * numberChunksXZ);
        buildChunkMesh(chunk);
    } else if(camera.position.z - chunk.position.z < -threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z - chunkSize * numberChunksXZ);
        buildChunkMesh(chunk);
    }
    });
  }

// ------------------------CONTROLS--------------------------

document.addEventListener('keydown', keydown);
document.addEventListener('keyup', keyup);
const pressedKeys = new Set();

function keydown(event) {
    pressedKeys.add(event.keyCode);
}

function keyup(event) {
    pressedKeys.delete(event.keyCode);
}

const controls = new THREE.PointerLockControls(camera, document.body);

// lock cursor to window
document.addEventListener('click', () => {
    controls.lock();
});
  
var clock = new THREE.Clock();

function inputHandler() {
    const speed = 10;
    var delta = clock.getDelta();

    // handle flying WASD/EQ
    if (pressedKeys.has(68)) { // D
        camera.translateX(speed * delta);
    } else if (pressedKeys.has(65)) // A
        camera.translateX(-speed * delta);
    if (pressedKeys.has(87)) // W
        camera.translateZ(-speed * delta);
    else if (pressedKeys.has(83)) // S
        camera.translateZ(speed * delta);
    if (pressedKeys.has(69)) // E
        camera.translateY(speed * delta);
    else if (pressedKeys.has(81)) // Q
        camera.translateY(-speed * delta);
}

// -------------------------UPDATE---------------------------

window.addEventListener('resize', resize);
function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function update() {
    light.position.set(camera.position.x, camera.position.y, camera.position.z);

    inputHandler();
    chunkloader();
    requestAnimationFrame(update);
    renderer.render(scene, camera);
}

update();
