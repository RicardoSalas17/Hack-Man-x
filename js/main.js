const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");
const scoreText = document.getElementById("score-text");
const pauseButton = document.getElementById("pause-button");
const menuButton = document.getElementById("menu-button");
const audioButton = document.getElementById("audio-button");

const state = createGameState();

let assets = null;
let audioBank = null;
let detachInputListeners = null;

boot();

async function boot() {
  canvas.width = GAME_CONFIG.canvas.width;
  canvas.height = GAME_CONFIG.canvas.height;

  try {
    assets = await preloadImages(ASSET_PATHS.images);
    audioBank = createAudioBank(ASSET_PATHS.audio);
    createFreshRun(false);
    bindUiActions();
    detachInputListeners = attachInputListeners(state.input, {
      onInteract: primeAudio,
      onPrimaryAction: handlePrimaryAction,
      onPauseToggle: togglePause,
    }, canvas);
    syncInfoStrip();
    window.requestAnimationFrame(loop);
  } catch (error) {
    statusText.textContent = "Status: Asset loading failed. Check the console for details.";
    console.error(error);
  }
}

function createFreshRun(changeMode = true) {
  state.player = new Player(GAME_CONFIG.player);
  state.boss = new BadGuyBoss(GAME_CONFIG.boss);
  state.enemies = [];
  state.projectiles = [];
  state.score = 0;
  state.result = null;
  state.pausedFrom = null;
  state.missionTime = 0;
  state.phase = "bats";
  state.batsDefeated = 0;
  state.deployStarted = false;
  state.enemyTimer = 0.8;
  state.backgroundOffset = 0;
  state.previousTime = 0;
  state.input = createInputState();

  if (changeMode) {
    beginDeployment();
  } else {
    state.mode = "title";
  }

  if (detachInputListeners) {
    detachInputListeners();
    detachInputListeners = attachInputListeners(state.input, {
      onInteract: primeAudio,
      onPrimaryAction: handlePrimaryAction,
      onPauseToggle: togglePause,
    }, canvas);
  }

  syncInfoStrip();
  syncActionButtons();
}

function beginDeployment() {
  state.mode = "deploying";
  state.deployStarted = false;
  state.player.startDeployment();
  clearInputState(state.input);
  syncActionButtons();
}

function handlePrimaryAction() {
  if (!assets) {
    return;
  }

  primeAudio();

  if (state.mode === "title") {
    createFreshRun(true);
    state.previousTime = 0;
    playIntroCue();
    syncInfoStrip();
    return;
  }

  if (state.mode === "gameover") {
    createFreshRun(true);
    playIntroCue();
  }
}

function bindUiActions() {
  pauseButton.addEventListener("click", togglePause);
  menuButton.addEventListener("click", returnToTitle);
  audioButton.addEventListener("click", toggleMute);
  syncActionButtons();
}

function togglePause() {
  if (state.mode === "playing" || state.mode === "deploying") {
    state.pausedFrom = state.mode;
    state.mode = "paused";
    clearInputState(state.input);
    pauseAllAudioPlayback();
    syncInfoStrip();
    syncActionButtons();
    return;
  }

  if (state.mode === "paused") {
    state.mode = state.pausedFrom || "playing";
    state.pausedFrom = null;
    state.previousTime = 0;
    resumeAudioAfterPause();
    syncInfoStrip();
    syncActionButtons();
  }
}

function returnToTitle() {
  createFreshRun(false);
  state.mode = "title";
  clearInputState(state.input);
  stopAllAudio();
  syncInfoStrip();
  syncActionButtons();
}

function toggleMute() {
  if (state.audioLevel === "high") {
    state.audioLevel = "low";
  } else if (state.audioLevel === "low") {
    state.audioLevel = "off";
  } else {
    state.audioLevel = "high";
  }

  applyAudioSettings();
  syncActionButtons();
}

function loop(timestamp) {
  const deltaSeconds = state.previousTime === 0 ? 0 : Math.min((timestamp - state.previousTime) / 1000, 0.033);
  state.previousTime = timestamp;

  update(deltaSeconds);
  render();
  window.requestAnimationFrame(loop);
}

