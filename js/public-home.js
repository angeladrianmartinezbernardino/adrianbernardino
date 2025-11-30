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

// Import Lava Lamp
import { initLavaLamp } from "./lava-lamp.js";

// Initialize Analytics.
const analytics = getAnalytics(app);

// --- DESIGN LOGIC ---
// Initialize Lava Lamp with "home" context. 
// This handles the background animations and colors based on 'pages/design_home'.
initLavaLamp("home");

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