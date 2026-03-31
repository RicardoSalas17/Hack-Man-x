class Player {
  constructor(config) {
    this.config = config;
    this.width = config.width;
    this.height = config.height;
    this.reset();
  }

  reset() {
    this.x = this.config.x;
    this.y = GAME_CONFIG.floorY - this.height;
    this.vx = 0;
    this.vy = 0;
    this.direction = "right";
    this.isGrounded = true;
    this.health = this.config.maxHealth;
    this.shootCooldown = 0;
    this.invulnerability = 0;
    this.flashTimer = 0;
    this.poseTimer = 0;
    this.recoilTimer = 0;
    this.isDeploying = false;
    this.deployTimer = 0;
    this.deployDuration = 1.45;
    this.deployStartY = -this.height * 2.4;
  }

  startDeployment() {
    this.x = this.config.x;
    this.y = this.deployStartY;
    this.vx = 0;
    this.vy = 0;
    this.direction = "right";
    this.isGrounded = false;
    this.poseTimer = 0;
    this.recoilTimer = 0;
    this.isDeploying = true;
    this.deployTimer = 0;
  }

  updateDeployment(dt) {
    this.poseTimer += dt;
    this.deployTimer = Math.min(this.deployTimer + dt, this.deployDuration);

    const progress = this.deployTimer / this.deployDuration;
    const eased = 1 - Math.pow(1 - progress, 3);
    const targetY = GAME_CONFIG.floorY - this.height;
    this.y = this.deployStartY + (targetY - this.deployStartY) * eased;

    if (progress >= 1) {
      this.y = targetY;
      this.isGrounded = true;
      this.isDeploying = false;
      return true;
    }

    return false;
  }

  update(dt, input) {
    const horizontalInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);

    this.poseTimer += dt;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.recoilTimer = Math.max(0, this.recoilTimer - dt);

    if (horizontalInput !== 0) {
      this.direction = horizontalInput < 0 ? "left" : "right";
    }

    this.vx = horizontalInput * this.config.moveSpeed;

    if (input.jumpPressed && this.isGrounded) {
      this.vy = -this.config.jumpVelocity;
      this.isGrounded = false;
    }

    this.vy = Math.min(this.vy + this.config.gravity * dt, this.config.maxFallSpeed);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < 24) {
      this.x = 24;
    }

    const maxX = GAME_CONFIG.canvas.width - this.width - 24;
    if (this.x > maxX) {
      this.x = maxX;
    }

    const floorLevel = GAME_CONFIG.floorY - this.height;
    if (this.y >= floorLevel) {
      this.y = floorLevel;
      this.vy = 0;
      this.isGrounded = true;
    }
  }

  tryShoot() {
    if (this.shootCooldown > 0) {
      return null;
    }

    this.shootCooldown = this.config.shootCooldown;
    this.recoilTimer = 0.14;

    const projectileX = this.direction === "right" ? this.x + this.width - 2 : this.x - GAME_CONFIG.projectile.width + 2;
    const projectileY = this.y + this.height * 0.44;

    return new Projectile(projectileX, projectileY, this.direction);
  }

  takeDamage() {
    if (this.invulnerability > 0) {
      return false;
    }

    this.health -= 1;
    this.invulnerability = this.config.hitInvulnerability;
    this.flashTimer = this.config.hitInvulnerability;
    return true;
  }

  intersects(other) {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }

  draw(ctx, assets) {
    if (this.flashTimer > 0 && Math.floor(this.flashTimer * 16) % 2 === 0) {
      return;
    }

    const spriteSet = this.getSpriteSet(assets);

    if (spriteSet.type === "sheet") {
      const frame = Math.floor(this.poseTimer * spriteSet.fps) % spriteSet.frames;
      const drawScale = spriteSet.drawScale || 1;
      const drawWidth = this.width * drawScale;
      const drawHeight = this.height * drawScale;
      const drawX = this.x - (drawWidth - this.width) / 2;
      const drawY = this.y - (drawHeight - this.height);

      if (spriteSet.flipX) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
          spriteSet.asset,
          frame * spriteSet.frameWidth,
          0,
          spriteSet.frameWidth,
          spriteSet.frameHeight,
          -drawX - drawWidth,
          drawY,
          drawWidth,
          drawHeight
        );
        ctx.restore();
        return;
      }

      ctx.drawImage(
        spriteSet.asset,
        frame * spriteSet.frameWidth,
        0,
        spriteSet.frameWidth,
        spriteSet.frameHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
      return;
    }

    ctx.drawImage(spriteSet.asset, this.x, this.y, this.width, this.height);
  }

  getSpriteSet(assets) {
    if (this.isDeploying) {
      return { asset: assets.deploy, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 50, fps: 9, drawScale: 2.8 };
    }

    if (!this.isGrounded) {
      return this.direction === "right"
        ? { asset: assets.jumpRight, type: "sheet", frameWidth: 100, frameHeight: 129, frames: 16, fps: 18, drawScale: 2.2 }
        : { asset: assets.jumpRight, type: "sheet", frameWidth: 100, frameHeight: 129, frames: 16, fps: 18, drawScale: 2.2, flipX: true };
    }

    if (this.recoilTimer > 0) {
      return this.direction === "right"
        ? { asset: assets.shotRight, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 22 }
        : { asset: assets.shotLeft, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 22 };
    }

    if (Math.abs(this.vx) > 0) {
      return this.direction === "right"
        ? { asset: assets.walkRight, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 20 }
        : { asset: assets.walkLeft, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 20 };
    }

    return this.direction === "right"
      ? { asset: assets.standRight, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 10 }
      : { asset: assets.standLeft, type: "sheet", frameWidth: 100, frameHeight: 100, frames: 16, fps: 10 };
  }
}

