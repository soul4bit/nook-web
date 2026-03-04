"use strict";

(() => {
  const form = document.querySelector("[data-auth-form]");
  const scene = document.querySelector("[data-auth-scene]");
  if (!form || !scene) {
    return;
  }

  const mode = (form.dataset.authMode || "login").toLowerCase();

  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  if (!emailInput || !passwordInput) {
    return;
  }

  const emailLine = scene.querySelector("[data-live-email]");
  const passwordLine = scene.querySelector("[data-live-password]");
  const eventLine = scene.querySelector("[data-live-event]");
  const statusLine = scene.querySelector("[data-live-status]");
  const fill = scene.querySelector("[data-live-fill]");
  const thumb = scene.querySelector("[data-live-thumb]");
  const flow = scene.querySelector("[data-live-flow]");
  const pulse = scene.querySelector("[data-live-pulse]");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const shortEmail = (value) => {
    const clean = value.trim();
    if (clean.length <= 34) {
      return clean;
    }
    return `${clean.slice(0, 16)}...${clean.slice(-12)}`;
  };

  const maskPassword = (value) => {
    const count = Math.min(value.length, 16);
    return "*".repeat(count);
  };

  const setProgress = (value) => {
    const progress = clamp(value, 0, 100);

    if (fill) {
      fill.style.width = `${progress}%`;
    }
    if (thumb) {
      thumb.style.left = `${progress}%`;
    }

    if (flow && pulse) {
      const firstNode = flow.querySelector(".flow-node-1");
      const lastNode = flow.querySelector(".flow-node-3");

      if (firstNode && lastNode) {
        const startCenter = firstNode.offsetLeft + firstNode.offsetWidth / 2;
        const endCenter = lastNode.offsetLeft + lastNode.offsetWidth / 2;
        const pulseHalf = pulse.offsetWidth / 2;
        const center = startCenter + ((endCenter - startCenter) * progress) / 100;
        pulse.style.left = `${center - pulseHalf}px`;
      }
    }
  };

  const setWaitingState = () => {
    if (emailLine) {
      emailLine.textContent = "input.email: ожидание...";
    }
    if (passwordLine) {
      passwordLine.textContent = "input.password: ожидание...";
    }
    if (eventLine) {
      eventLine.textContent = "auth.event: ожидание...";
    }
    if (statusLine) {
      statusLine.textContent = "статус: ожидание ввода";
    }
    setProgress(0);
  };

  const updateScene = () => {
    if (mode === "register") {
      setWaitingState();
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const hasEmail = email.length > 0;
    const hasPassword = password.length > 0;
    const strongPassword = password.length >= 10;

    let progress = 0;
    if (hasEmail) {
      progress += 45;
    }
    if (hasPassword) {
      progress += 35;
    }
    if (strongPassword) {
      progress += 20;
    }

    if (emailLine) {
      emailLine.textContent = hasEmail ? `input.email: ${shortEmail(email)}` : "input.email: ожидание...";
    }
    if (passwordLine) {
      passwordLine.textContent = hasPassword
        ? `input.password: ${maskPassword(password)} (${password.length})`
        : "input.password: ожидание...";
    }

    if (eventLine && statusLine) {
      if (!hasEmail && !hasPassword) {
        eventLine.textContent = "auth.event: ожидаем данные";
        statusLine.textContent = "статус: ожидание ввода";
      } else if (hasEmail && !hasPassword) {
        eventLine.textContent = "auth.event: email принят, ожидаем пароль";
        statusLine.textContent = "статус: введите пароль";
      } else if (!hasEmail && hasPassword) {
        eventLine.textContent = "auth.event: пароль принят, ожидаем email";
        statusLine.textContent = "статус: введите email";
      } else if (!strongPassword) {
        eventLine.textContent = "auth.event: пароль не проходит политику (<10)";
        statusLine.textContent = "статус: усильте пароль";
      } else {
        eventLine.textContent = "auth.event: данные готовы, можно отправлять";
        statusLine.textContent = "статус: готово к отправке";
      }
    }

    setProgress(progress);
  };

  emailInput.addEventListener("input", updateScene);
  passwordInput.addEventListener("input", updateScene);
  window.addEventListener("resize", updateScene);

  updateScene();
})();
