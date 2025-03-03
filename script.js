let scene, camera, renderer, controls;
let mazeSize = 15;
let player;
let exit;
let currentPosition = { x: 0, z: 0 };
let rendererContainer = null;
let maze; // Store maze data for collision detection

// Variables pour la simulation de la balle
let velocity = new THREE.Vector3(0, 0, 0); // Vitesse initiale de la balle
const GRAVITY = 9.8; // Constante de gravité (ajustable pour le jeu)
const TIME_STEP = 1 / 60; // Pas de temps basé sur 60 FPS
const FRICTION = 0.95; // Coefficient de friction pour ralentir la balle

// Constantes pour la visualisation
const WALL_HEIGHT = 0.5;
const WALL_THICKNESS = 0.1; // Augmenté par rapport à la valeur d'origine 0.1
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

    // Génération des données du labyrinthe
    maze = generateMazeData(size, complexity);

    // Création des murs basés sur les données du labyrinthe
    createWalls(maze, size);

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
// Fonction pour obtenir l'inclinaison de la caméra (vecteur direction horizontal)
function getInclination() {
    const center = new THREE.Vector3(mazeSize / 2, 0, mazeSize / 2);
    const cameraDirection = camera.position.clone().sub(center).normalize();
    cameraDirection.y = 0; // Projection sur le plan XZ (horizontal)
    cameraDirection.normalize();
    return cameraDirection;
}
// Fonction séparée pour créer uniquement les murs visuels
function createWalls(maze, size) {
    const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: WALL_COLOR,
        metalness: 0.3,
        roughness: 0.8
    });

    // Créer les murs extérieurs (haut et gauche)
    for (let x = 0; x < size; x++) {
        // Mur du haut (bordure supérieure)
        const topWall = new THREE.Mesh(wallGeometry, wallMaterial);
        topWall.position.set(x + 0.5, WALL_HEIGHT / 2, 0);
        topWall.scale.set(1, 1, 1); // Suppression du scale 0.1 pour garder l'épaisseur WALL_THICKNESS
        scene.add(topWall);
    }

    for (let y = 0; y < size; y++) {
        // Mur de gauche (bordure gauche)
        const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        leftWall.position.set(0, WALL_HEIGHT / 2, y + 0.5);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.scale.set(1, 1, 1); // Suppression du scale 0.1
        scene.add(leftWall);
    }

    // Créer les murs intérieurs d'après les données du labyrinthe
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Mur droit (si présent dans les données)
            if (maze[y][x].walls.right && x < size - 1) {
                const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
                rightWall.position.set(x + 1, WALL_HEIGHT / 2, y + 0.5);
                rightWall.rotation.y = Math.PI / 2;
                rightWall.scale.set(1, 1, 1); // Suppression du scale 0.1
                scene.add(rightWall);
            }
            
            // Mur du bas (si présent dans les données)
            if (maze[y][x].walls.bottom && y < size - 1) {
                const bottomWall = new THREE.Mesh(wallGeometry, wallMaterial);
                bottomWall.position.set(x + 0.5, WALL_HEIGHT / 2, y + 1);
                bottomWall.scale.set(1, 1, 1); // Suppression du scale 0.1
                scene.add(bottomWall);
            }
        }
    }
    
    // Ajouter les murs extérieurs manquants (droite et bas)
    for (let y = 0; y < size; y++) {
        // Mur de droite (bordure droite)
        const rightBorderWall = new THREE.Mesh(wallGeometry, wallMaterial);
        rightBorderWall.position.set(size, WALL_HEIGHT / 2, y + 0.5);
        rightBorderWall.rotation.y = Math.PI / 2;
        rightBorderWall.scale.set(1, 1, 1); // Suppression du scale 0.1
        scene.add(rightBorderWall);
    }
    
    for (let x = 0; x < size; x++) {
        // Mur du bas (bordure inférieure)
        const bottomBorderWall = new THREE.Mesh(wallGeometry, wallMaterial);
        bottomBorderWall.position.set(x + 0.5, WALL_HEIGHT / 2, size);
        bottomBorderWall.scale.set(1, 1, 1); // Suppression du scale 0.1
        scene.add(bottomBorderWall);
    }
}