function update(dt) {
  state.introPulse += dt;
  state.backgroundOffset = (state.backgroundOffset + dt * 44) % GAME_CONFIG.canvas.width;

  if (state.mode === "deploying") {
    const finishedDeploy = state.player.updateDeployment(dt);

    if (!state.deployStarted) {
      state.deployStarted = true;
      syncInfoStrip();
    }

    if (finishedDeploy) {
      state.mode = "playing";
      state.pausedFrom = null;
      startMusic();
      syncInfoStrip();
      syncActionButtons();
    }

    state.input.jumpPressed = false;
    state.input.shootPressed = false;
    return;
  }

  if (state.mode === "paused") {
    state.input.jumpPressed = false;
    state.input.shootPressed = false;
    return;
  }

  if (state.mode !== "playing") {
    state.input.jumpPressed = false;
    state.input.shootPressed = false;
    return;
  }

  state.missionTime += dt;
  state.player.update(dt, state.input);

  if (state.input.shootPressed) {
    const projectile = state.player.tryShoot();
    if (projectile) {
      state.projectiles.push(projectile);
    }
  }

  spawnEnemies(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateBoss(dt);
  resolveCollisions();

  state.input.jumpPressed = false;
  state.input.shootPressed = false;
  syncInfoStrip();
}

function spawnEnemies(dt) {
  if (state.phase !== "bats") {
    return;
  }

  state.enemyTimer -= dt;

  if (state.enemyTimer > 0) {
    return;
  }

  const baseInterval = Math.max(0.48, GAME_CONFIG.bat.spawnEvery - state.missionTime * 0.015);
  const nextY = 110 + Math.random() * 270;
  const nextSpeed = GAME_CONFIG.bat.speedMin + Math.random() * (GAME_CONFIG.bat.speedMax - GAME_CONFIG.bat.speedMin);

  state.enemies.push(new BatEnemy(nextY, nextSpeed + state.missionTime * 2));
  state.enemyTimer = baseInterval;
}

function updateBoss(dt) {
  if (state.phase !== "boss" || !state.boss || !state.boss.active) {
    return;
  }

  state.boss.update(dt, state.player);
}

function updateProjectiles(dt) {
  state.projectiles.forEach(projectile => projectile.update(dt));
  state.projectiles = state.projectiles.filter(projectile => projectile.active);
}

function updateEnemies(dt) {
  state.enemies.forEach(enemy => enemy.update(dt));
  state.enemies = state.enemies.filter(enemy => enemy.active);
}

function resolveCollisions() {
  state.projectiles.forEach(projectile => {
    state.enemies.forEach(enemy => {
      if (!projectile.active || !enemy.active) {
        return;
      }

      if (projectile.intersects(enemy)) {
        projectile.active = false;
        enemy.active = false;
        state.score += 1;
        state.batsDefeated += 1;

        if (state.phase === "bats" && state.batsDefeated >= GAME_CONFIG.mission.clearScore) {
          beginBossPhase();
        }
      }
    });
  });

  state.enemies.forEach(enemy => {
    if (!enemy.active) {
      return;
    }

    if (enemy.intersects(state.player)) {
      enemy.active = false;
      const tookDamage = state.player.takeDamage();

      if (tookDamage && state.player.health <= 0) {
        endRun("game-over");
      }
    }
  });

  if (state.phase === "boss" && state.boss && state.boss.active) {
    state.projectiles.forEach(projectile => {
      if (!projectile.active || !state.boss.active) {
        return;
      }

      if (projectile.intersects(state.boss)) {
        projectile.active = false;
        state.boss.takeHit();

        if (!state.boss.active) {
          endRun("mission-clear");
        }
      }
    });

    if (state.boss.active && state.boss.intersects(state.player) && state.boss.canDamagePlayer()) {
      const tookDamage = state.player.takeDamage();

      if (tookDamage && state.player.health <= 0) {
        endRun("game-over");
      }
    }
  }

  state.projectiles = state.projectiles.filter(projectile => projectile.active);
  state.enemies = state.enemies.filter(enemy => enemy.active);
}

function beginBossPhase() {
  if (state.phase === "boss") {
    return;
  }

  state.phase = "boss";
  state.enemies = [];
  state.enemyTimer = Number.POSITIVE_INFINITY;
  state.boss.reset();
  syncInfoStrip();
}

function endRun(result) {
  state.mode = "gameover";
  state.result = result;
  state.enemies = [];
  state.projectiles = [];
  if (state.boss) {
    state.boss.active = false;
  }
  state.bestScore = Math.max(state.bestScore, state.score);
  writeBestScore(state.bestScore);

  if (audioBank) {
    audioBank.music.pause();
    audioBank.music.currentTime = 0;

    if (result === "game-over") {
      audioBank.fail.currentTime = 0;
      audioBank.fail.play().catch(() => {});
    }
  }

  syncInfoStrip();
}

function render() {
  if (!assets) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (state.mode === "title") {
    renderTitleScreen();
    return;
  }

  renderPlayfield();

  if (state.mode === "gameover") {
    renderEndScreen();
    return;
  }

  if (state.mode === "paused") {
    renderPausedScreen();
  }
}

function drawBackground() {
  const width = canvas.width;
  const height = canvas.height;
  const bg = assets.background;
  const offset = state.backgroundOffset;

  ctx.save();
  ctx.drawImage(bg, -offset, 0, width, height);
  ctx.drawImage(bg, width - offset, 0, width, height);

  ctx.fillStyle = "rgba(5, 9, 18, 0.28)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(94, 186, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(120, 158, 210, 0.06)";
  for (let y = 0; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(4, 8, 18, 0.36)";
  ctx.fillRect(0, GAME_CONFIG.floorY, width, height - GAME_CONFIG.floorY);
  ctx.fillStyle = "rgba(85, 199, 255, 0.16)";
  ctx.fillRect(0, GAME_CONFIG.floorY - 6, width, 6);
  ctx.restore();
}

function renderTitleScreen() {
  const pulse = 0.6 + Math.sin(state.introPulse * 2.2) * 0.08;

  ctx.fillStyle = "rgba(2, 5, 12, 0.62)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(8, 15, 30, 0.84)";
  ctx.fillRect(640, 56, 388, 290);
  ctx.strokeStyle = "rgba(85, 199, 255, 0.32)";
  ctx.strokeRect(640, 56, 388, 290);

  ctx.save();
  ctx.globalAlpha = 0.54;
  ctx.drawImage(assets.intro, 664, 74, 340, 254);
  ctx.restore();

  ctx.fillStyle = "#55c7ff";
  ctx.font = '700 20px "SFMono-Regular", Consolas, monospace';
  ctx.fillText("MISSION READY // HACK SECTOR", 58, 76);

  ctx.fillStyle = "#edf7ff";
  ctx.font = '900 80px "Arial Black", Impact, sans-serif';
  ctx.fillText("HACK-MAN X", 54, 176);

  ctx.fillStyle = "#c2d9ea";
  ctx.font = '28px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText("A one-player Mega Man X5-inspired browser prototype.", 58, 226);

  ctx.fillStyle = "rgba(7, 12, 26, 0.82)";
  ctx.fillRect(58, 274, 430, 164);
  ctx.strokeStyle = "rgba(85, 199, 255, 0.38)";
  ctx.strokeRect(58, 274, 430, 164);

  ctx.fillStyle = "#e7f4ff";
  ctx.font = '700 18px "SFMono-Regular", Consolas, monospace';
  ctx.fillText("Mission Controls", 82, 314);
  ctx.font = '16px "SFMono-Regular", Consolas, monospace';
  ctx.fillText("MOVE   // A, D or Arrow Keys", 82, 352);
  ctx.fillText("JUMP   // W, Up or Space", 82, 384);
  ctx.fillText("SHOOT  // J, K or M", 82, 416);

  ctx.fillStyle = `rgba(85, 199, 255, ${pulse})`;
  ctx.font = '900 28px "Arial Black", Impact, sans-serif';
  ctx.fillText("Press Enter or Click the Frame to Start", 58, 504);

  ctx.fillStyle = "#95b8d0";
  ctx.font = '16px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText("Clear 14 bats to summon Badguy, then finish the encounter.", 58, 548);
}

function renderPlayfield() {
  state.enemies.forEach(enemy => enemy.draw(ctx, assets));
  if (state.phase === "boss" && state.boss && state.boss.active) {
    state.boss.draw(ctx, assets);
  }
  state.projectiles.forEach(projectile => projectile.draw(ctx, assets));
  state.player.draw(ctx, assets);
  drawHud();

  if (state.mode === "deploying") {
    renderDeployOverlay();
  }
}

function renderDeployOverlay() {
  ctx.fillStyle = "rgba(4, 8, 18, 0.12)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(85, 199, 255, 0.9)";
  ctx.font = '700 18px "SFMono-Regular", Consolas, monospace';
  ctx.fillText("DEPLOYING UNIT X", 42, 112);
}

function drawHud() {
  ctx.fillStyle = "rgba(6, 10, 24, 0.64)";
  ctx.fillRect(24, 20, canvas.width - 48, 66);

  ctx.strokeStyle = "rgba(85, 199, 255, 0.22)";
  ctx.strokeRect(24, 20, canvas.width - 48, 66);

  ctx.fillStyle = "#55c7ff";
  ctx.font = '700 16px "SFMono-Regular", Consolas, monospace';
  ctx.fillText("X UNIT", 44, 48);

  for (let index = 0; index < GAME_CONFIG.player.maxHealth; index += 1) {
    ctx.fillStyle = index < state.player.health ? "#55c7ff" : "rgba(85, 199, 255, 0.16)";
    ctx.fillRect(132 + index * 28, 34, 20, 16);
  }

  ctx.fillStyle = "#edf7ff";
  ctx.font = '700 18px "SFMono-Regular", Consolas, monospace';
  ctx.fillText(`SCORE ${String(state.score).padStart(2, "0")}`, 470, 48);
  if (state.phase === "bats") {
    ctx.fillText(`TARGET ${String(GAME_CONFIG.mission.clearScore).padStart(2, "0")}`, 620, 48);
  } else {
    const bossHealth = state.boss ? Math.max(0, state.boss.health) : 0;
    ctx.fillText(`BOSS HP ${String(bossHealth).padStart(2, "0")}`, 620, 48);
  }
  ctx.fillText(`TIME ${Math.floor(state.missionTime).toString().padStart(2, "0")}s`, 804, 48);

  ctx.fillStyle = "#9ab7ca";
  ctx.font = '14px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText(state.phase === "bats" ? "PHASE 1 // BAT SWARM" : "PHASE 2 // BADGUY CORE", 470, 69);
}

function renderEndScreen() {
  ctx.fillStyle = "rgba(2, 4, 10, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cleared = state.result === "mission-clear";
  ctx.fillStyle = cleared ? "#55c7ff" : "#ff7986";
  ctx.font = '900 62px "Arial Black", Impact, sans-serif';
  ctx.fillText(cleared ? "MISSION CLEAR" : "SYSTEM FAILURE", 210, 214);

  ctx.fillStyle = "#edf7ff";
  ctx.font = '28px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText(cleared ? "Badguy has been neutralized. The sector is secure." : "Unit X was overwhelmed before the mission could conclude.", 168, 276);

  ctx.font = '22px "SFMono-Regular", Consolas, monospace';
  ctx.fillText(`Final Score // ${String(state.score).padStart(2, "0")}`, 382, 338);
  ctx.fillText(`Best Score  // ${String(state.bestScore).padStart(2, "0")}`, 382, 378);

  ctx.fillStyle = "rgba(85, 199, 255, 0.92)";
  ctx.font = '900 28px "Arial Black", Impact, sans-serif';
  ctx.fillText("Press Enter or Click to Reboot Mission", 236, 470);
}

function renderPausedScreen() {
  ctx.fillStyle = "rgba(2, 4, 10, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#55c7ff";
  ctx.font = '900 64px "Arial Black", Impact, sans-serif';
  ctx.fillText("MISSION PAUSED", 250, 228);

  ctx.fillStyle = "#edf7ff";
  ctx.font = '26px "Trebuchet MS", Arial, sans-serif';
  ctx.fillText("Use the panel below the game to resume, mute audio, or return to title.", 120, 290);
}

function syncInfoStrip() {
  scoreText.textContent = `Best Score: ${state.bestScore}`;

  switch (state.mode) {
    case "title":
      statusText.textContent = "Status: Title screen ready. Press Enter or click to deploy Unit X.";
      break;
    case "playing":
      statusText.textContent = state.phase === "bats"
        ? `Status: Phase 1 active. HP ${state.player.health}/${GAME_CONFIG.player.maxHealth} // Bats cleared ${state.batsDefeated}/${GAME_CONFIG.mission.clearScore}.`
        : `Status: Boss encounter active. HP ${state.player.health}/${GAME_CONFIG.player.maxHealth} // Badguy HP ${state.boss ? Math.max(0, state.boss.health) : 0}.`;
      break;
    case "deploying":
      statusText.textContent = "Status: Unit X entering the sector.";
      break;
    case "paused":
      statusText.textContent = "Status: Mission paused. Resume or return to title from the control panel.";
      break;
    case "gameover":
      statusText.textContent = state.result === "mission-clear"
        ? "Status: Mission clear. Systems ready for another run."
        : "Status: Mission failed. Press Enter or click to try again.";
      break;
    default:
      break;
  }
}

function syncActionButtons() {
  audioButton.textContent = `Music: ${state.audioLevel.charAt(0).toUpperCase()}${state.audioLevel.slice(1)}`;
  audioButton.classList.toggle("is-active", state.audioLevel === "high");
  audioButton.classList.toggle("is-low", state.audioLevel === "low");
  audioButton.classList.toggle("is-muted", state.audioLevel === "off");

  pauseButton.textContent = state.mode === "paused" ? "Resume Mission" : "Pause Mission";
  pauseButton.disabled = !["playing", "deploying", "paused"].includes(state.mode);
  pauseButton.classList.toggle("is-active", state.mode === "paused");

  menuButton.disabled = state.mode === "title";
}

function preloadImages(imageMap) {
  const entries = Object.entries(imageMap);

  return Promise.all(entries.map(([key, source]) => loadImage(source).then(image => [key, image]))).then(loadedEntries => {
    return Object.fromEntries(loadedEntries);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    image.src = source;
  });
}

function createAudioBank(audioMap) {
  const intro = new Audio(audioMap.intro);
  const music = new Audio(audioMap.music);
  const fail = new Audio(audioMap.fail);

  music.loop = true;
  applyAudioSettings({ intro, music, fail });

  return { intro, music, fail };
}

function applyAudioSettings(targetBank = audioBank) {
  if (!targetBank) {
    return;
  }

  const volumeMap = {
    high: 1,
    low: 0.38,
    off: 0,
  };
  const volumeFactor = volumeMap[state.audioLevel] ?? 1;

  targetBank.music.volume = 0.35 * volumeFactor;
  targetBank.intro.volume = 0.42 * volumeFactor;
  targetBank.fail.volume = 0.45 * volumeFactor;
}

function primeAudio() {
  if (!audioBank || state.audioPrimed) {
    return;
  }

  state.audioPrimed = true;
  audioBank.intro.load();
  audioBank.music.load();
  audioBank.fail.load();
}

function playIntroCue() {
  if (!audioBank) {
    return;
  }

  audioBank.intro.currentTime = 0;
  audioBank.intro.play().catch(() => {});
}

function startMusic() {
  if (!audioBank) {
    return;
  }

  audioBank.fail.pause();
  audioBank.fail.currentTime = 0;
  audioBank.music.currentTime = 0;
  audioBank.music.play().catch(() => {});
}

function pauseAllAudioPlayback() {
  if (!audioBank) {
    return;
  }

  audioBank.intro.pause();
  audioBank.music.pause();
  audioBank.fail.pause();
}

function resumeAudioAfterPause() {
  if (!audioBank) {
    return;
  }

  if (state.mode === "deploying") {
    audioBank.intro.play().catch(() => {});
    return;
  }

  if (state.mode === "playing") {
    audioBank.music.play().catch(() => {});
  }
}

function stopAllAudio() {
  if (!audioBank) {
    return;
  }

  audioBank.intro.pause();
  audioBank.intro.currentTime = 0;
  audioBank.music.pause();
  audioBank.music.currentTime = 0;
  audioBank.fail.pause();
  audioBank.fail.currentTime = 0;
}