class Projectile {
  constructor(x, y, direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.width = GAME_CONFIG.projectile.width;
    this.height = GAME_CONFIG.projectile.height;
    this.active = true;
  }

  update(dt) {
    const velocity = this.direction === "right" ? GAME_CONFIG.projectile.speed : -GAME_CONFIG.projectile.speed;
    this.x += velocity * dt;

    if (this.x > GAME_CONFIG.canvas.width + 80 || this.x + this.width < -80) {
      this.active = false;
    }
  }

  draw(ctx, assets) {
    ctx.drawImage(assets.projectile, this.x, this.y, this.width, this.height);
  }

  intersects(other) {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }
}

class BatEnemy {
  constructor(y, speed) {
    this.baseY = y;
    this.x = GAME_CONFIG.canvas.width + 50;
    this.y = y;
    this.width = GAME_CONFIG.bat.width;
    this.height = GAME_CONFIG.bat.height;
    this.speed = speed;
    this.waveOffset = Math.random() * Math.PI * 2;
    this.lifeTime = 0;
    this.active = true;
  }

  update(dt) {
    this.lifeTime += dt;
    this.x -= this.speed * dt;
    this.y = this.baseY + Math.sin(this.lifeTime * GAME_CONFIG.bat.bobSpeed + this.waveOffset) * GAME_CONFIG.bat.bobAmount;

    if (this.x + this.width < -120) {
      this.active = false;
    }
  }

  draw(ctx, assets) {
    const frame = Math.floor(this.lifeTime * 14) % 11;

    ctx.drawImage(
      assets.bat,
      frame * 40,
      0,
      40,
      60,
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  intersects(other) {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }
}

class BadGuyBoss {
  constructor(config) {
    this.config = config;
    this.width = config.width;
    this.height = config.height;
    this.maxHealth = config.maxHealth;
    this.reset();
  }

  reset() {
    this.x = this.config.startX;
    this.y = this.config.startY;
    this.baseY = this.config.startY;
    this.directionX = -1;
    this.lifeTime = 0;
    this.health = this.maxHealth;
    this.active = true;
    this.contactCooldown = 0;
    this.lungeCooldown = this.config.lungeInterval;
    this.lungeTimer = 0;
    this.lungeVX = 0;
    this.lungeVY = 0;
  }

  update(dt, player) {
    this.lifeTime += dt;
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);

    if (this.lungeTimer > 0) {
      this.lungeTimer = Math.max(0, this.lungeTimer - dt);
      this.x += this.lungeVX * dt;
      this.y += this.lungeVY * dt;

      if (this.lungeTimer === 0) {
        this.lungeCooldown = this.config.lungeInterval;
      }
    } else {
      this.x += this.directionX * this.config.speedX * dt;
      const patrolY = this.baseY + Math.sin(this.lifeTime * this.config.bobSpeed) * this.config.amplitudeY;
      this.y += (patrolY - this.y) * Math.min(1, this.config.trackingStrength * 60 * dt);

      if (player && this.lungeCooldown === 0) {
        this.beginLunge(player);
      }
    }

    if (this.x <= 380) {
      this.x = 380;
      this.directionX = 1;
      this.lungeVX = Math.abs(this.lungeVX);
    } else if (this.x >= GAME_CONFIG.canvas.width - this.width - 42) {
      this.x = GAME_CONFIG.canvas.width - this.width - 42;
      this.directionX = -1;
      this.lungeVX = -Math.abs(this.lungeVX);
    }

    const minY = 48;
    const maxY = GAME_CONFIG.floorY - this.height - 18;
    if (this.y < minY) {
      this.y = minY;
      this.lungeVY = Math.abs(this.lungeVY);
    } else if (this.y > maxY) {
      this.y = maxY;
      this.lungeVY = -Math.abs(this.lungeVY);
    }
  }

  beginLunge(player) {
    const bossCenterX = this.x + this.width / 2;
    const bossCenterY = this.y + this.height / 2;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const deltaX = playerCenterX - bossCenterX;
    const deltaY = playerCenterY - bossCenterY;
    const distance = Math.hypot(deltaX, deltaY) || 1;

    this.lungeTimer = this.config.lungeDuration;
    this.lungeVX = (deltaX / distance) * this.config.lungeSpeed;
    this.lungeVY = (deltaY / distance) * this.config.lungeSpeed * 0.7;
    this.directionX = deltaX < 0 ? -1 : 1;
  }

  takeHit() {
    if (!this.active) {
      return false;
    }

    this.health -= 1;
    if (this.health <= 0) {
      this.active = false;
    }
    return true;
  }

  canDamagePlayer() {
    if (this.contactCooldown > 0) {
      return false;
    }

    this.contactCooldown = this.config.contactDamageCooldown;
    return true;
  }

  draw(ctx, assets) {
    const frameWidth = assets.badGuy.width / 16;
    const frame = Math.floor(this.lifeTime * 12) % 16;

    ctx.drawImage(
      assets.badGuy,
      frame * frameWidth,
      0,
      frameWidth,
      assets.badGuy.height,
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  intersects(other) {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }
}