function generateMazeData(size, complexity) {
    // Initialiser la grille avec tous les murs
    const grid = Array(size).fill().map(() => Array(size).fill().map(() => ({
        walls: { right: true, bottom: true },
        set: null  // Pour l'algorithme de Kruskal
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

    // Ajouter les murs horizontaux (bottom) et verticaux (right)
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

    // Mélanger les murs aléatoirement pour garantir la diversité des chemins
    shuffleArray(walls);

    // Algorithme de Kruskal: itérer sur chaque mur et le supprimer si les cellules ne sont pas déjà connectées
    for (const wall of walls) {
        const { cell1, cell2 } = wall;
        const set1 = findSet(grid, cell1.x, cell1.y);
        const set2 = findSet(grid, cell2.x, cell2.y);

        // Si les cellules sont dans des ensembles différents, supprimer le mur entre elles
        if (set1 !== set2) {
            if (wall.type === 'right') {
                grid[wall.y][wall.x].walls.right = false;
            } else if (wall.type === 'bottom') {
                grid[wall.y][wall.x].walls.bottom = false;
            }

            // Fusionner les ensembles
            mergeSets(grid, sets, set1, set2);
        }
    }

    // Ajustement de la complexité: ajouter des chemins supplémentaires pour les labyrinthes plus faciles
    if (complexity < 1) {
        const additionalPaths = Math.floor((1 - complexity) * size * size * 0.2);
        
        for (let i = 0; i < additionalPaths; i++) {
            const x = Math.floor(Math.random() * (size - 1));
            const y = Math.floor(Math.random() * (size - 1));

            // Supprimer aléatoirement un mur (droit ou bas)
            if (Math.random() < 0.5) {
                grid[y][x].walls.right = false;
            } else {
                grid[y][x].walls.bottom = false;
            }
        }
    }

    // Vérification supplémentaire pour garantir une solution
    ensurePathExists(grid, size);

    return grid;
}

// Fonction pour mélanger aléatoirement un tableau (algorithme de Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fonction pour trouver l'ensemble d'une cellule
function findSet(grid, x, y) {
    return grid[y][x].set;
}

// Fonction pour fusionner deux ensembles
function mergeSets(grid, sets, set1, set2) {
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

// Fonction pour garantir qu'un chemin existe entre l'entrée et la sortie
function ensurePathExists(grid, size) {
    // Vérification via un parcours en largeur (BFS)
    const visited = Array(size).fill().map(() => Array(size).fill(false));
    const queue = [{ x: 0, y: 0 }];
    visited[0][0] = true;
    
    while (queue.length > 0) {
        const current = queue.shift();
        const { x, y } = current;
        
        // Si on atteint la sortie, un chemin existe
        if (x === size - 1 && y === size - 1) {
            return true;
        }
        
        // Vérifier les quatre directions
        // Droite
        if (x < size - 1 && !grid[y][x].walls.right && !visited[y][x + 1]) {
            visited[y][x + 1] = true;
            queue.push({ x: x + 1, y });
        }
        // Gauche
        if (x > 0 && !grid[y][x - 1].walls.right && !visited[y][x - 1]) {
            visited[y][x - 1] = true;
            queue.push({ x: x - 1, y });
        }
        // Bas
        if (y < size - 1 && !grid[y][x].walls.bottom && !visited[y + 1][x]) {
            visited[y + 1][x] = true;
            queue.push({ x, y: y + 1 });
        }
        // Haut
        if (y > 0 && !grid[y - 1][x].walls.bottom && !visited[y - 1][x]) {
            visited[y - 1][x] = true;
            queue.push({ x, y: y - 1 });
        }
    }
    
    // Si aucun chemin n'est trouvé (ce qui ne devrait normalement pas arriver avec Kruskal)
    // On crée un chemin direct de l'entrée à la sortie
    let currentX = 0;
    let currentY = 0;
    
    while (currentX < size - 1 || currentY < size - 1) {
        if (currentX < size - 1) {
            grid[currentY][currentX].walls.right = false;
            currentX++;
        } else if (currentY < size - 1) {
            grid[currentY][currentX].walls.bottom = false;
            currentY++;
        }
    }
    
    return true;
}

function setupCamera() {
    camera.position.set(mazeSize * 0.7, mazeSize * 1.2, mazeSize * 0.7);
    controls.target.set(mazeSize / 2, 0, mazeSize / 2);
    controls.update();
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
// Fonction pour vérifier si la balle peut se déplacer vers la nouvelle position
function canMoveTo(newPosition) {
    const radius = 0.3; // Rayon de la balle
    const wallThickness = WALL_THICKNESS / 2; // Moitié de l’épaisseur des murs
    const mazeSize = 10; // Taille du labyrinthe (exemple)
    const minX = radius; // Bord gauche du labyrinthe
    const maxX = mazeSize - radius; // Bord droit du labyrinthe
    const minZ = radius; // Bord haut du labyrinthe
    const maxZ = mazeSize - radius; // Bord bas du labyrinthe

    // Vérification des limites extérieures
    if (newPosition.x < minX || newPosition.x > maxX || newPosition.z < minZ || newPosition.z > maxZ) {
        return false;
    }

    // Coordonnées des cellules actuelles et nouvelles
    const currentX = Math.floor(player.position.x);
    const currentZ = Math.floor(player.position.z);
    const newX = Math.floor(newPosition.x);
    const newZ = Math.floor(newPosition.z);

    // Pas de collision si le déplacement reste dans la même cellule
    if (currentX === newX && currentZ === newZ) {
        return true;
    }

    // Vérification des collisions selon la direction
    if (newX > currentX) { // Déplacement vers la droite
        if (maze[currentZ][currentX].walls.right) {
            const wallPosition = currentX + 1 - wallThickness; // Position du mur à droite
            if (newPosition.x + radius > wallPosition) {
                return false; // Collision avec le mur droit
            }
        }
    } else if (newX < currentX) { // Déplacement vers la gauche
        if (maze[currentZ][newX].walls.right) {
            const wallPosition = newX + wallThickness; // Position du mur à gauche
            if (newPosition.x - radius < wallPosition) {
                return false; // Collision avec le mur gauche
            }
        }
    }

    if (newZ > currentZ) { // Déplacement vers le bas
        if (maze[currentZ][currentX].walls.bottom) {
            const wallPosition = currentZ + 1 - wallThickness; // Position du mur en bas
            if (newPosition.z + radius > wallPosition) {
                return false; // Collision avec le mur inférieur
            }
        }
    } else if (newZ < currentZ) { // Déplacement vers le haut
        if (maze[newZ][currentX].walls.bottom) {
            const wallPosition = newZ + wallThickness; // Position du mur en haut
            if (newPosition.z - radius < wallPosition) {
                return false; // Collision avec le mur supérieur
            }
        }
    }

    return true; // Aucun obstacle détecté
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();

    // Calculer l'inclinaison basée sur la caméra
    const inclination = getInclination();

    // Calculer l'accélération due à la gravité en fonction de l'inclinaison
    const acceleration = new THREE.Vector3(
        inclination.x * GRAVITY,
        0,
        inclination.z * GRAVITY
    );

    // Mettre à jour la vitesse
    velocity.add(acceleration.clone().multiplyScalar(TIME_STEP));

    // Appliquer la friction pour ralentir la balle
    velocity.multiplyScalar(FRICTION);

    // Calculer la nouvelle position
    const newPosition = player.position.clone().add(velocity.clone().multiplyScalar(TIME_STEP));

    // Vérifier les collisions et ajuster la position
    if (canMoveTo(newPosition)) {
        player.position.copy(newPosition);
    } else {
        // Si collision, arrêter la vitesse dans la direction du déplacement
        velocity.set(0, 0, 0);
    }

    // Vérifier si la balle atteint la sortie
    if (Math.abs(player.position.x - (mazeSize - 0.5)) < 0.3 && Math.abs(player.position.z - (mazeSize - 0.5)) < 0.3) {
        setTimeout(() => alert('Bravo ! Vous avez trouvé la sortie !'), 100);
    }

    renderer.render(scene, camera);
}



// Adaptation redimensionnement fenêtre
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialisation
initGame();