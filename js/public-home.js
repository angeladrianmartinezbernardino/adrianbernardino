// js/public-home.js

// Import shared Firebase app and Firestore.
import { app, db } from "./firebase-setup.js";

// Import Analytics only here (not needed in admin panel).
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";

// Import Firestore helpers for this page.
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Initialize Analytics (no need to use the variable later).
const analytics = getAnalytics(app);

// Wait until the DOM is fully loaded before querying elements.
window.addEventListener("DOMContentLoaded", () => {
  const titleElement = document.getElementById("main-title");
  const subtitleElement = document.getElementById("main-subtitle");

  if (!titleElement || !subtitleElement) {
    console.error("Main title or subtitle element not found in DOM.");
    return;
  }

  // Reference to the pages/home document in Firestore.
  const homeRef = doc(db, "pages", "home");

  // Listen for real-time updates written from the Admin panel.
  onSnapshot(
    homeRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        if (data.main_title) {
          titleElement.textContent = data.main_title;
        }

        if (data.main_subtitle) {
          subtitleElement.textContent = data.main_subtitle;
        }
      } else {
        // Fallback values if the document does not exist.
        titleElement.textContent = "Hello, I am Adrián Bernardino";
        subtitleElement.textContent =
          "0 — 🌲🌱📌🌐☀️🎬🕣💧🔥🌸🍇🪵📡 — ∞";
      }
    },
    (error) => {
      console.error("Error reading Firestore:", error);
      titleElement.textContent = "Hello, I am Adrián Bernardino";
      subtitleElement.textContent = "Error loading data.";
    }
  );
});
