const GAME_CONFIG = {
  canvas: {
    width: 1100,
    height: 600,
  },
  floorY: 488,
  player: {
    x: 110,
    width: 112,
    height: 112,
    moveSpeed: 420,
    gravity: 2280,
    jumpVelocity: 980,
    maxFallSpeed: 1440,
    shootCooldown: 0.24,
    hitInvulnerability: 1.15,
    maxHealth: 5,
  },
  projectile: {
    width: 34,
    height: 24,
    speed: 840,
  },
  bat: {
    width: 132,
    height: 92,
    speedMin: 220,
    speedMax: 340,
    spawnEvery: 1.2,
    bobAmount: 18,
    bobSpeed: 4.2,
  },
  boss: {
    width: 300,
    height: 300,
    maxHealth: 18,
    startX: 720,
    startY: 88,
    speedX: 150,
    amplitudeY: 88,
    bobSpeed: 1.8,
    lungeInterval: 2.8,
    lungeDuration: 0.9,
    lungeSpeed: 260,
    trackingStrength: 0.12,
    contactDamageCooldown: 1.1,
  },
  mission: {
    clearScore: 14,
  },
};

const ASSET_PATHS = {
  images: {
    background: "Images/bg.jpg",
    intro: "Images/MMX3-SNES-Proto_IntroBG.png",
    deploy: "Images/entrada.png",
    standRight: "Images/megamanstand-right.png",
    standLeft: "Images/megamanstand-left.png",
    walkRight: "Images/mmx_x-right.png",
    walkLeft: "Images/mmx_x-left.png",
    jumpRight: "Images/mmx-x-jump-right.png",
    jumpLeft: "Images/mmx-x-jump-left.png",
    shotRight: "Images/shot-right.png",
    shotLeft: "Images/shot-left.png",
    projectile: "Images/municion.png",
    bat: "Images/batsito.png",
    badGuy: "Images/badguy.png",
  },
  audio: {
    intro: "Audio/inicio.MP3",
    music: "Audio/siempre.MP3",
    fail: "Audio/final.MP3",
  },
};

function createInputState() {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    shootHeld: false,
    shootPressed: false,
  };
}

function createGameState() {
  const bestScore = readBestScore();

  return {
    mode: "title",
    pausedFrom: null,
    result: null,
    score: 0,
    bestScore,
    missionTime: 0,
    phase: "bats",
    batsDefeated: 0,
    deployStarted: false,
    enemyTimer: 0.8,
    backgroundOffset: 0,
    introPulse: 0,
    input: createInputState(),
    player: null,
    boss: null,
    enemies: [],
    projectiles: [],
    audioLevel: "high",
    audioPrimed: false,
    previousTime: 0,
  };
}

function clearInputState(input) {
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  input.jumpPressed = false;
  input.shootHeld = false;
  input.shootPressed = false;
}

function readBestScore() {
  try {
    const parsed = Number.parseInt(window.localStorage.getItem("hackmanx-best-score") || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem("hackmanx-best-score", String(value));
  } catch (error) {
    // Ignore storage failures to keep the game playable in restricted contexts.
  }
}
