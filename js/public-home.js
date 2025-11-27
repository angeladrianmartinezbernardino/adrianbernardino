// js/public-home.js

// Import shared Firebase app and Firestore.
import { app, db } from "./firebase-setup.js";

// Import Analytics.
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";

// Import Firestore helpers.
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Initialize Analytics.
const analytics = getAnalytics(app);

// --- DESIGN LOGIC ---

// Reference to Outside design document
const designRef = doc(db, "pages", "design_outside");

function applyTheme(theme) {
  if (!theme) return;

  const root = document.documentElement;

  // Apply colors
  if (theme.lava_color_primary) root.style.setProperty("--lava-color-primary", theme.lava_color_primary);
  if (theme.lava_color_secondary) root.style.setProperty("--lava-color-secondary", theme.lava_color_secondary);
  if (theme.lava_color_accent) root.style.setProperty("--lava-color-accent", theme.lava_color_accent);

  // Apply speed
  if (theme.lava_speed) root.style.setProperty("--lava-speed", theme.lava_speed + "s");
}

// Listen for design changes
onSnapshot(designRef, (snapshot) => {
  if (snapshot.exists()) {
    const data = snapshot.data();
    const theme = data.default_theme || {};
    applyTheme(theme);
    console.log("🎨 Public design updated:", theme.background_mode);
  }
});

// --- CONTENT LOGIC ---

window.addEventListener("DOMContentLoaded", () => {
  const titleElement = document.getElementById("main-title");
  const subtitleElement = document.getElementById("main-subtitle");

  if (!titleElement || !subtitleElement) {
    console.error("Main title or subtitle element not found in DOM.");
    return;
  }

  // Reference to the pages/home document in Firestore (Texts)
  const homeRef = doc(db, "pages", "home");

  // Listen for content updates
  onSnapshot(homeRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.main_title) titleElement.textContent = data.main_title;
      if (data.main_subtitle) subtitleElement.textContent = data.main_subtitle;
    } else {
      titleElement.textContent = "Hello, I am Adrián Bernardino";
      subtitleElement.textContent = "0 — 🌲🌱📌🌐☀️🎬🕣💧🔥🌸🍇🪵📡 — ∞";
    }
  },
    (error) => {
      console.error("Error reading Firestore:", error);
      titleElement.textContent = "Hello, I am Adrián Bernardino";
      subtitleElement.textContent = "Error loading data.";
    }
  );
});