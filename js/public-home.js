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

      // Render Social Links
      const socialContainer = document.getElementById("social-links-container");
      if (socialContainer) {
        const links = data.social_links || [];
        socialContainer.innerHTML = "";
        links.forEach(link => {
          const a = document.createElement("a");
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.className = "footer-button";
          a.style.display = "flex";
          a.style.alignItems = "center";
          a.style.justifyContent = "flex-end";
          a.style.gap = "0.5rem";
          a.style.textDecoration = "none";
          a.style.marginBottom = "0.2rem";

          a.innerHTML = `<span>${link.title}</span> <span style="font-size:1.1em;">${link.icon || ""}</span>`;
          socialContainer.appendChild(a);
        });
      }
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