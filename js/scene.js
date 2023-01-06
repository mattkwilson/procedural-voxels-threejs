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
const camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);

const ambientLight = new THREE.AmbientLight(0x4a4a4a);
scene.add(ambientLight);
const light = new THREE.PointLight(0xffffff);
scene.add(light);

// --------------------------GUI-----------------------------
const gui = new lil.GUI();

// PROCEDURAL GENERATION PROPERTIES
// -- play with these values to switch up the terrain that is generated
// -- lowering the scale can help improve performance
const terrainData = { 
  playerSpeed: 10,
  chunkSize: 10,
  mapSize: 15,
  scale: 50.0,
  smoothness: 50.0,
  seed: Math.random() * 1000000
};
// --------------------
gui.add(terrainData, 'playerSpeed', 0, 30);
gui.add(terrainData, 'chunkSize', 0, 20, 2);
gui.add(terrainData, 'mapSize', 0, 50);
gui.add(terrainData, 'scale', 0, 100);
gui.add(terrainData, 'smoothness', 0, 100);
gui.add(terrainData, 'seed');

gui.onFinishChange((event) => {
  if (event.property != 'playerSpeed') {
    ReGenerateTerrain();
  }
});


function ReGenerateTerrain() {
  clearChunks();
  generateChunks(0,0);
}

camera.position.set(0,terrainData.scale,0);
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

var chunkPool = [];

generateChunks(0, 0);

// Generate the chunks
function generateChunks(x, z) {
  for(let i = 0; i < terrainData.mapSize; i++) {
      for(let k = 0; k < terrainData.mapSize; k++) {
        var chunk = generateChunk(x + i * terrainData.chunkSize, z + k * terrainData.chunkSize);
        scene.add(chunk);
        chunkPool.push(chunk);
      }
  }
}

function clearChunks() {
  chunkPool.forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
  });
  chunkPool = [];
}

// Generate a chunk
function generateChunk(x,z) {
    var geometry = new THREE.BufferGeometry();
    var mesh = new THREE.Mesh(geometry, blockMaterial);
    mesh.position.set(x, 0, z); 
    buildChunkMesh(mesh);
    return mesh;
  }

// Create the mesh for a chunk
function buildChunkMesh(mesh) {
    const numUnits = terrainData.chunkSize * terrainData.chunkSize;
    const maxItemSize =  numUnits * itemSizePerUnit;
    const meshVertices = new Float32Array(maxItemSize);
    const normals = new Float32Array(maxItemSize);
    const colors = new Float32Array(maxItemSize);
    
    var x = mesh.position.x;
    var z = mesh.position.z;
    
    const vertices = []; // [numUnits + terrainData.chunkSize * 2 + 1]
    // Use perlin noise to generate vertex positions
    for(let i = 0; i <= terrainData.chunkSize; i++) {
      for(let k = 0; k <= terrainData.chunkSize; k++) {
        vertices.push(new THREE.Vector3(i, getTerrainHeight(x + i, z + k), k));
      }
    }

    // Build the faces for each unit
    var itemCount = 0;
    for(let i = 0; i < terrainData.chunkSize; i++) {
        for(let k = 0; k < terrainData.chunkSize; k++) {
            const index = i*(terrainData.chunkSize + 1) + k;
            const v0 = vertices[index];
            const v1 = vertices[index + 1];
            const v2 = vertices[index + terrainData.chunkSize + 1];
            const v3 = vertices[index + terrainData.chunkSize + 2];
            generateUnit(v0, v1, v2, v3, mesh.position, meshVertices, normals, colors, itemCount);
            itemCount += itemSizePerUnit;
        }
      }

    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(meshVertices.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, itemCount), numDimensions));
  }

  function getTerrainHeight(x, z) {
    var height = getNoise(x, 0, z, terrainData.smoothness, terrainData.scale, terrainData.seed); 
    return height;
  }

  // 3D Perlin Noise value
  // smooth - controls variability of output (higher -> smoother terrain)
  // scale - controls size of output (higher -> larger scale terrain)
  function getNoise(x, y, z, smooth = 1, scale = 1, seed = 0) {
    return noise.get((x + seed) / smooth, (y + seed) / smooth, (z + seed) / smooth) * scale;
  }

// Add unit made up of two faces to mesh
function generateUnit(v0, v1, v2, v3, meshPosition, meshVertices, meshNormals, meshColors, itemCount) {

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

    const colorV0 = calculateColor(v0, meshPosition);
    const colorV1 = calculateColor(v1, meshPosition);
    const colorV2 = calculateColor(v2, meshPosition);
    const colorV3 = calculateColor(v3, meshPosition);

    const colors = new Float32Array([
      colorV0.r, colorV0.g, colorV0.b,
      colorV1.r, colorV1.g, colorV1.b,
      colorV2.r, colorV2.g, colorV2.b,

      colorV1.r, colorV1.g, colorV1.b,
      colorV3.r, colorV3.g, colorV3.b,
      colorV2.r, colorV2.g, colorV2.b
    ]);
    
    meshVertices.set(vertices, itemCount);
    meshNormals.set(normals, itemCount);
    meshColors.set(colors, itemCount);
  }

  function calculateColor(v, meshPosition) {
    const noise = getTerrainHeight(meshPosition.x + v.x, meshPosition.z + v.z);
    const normalizedWeight = noise / terrainData.scale;

    const mountainColor = new THREE.Color(0.6, 0.15, 0.45);
    const groundColor = new THREE.Color(0.45, 0.6, 0.15);
    
    return groundColor.lerp(mountainColor, normalizedWeight);
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
    const threshold = (terrainData.chunkSize * terrainData.mapSize) / 2.0;
    
    if(camera.position.x - chunk.position.x > threshold) {
        chunk.position.set(chunk.position.x + terrainData.chunkSize * terrainData.mapSize, chunk.position.y, chunk.position.z);
        buildChunkMesh(chunk);
    } else if(camera.position.x - chunk.position.x < -threshold) {
        chunk.position.set(chunk.position.x - terrainData.chunkSize * terrainData.mapSize, chunk.position.y, chunk.position.z);
        buildChunkMesh(chunk);
    }

    if(camera.position.z - chunk.position.z > threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z + terrainData.chunkSize * terrainData.mapSize);
        buildChunkMesh(chunk);
    } else if(camera.position.z - chunk.position.z < -threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z - terrainData.chunkSize * terrainData.mapSize);
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
document.addEventListener('click', (event) => {
    // don't lock if user clicks the GUI
    if (event.target.getAttribute('data-engine') == 'three.js r148') {
      controls.lock();
    } 
});
  
var clock = new THREE.Clock();

function inputHandler() {
    const speed = terrainData.playerSpeed;
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
