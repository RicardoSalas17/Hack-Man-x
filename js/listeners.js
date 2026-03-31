function attachInputListeners(input, callbacks = {}, pointerTarget = window) {
  const preventDefaults = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "Enter", "Escape"]);

  function markPressed(action) {
    if (action === "jump" && !input.jumpHeld) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }

    if (action === "shoot" && !input.shootHeld) {
      input.shootPressed = true;
      input.shootHeld = true;
    }
  }

  function markReleased(action) {
    if (action === "jump") {
      input.jumpHeld = false;
    }

    if (action === "shoot") {
      input.shootHeld = false;
    }
  }

  function onKeyDown(event) {
    if (preventDefaults.has(event.code)) {
      event.preventDefault();
    }

    if (callbacks.onInteract) {
      callbacks.onInteract();
    }

    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        input.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        input.right = true;
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
        markPressed("jump");
        break;
      case "KeyJ":
      case "KeyK":
      case "KeyM":
        markPressed("shoot");
        break;
      case "Enter":
        if (callbacks.onPrimaryAction) {
          callbacks.onPrimaryAction();
        }
        break;
      case "Escape":
        if (callbacks.onPauseToggle) {
          callbacks.onPauseToggle();
        }
        break;
      default:
        break;
    }
  }

  function onKeyUp(event) {
    switch (event.code) {
      case "ArrowLeft":
      case "KeyA":
        input.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        input.right = false;
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
        markReleased("jump");
        break;
      case "KeyJ":
      case "KeyK":
      case "KeyM":
        markReleased("shoot");
        break;
      default:
        break;
    }
  }

  function onPointerDown() {
    if (callbacks.onInteract) {
      callbacks.onInteract();
    }

    if (callbacks.onPrimaryAction) {
      callbacks.onPrimaryAction();
    }
  }

  function onBlur() {
    input.left = false;
    input.right = false;
    input.jumpHeld = false;
    input.jumpPressed = false;
    input.shootHeld = false;
    input.shootPressed = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  pointerTarget.addEventListener("pointerdown", onPointerDown);

  return function detachListeners() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    pointerTarget.removeEventListener("pointerdown", onPointerDown);
  };
}
