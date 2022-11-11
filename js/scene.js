// ----------------------------------------------------------
// Created by Matthew Wilson
// Created for UBC CPSC 314, September 2022, Assignment 1 
// ----------------------------------------------------------

// ----------------------SCENE SETUP-------------------------

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
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
const verticesPerBlock = 36;
const numDimensions = 3;
const itemSizePerBlock = verticesPerBlock * numDimensions;

// terrain info
const noise = new perlinNoise3d();
const chunkSize = 5; // in blocks
// don't set these values too large or performance will drop greatly 
const numberChunksXZ = 5;
const numberChunksY = 2;
const worldReferencePos = new THREE.Vector3(-10,0,-10);

// PROCEDURAL GENERATION PROPERTIES
// -- play with these values to switch up the terrain that is generated
// -- lower the scale can help improve performance
const scale = 8;
const smoothness = 8;
// --------------------

const chunkPool = [];
var chunkReferencePos = new THREE.Vector3(0,0,0);

// Generate the chunks
for(let i = 0; i < numberChunksXZ; i++) {
  for(let j = 0; j < numberChunksY; j++) {
    for(let k = 0; k < numberChunksXZ; k++) {
      var chunk = generateChunk(i * chunkSize,j * chunkSize, k * chunkSize);
      scene.add(chunk);
      chunkPool.push(chunk);
    }
  }
}

// Generate a chunk
function generateChunk(x,y,z) {
    var geometry = new THREE.BufferGeometry();
    var mesh = new THREE.Mesh(geometry, blockMaterial);
    mesh.position.set(x + worldReferencePos.x, y + worldReferencePos.y, z + worldReferencePos.z); 
    buildChunkMesh(mesh);
    return mesh;
  }

// Create the mesh for a chunk
function buildChunkMesh(mesh) {
    const numBlocks = chunkSize * chunkSize * chunkSize;
    const maxItemSize =  numBlocks * itemSizePerBlock;
    const vertices = new Float32Array(maxItemSize);
    const normals = new Float32Array(maxItemSize);
    const colors = new Float32Array(maxItemSize);
    
    var x = chunkReferencePos.x + mesh.position.x;
    var y = chunkReferencePos.y + mesh.position.y;
    var z = chunkReferencePos.z + mesh.position.z;
    
    var itemCount = 0;
    // Use perlin noise to determine where to place blocks
    for(let i = 0; i < chunkSize; i++) {
      for(let k = 0; k < chunkSize; k++) {
        var height = getNoise(x + i,0, z + k, smoothness / 4.0, scale / 4.0);
        height += getNoise(x + i,0, z + k, smoothness / 2.0, scale / 2.0);
        height += getNoise(x + i,0, z + k, smoothness, scale);
        for(let j = 0; j < chunkSize; j++) {
          if(y + j <= height) { 
            generateBlock(i,j,k, vertices, normals, colors, itemCount);
            itemCount += itemSizePerBlock;
          }
        }
      }
    }
    mesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('normal', new THREE.BufferAttribute(normals.subarray(0, itemCount), numDimensions));
    mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, itemCount), numDimensions));
  }

  // 3D Perlin Noise value
  // smooth - controls variability of output (higher -> smoother terrain)
  // scale - controls size of output (higher -> larger scale terrain)
  function getNoise(x, y, z, smooth = 1, scale = 1) {
    return noise.get(x / smooth, y / smooth, z / smooth) * scale;
  }

