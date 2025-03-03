
let scene, camera, renderer, controls;
let mazeSize = 15;
let player;
let exit;
let currentPosition = { x: 0, z: 0 };
let rendererContainer = null;
let maze; // Store maze data for collision detection

// Réduire la hauteur des murs de 4 à 1.5
const WALL_HEIGHT = 0.5;
const WALL_COLOR = 0x607D8B;
const FLOOR_COLOR = 0xCFD8DC;
const PLAYER_COLOR = 0xFF5722;
const EXIT_COLOR = 0x4CAF50;


function initGame() {
    // Clean up previous renderer if it exists
    if (rendererContainer) {
        document.body.removeChild(rendererContainer);
    }

    // Reset position
    currentPosition = { x: 0, z: 0 };

    // Setup Three.js
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererContainer = renderer.domElement;
    document.body.appendChild(rendererContainer);

    mazeSize = parseInt(document.getElementById('size').value);
    const complexity = parseFloat(document.getElementById('difficulty').value);

    // Lumière
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Contrôles caméra
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;

    // Génération du labyrinthe
    generateMaze3D(mazeSize, complexity);
    setupCamera();
    animate();
}

function generateMaze3D(size, complexity) {
    // Création du sol
    const floor = new THREE.Mesh(
        new THREE.BoxGeometry(size * 2, 0.2, size * 2),
        new THREE.MeshPhongMaterial({ color: FLOOR_COLOR })
    );
    floor.position.set(size / 2 - 0.5, -0.1, size / 2 - 0.5);
    scene.add(floor);

    // Génération du labyrinthe
    maze = generateMazeData(size, complexity);

    // Création des murs
    const wallGeometry = new THREE.BoxGeometry(1.9, WALL_HEIGHT, 0.2);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: WALL_COLOR,
        metalness: 0.3,
        roughness: 0.8
    });

    // Outer walls (top and left)
    for (let x = 0; x < size; x++) {
        const topWall = new THREE.Mesh(wallGeometry, wallMaterial);
        topWall.position.set(x, WALL_HEIGHT / 2, -0.1);
        scene.add(topWall);
    }

    for (let y = 0; y < size; y++) {
        const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        leftWall.position.set(-0.1, WALL_HEIGHT / 2, y);
        leftWall.rotation.y = Math.PI / 2;
        scene.add(leftWall);
    }

    // Inner walls
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (maze[y][x].walls.right) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x + 1, WALL_HEIGHT / 2, y);
                wall.rotation.y = Math.PI / 2;
                scene.add(wall);
            }
            if (maze[y][x].walls.bottom) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x, WALL_HEIGHT / 2, y + 1);
                scene.add(wall);
            }
        }
    }

    // Création du joueur
    const playerGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const playerMaterial = new THREE.MeshPhongMaterial({
        color: PLAYER_COLOR,
        emissive: 0xFF5722,
        emissiveIntensity: 0.2
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0.5, 0.5, 0.5);
    scene.add(player);

    // Création de la sortie
    const exitGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.8);
    const exitMaterial = new THREE.MeshStandardMaterial({
        color: EXIT_COLOR,
        emissive: 0x4CAF50,
        emissiveIntensity: 0.5
    });
    exit = new THREE.Mesh(exitGeometry, exitMaterial);
    exit.position.set(size - 0.5, 0.05, size - 0.5);
    scene.add(exit);
}

