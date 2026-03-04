"use strict";

(() => {
  const form = document.querySelector("[data-auth-form]");
  const scene = document.querySelector("[data-auth-scene]");
  if (!form || !scene) {
    return;
  }

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
      const start = 12;
      const end = Math.max(start, flow.clientWidth - 22);
      const left = start + ((end - start) * progress) / 100;
      pulse.style.left = `${left}px`;
    }
  };

  const updateScene = () => {
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
      emailLine.textContent = hasEmail ? `input.email: ${shortEmail(email)}` : "input.email: waiting...";
    }
    if (passwordLine) {
      passwordLine.textContent = hasPassword
        ? `input.password: ${maskPassword(password)} (${password.length})`
        : "input.password: waiting...";
    }

    if (eventLine && statusLine) {
      if (!hasEmail && !hasPassword) {
        eventLine.textContent = "auth.event: awaiting credentials";
        statusLine.textContent = "status: waiting for input";
      } else if (hasEmail && !hasPassword) {
        eventLine.textContent = "auth.event: email accepted, waiting for password";
        statusLine.textContent = "status: enter password";
      } else if (!hasEmail && hasPassword) {
        eventLine.textContent = "auth.event: password accepted, waiting for email";
        statusLine.textContent = "status: enter email";
      } else if (!strongPassword) {
        eventLine.textContent = "auth.event: password policy check failed (<10)";
        statusLine.textContent = "status: strengthen password";
      } else {
        eventLine.textContent = "auth.event: credentials staged, ready to submit";
        statusLine.textContent = "status: ready to submit";
      }
    }

    setProgress(progress);
  };

  emailInput.addEventListener("input", updateScene);
  passwordInput.addEventListener("input", updateScene);
  window.addEventListener("resize", updateScene);

  updateScene();
})();