// Add block to mesh
// TODO: optimize by only generating visible faces
function generateBlock(x, y, z, meshVertices, meshNormals, meshColors, itemCount) {
    // v0 = x,y,z
    // v1 = x+1,y,z
    // v2 = x,y,z+1
    // v3 = x+1,y,z+1
    // v4 = x,y+1,z
    // v5 = x+1,y+1,z
    // v6 = x,y+1,z+1
    // v7 = x+1,y+1,z+1

    // Bottom Face 
    // 0,1,2
    // 1,3,2

    // Top Face
    // 6,5,4
    // 6,7,5

    // Left Face
    // 0,2,6
    // 6,4,0

    // Right Face
    // 1,5,7
    // 7,3,1

    // Front Face
    // 2,3,7
    // 7,6,2

    // Back Face
    // 0,4,5
    // 5,1,0

    const vertices = new Float32Array([
        // Bottom Face
        x,y,z,
        x+1,y,z,
        x,y,z+1,

        x+1,y,z,
        x+1,y,z+1,
        x,y,z+1,

        // Top Face
        x,y+1,z+1,
        x+1,y+1,z,
        x,y+1,z,

        x,y+1,z+1,
        x+1,y+1,z+1,
        x+1,y+1,z,

        // Left Face
        x,y,z,
        x,y,z+1,
        x,y+1,z+1,

        x,y+1,z+1,
        x,y+1,z,
        x,y,z,

        // Right Face
        x+1,y,z,
        x+1,y+1,z,
        x+1,y+1,z+1,

        x+1,y+1,z+1,
        x+1,y,z+1,
        x+1,y,z,

        // Front Face
        x,y,z+1,
        x+1,y,z+1,
        x+1,y+1,z+1,

        x+1,y+1,z+1,
        x,y+1,z+1,
        x,y,z+1,

        // Back Face
        x,y,z,
        x,y+1,z,
        x+1,y+1,z,

        x+1,y+1,z,
        x+1,y,z,
        x,y,z
    ]);

    const normals = new Float32Array([
        // Bottom Face
        0,-1,0,
        0,-1,0,
        0,-1,0,

        0,-1,0,
        0,-1,0,
        0,-1,0,

        // Top Face
        0,1,0,
        0,1,0,
        0,1,0,

        0,1,0,
        0,1,0,
        0,1,0,

        // Left Face
        -1,0,0,
        -1,0,0,
        -1,0,0,

        -1,0,0,
        -1,0,0,
        -1,0,0,

        // Right Face
        1,0,0,
        1,0,0,
        1,0,0,

        1,0,0,
        1,0,0,
        1,0,0,

        // Front Face
        0,0,1,
        0,0,1,
        0,0,1,

        0,0,1,
        0,0,1,
        0,0,1,

        // Back Face
        0,0,-1,
        0,0,-1,
        0,0,-1,

        0,0,-1,
        0,0,-1,
        0,0,-1
    ]);

    for(var i = itemCount; i < itemCount + itemSizePerBlock; i++) {
        meshColors.set([Math.random()],i);
    }
    
    meshVertices.set(vertices, itemCount);
    meshNormals.set(normals, itemCount);
  }

  // if chunk is too far from player, move the chunk closer and regen
  function chunkloader() {
    chunkPool.forEach(chunk => {
    const threshold = (chunkSize * numberChunksXZ) / 2.0;
    const vertThreshold = (chunkSize * numberChunksY) * 4;
    
    if(camera.position.x - chunk.position.x > threshold) {
        chunk.position.set(chunk.position.x + chunkSize * numberChunksXZ, chunk.position.y, chunk.position.z);
        chunkReferencePos.x++;
        buildChunkMesh(chunk);
    } else if(camera.position.x - chunk.position.x < -threshold) {
        chunk.position.set(chunk.position.x - chunkSize * numberChunksXZ, chunk.position.y, chunk.position.z);
        chunkReferencePos.x--;
        buildChunkMesh(chunk);
    }

    if(camera.position.z - chunk.position.z > threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z + chunkSize * numberChunksXZ);
        chunkReferencePos.z++;
        buildChunkMesh(chunk);
    } else if(camera.position.z - chunk.position.z < -threshold) {
        chunk.position.set(chunk.position.x, chunk.position.y, chunk.position.z - chunkSize * numberChunksXZ);
        chunkReferencePos.z--;
        buildChunkMesh(chunk);
    }

    // if(camera.position.y - (chunk.position.y + chunkSize / 2.0) > vertThreshold) {
    //   chunk.position.set(chunk.position.x, chunk.position.y + chunkSize * numberChunksY, chunk.position.z);
    //   chunkReferencePos.y++;
    //   buildChunkMesh(chunk);
    // } else if(camera.position.y - (chunk.position.y + chunkSize / 2.0) < -vertThreshold) {
    //   chunk.position.set(chunk.position.x, chunk.position.y - chunkSize * numberChunksY, chunk.position.z);
    //   chunkReferencePos.y--;
    //   buildChunkMesh(chunk);
    // }
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
    const speed = 5;
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