function generateMazeData(size, complexity) {
    // Initialiser la grille avec tous les murs
    const grid = Array(size).fill().map(() => Array(size).fill().map(() => ({
        walls: { right: true, bottom: true },
        set: null  // Pour l'algorithme de Kruskal, remplace 'visited'
    })));

    // Initialiser les ensembles disjoints (chaque cellule dans son propre ensemble)
    let setCounter = 0;
    const sets = new Map();
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const setId = setCounter++;
            grid[y][x].set = setId;
            sets.set(setId, [{ x, y }]);
        }
    }

    // Créer une liste de tous les murs internes
    const walls = [];

    // Ajouter les murs horizontaux (bottom)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (y < size - 1) { // Murs bottom (sauf dernière ligne)
                walls.push({
                    x, y,
                    type: 'bottom',
                    cell1: { x, y },
                    cell2: { x, y: y + 1 }
                });
            }
            if (x < size - 1) { // Murs right (sauf dernière colonne)
                walls.push({
                    x, y,
                    type: 'right',
                    cell1: { x, y },
                    cell2: { x: x + 1, y }
                });
            }
        }
    }

    // Mélanger les murs aléatoirement
    for (let i = walls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [walls[i], walls[j]] = [walls[j], walls[i]];
    }

    // Fonction pour trouver l'ensemble d'une cellule
    function findSet(x, y) {
        return grid[y][x].set;
    }

    // Fonction pour fusionner deux ensembles
    function mergeSets(set1, set2) {
        // Toujours fusionner le plus petit ensemble dans le plus grand
        if (sets.get(set1).length < sets.get(set2).length) {
            [set1, set2] = [set2, set1]; // Échanger pour que set1 soit le plus grand
        }

        const cellsToMerge = sets.get(set2);
        sets.get(set1).push(...cellsToMerge);

        // Mettre à jour l'identifiant d'ensemble pour toutes les cellules du set2
        for (const cell of cellsToMerge) {
            grid[cell.y][cell.x].set = set1;
        }

        sets.delete(set2);
    }

    // Algorithme de Kruskal modifié
    for (const wall of walls) {
        const { cell1, cell2 } = wall;
        const set1 = findSet(cell1.x, cell1.y);
        const set2 = findSet(cell2.x, cell2.y);

        // Si les cellules sont dans des ensembles différents, supprimer le mur entre elles
        if (set1 !== set2) {
            if (wall.type === 'right') {
                grid[wall.y][wall.x].walls.right = false;
            } else if (wall.type === 'bottom') {
                grid[wall.y][wall.x].walls.bottom = false;
            }

            // Fusionner les ensembles
            mergeSets(set1, set2);
        }
    }

    // Ajustement de la complexité: ajouter des chemins supplémentaires pour les labyrinthes plus faciles
    if (complexity < 1) {
        const additionalPaths = Math.floor((1 - complexity) * size * size * 0.2);
        for (let i = 0; i < additionalPaths; i++) {
            const x = Math.floor(Math.random() * (size - 1));
            const y = Math.floor(Math.random() * (size - 1));

            // Supprimer aléatoirement un mur (droit ou bas)
            if (Math.random() < 0.5 && x < size - 1) {
                grid[y][x].walls.right = false;
            } else if (y < size - 1) {
                grid[y][x].walls.bottom = false;
            }
        }
    }

    return grid;
}
function setupCamera() {
    camera.position.set(mazeSize * 0.7, mazeSize * 1.2, mazeSize * 0.7);
    controls.target.set(mazeSize / 2, 0, mazeSize / 2);
    controls.update();
}

function move(dx, dz) {
    const newX = currentPosition.x + dx;
    const newZ = currentPosition.z + dz;

    // Vérifier si le mouvement est valide (pas de mur)
    if (canMove(currentPosition.x, currentPosition.z, newX, newZ)) {
        currentPosition.x = newX;
        currentPosition.z = newZ;

        // Animation fluide
        new TWEEN.Tween(player.position)
            .to({ x: newX + 0.5, z: newZ + 0.5 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        // Vérification victoire
        if (newX === mazeSize - 1 && newZ === mazeSize - 1) {
            setTimeout(() => alert('Bravo ! Vous avez trouvé la sortie !'), 300);
        }
    }
}

function canMove(x, z, newX, newZ) {
    // Vérifier si on reste dans les limites du labyrinthe
    if (newX < 0 || newX >= mazeSize || newZ < 0 || newZ >= mazeSize) {
        return false;
    }

    // Vérifier s'il y a un mur entre la position actuelle et la nouvelle position
    if (newX > x) { // Déplacement vers la droite
        return !maze[z][x].walls.right;
    } else if (newX < x) { // Déplacement vers la gauche
        return !maze[z][newX].walls.right;
    } else if (newZ > z) { // Déplacement vers le bas
        return !maze[z][x].walls.bottom;
    } else if (newZ < z) { // Déplacement vers le haut
        return !maze[newZ][x].walls.bottom;
    }

    return true;
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    renderer.render(scene, camera);
}

// Gestion des touches
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': move(0, -1); break;
        case 'ArrowDown': move(0, 1); break;
        case 'ArrowLeft': move(-1, 0); break;
        case 'ArrowRight': move(1, 0); break;
    }
});

// Adaptation redimensionnement fenêtre
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialisation
initGame();
