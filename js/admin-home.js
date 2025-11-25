// js/admin-home.js

// Import shared Firestore and Auth instances.
import { db, auth } from "./firebase-setup.js";

// Import Auth helpers needed for Google Sign-In.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Import Firestore helpers for this panel.
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// List of allowed admin accounts.
const ADMIN_EMAILS = [
  "angeladrianmartinezbernardino@gmail.com",
  // Future admin emails can be added here.
];

// DOM element references.
const statusElement = document.getElementById("status");
const loginViewElement = document.getElementById("login-view");
const adminViewElement = document.getElementById("admin-view");
const adminNameElement = document.getElementById("admin-name");

const loginButton = document.getElementById("btn-login-google");
const logoutButton = document.getElementById("btn-logout");
const saveButton = document.getElementById("btn-save");

const titleInput = document.getElementById("input-title");
const subtitleInput = document.getElementById("input-subtitle");

// Firestore document reference: collection "pages", document "home".
const homeDocRef = doc(db, "pages", "home");

// Google provider for OAuth sign-in.
const provider = new GoogleAuthProvider();

/**
 * Shows the login view, hiding the admin panel.
 * @param {string} message
 */
function showLogin(message = "Sign in with an authorized account.") {
  statusElement.textContent = message;
  statusElement.className = "";
  loginViewElement.style.display = "block";
  adminViewElement.style.display = "none";
}

/**
 * Shows the admin view for an authorized user and loads Firestore data.
 * @param {import("firebase/auth").User} user
 */
async function showAdmin(user) {
  statusElement.textContent = "Session verified.";
  statusElement.className = "status-ok";

  loginViewElement.style.display = "none";
  adminViewElement.style.display = "block";

  adminNameElement.textContent = user.displayName || user.email || "Admin";

  await loadHomeFromFirestore();
}

/**
 * Reads main_title and main_subtitle from Firestore and fills the inputs.
 */
async function loadHomeFromFirestore() {
  try {
    statusElement.textContent = "Loading page data...";
    statusElement.className = "";

    const snapshot = await getDoc(homeDocRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      titleInput.value = data.main_title || "";
      subtitleInput.value = data.main_subtitle || "";

      statusElement.textContent = "Page data loaded.";
      statusElement.className = "status-ok";
    } else {
      titleInput.value = "Hello, I am Adrián Bernardino";
      subtitleInput.value =
        "0 — 🌲🌱📌🌐☀️🎬🕣💧🔥🌸🍇🪵📡 — ∞";

      statusElement.textContent =
        "Document not found. Default values have been applied.";
      statusElement.className = "status-error";
    }
  } catch (error) {
    console.error("Error loading from Firestore:", error);
    statusElement.textContent = "Error loading page data.";
    statusElement.className = "status-error";
  }
}

/**
 * Saves the current values from the inputs to Firestore.
 */
async function saveHomeToFirestore() {
  try {
    saveButton.disabled = true;
    statusElement.textContent = "Saving changes...";
    statusElement.className = "";

    await setDoc(
      homeDocRef,
      {
        main_title: titleInput.value,
        main_subtitle: subtitleInput.value,
      },
      { merge: true } // Keep other fields if they already exist.
    );

    statusElement.textContent = "Changes saved successfully to Firestore.";
    statusElement.className = "status-ok";
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    statusElement.textContent = "Error saving changes to Firestore.";
    statusElement.className = "status-error";
  } finally {
    saveButton.disabled = false;
  }
}

/**
 * Auth state listener: decides whether to show login or admin panel.
 */
onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      showLogin("Sign in with an authorized account.");
      return;
    }

    const email = user.email || "";
    const isAdmin = ADMIN_EMAILS.includes(email);

    if (!isAdmin) {
      await signOut(auth);
      showLogin("Your account is not authorized to access this panel.");
      return;
    }

    await showAdmin(user);
  },
  (error) => {
    console.error("Auth state error:", error);
    showLogin("Error checking session. Please refresh and try again.");
  }
);

// "Sign in with Google" button.
loginButton.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle the rest.
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Error signing in. Please try again.";
    statusElement.className = "status-error";
  }
});

// "Save changes" button.
saveButton.addEventListener("click", async (event) => {
  event.preventDefault();
  await saveHomeToFirestore();
});

// "Sign out" button.
logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showLogin("Signed out.");
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Error signing out.";
    statusElement.className = "status-error";
  }
});
