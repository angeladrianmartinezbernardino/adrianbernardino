// js/admin-home.js

// Import shared Firestore and Auth instances.
import { db, auth } from "./firebase-setup.js";

// Import Auth helpers.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Import Firestore helpers.
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- CONFIGURATION ---
const ADMIN_EMAILS = [
  "angeladrianmartinezbernardino@gmail.com"
];

// --- DOM ELEMENTS ---
const statusElement = document.getElementById("status");
const loginViewElement = document.getElementById("login-view");
const adminViewElement = document.getElementById("admin-view");
const adminNameElement = document.getElementById("admin-name");

// Content Form
const titleInput = document.getElementById("input-title");
const subtitleInput = document.getElementById("input-subtitle");
const saveContentButton = document.getElementById("btn-save-content");

// Design Form
const contextSelect = document.getElementById("design-context");
const targetSelect = document.getElementById("design-target");
const bgModeSelect = document.getElementById("design-bg-mode");
const speedInput = document.getElementById("design-speed");
const intensityInput = document.getElementById("design-intensity");
const colorPriInput = document.getElementById("design-col-pri");
const colorSecInput = document.getElementById("design-col-sec");
const colorAccInput = document.getElementById("design-col-acc");
const saveDesignButton = document.getElementById("btn-save-design");

// Auth Buttons
const loginButton = document.getElementById("btn-login-google");
const logoutButton = document.getElementById("btn-logout");

// --- STATE ---
// We keep the current design data in memory to edit it before saving
let currentDesignData = null; 
let currentContext = "inside"; // 'inside' or 'outside'

// Firestore references
const homeDocRef = doc(db, "pages", "home");
const designRef = (ctx) => doc(db, "pages", `design_${ctx}`); // pages/design_inside or pages/design_outside

// Provider
const provider = new GoogleAuthProvider();

// --- UI HELPERS ---
function showLogin(message = "Sign in with an authorized account.") {
  statusElement.textContent = message;
  statusElement.className = "";
  loginViewElement.style.display = "block";
  adminViewElement.style.display = "none";
}

async function showAdmin(user) {
  statusElement.textContent = "Session verified.";
  statusElement.className = "status-ok";
  loginViewElement.style.display = "none";
  adminViewElement.style.display = "block";
  adminNameElement.textContent = user.displayName || user.email || "Admin";

  // Load initial data
  await Promise.all([
    loadHomeContent(),
    loadDesignData("inside") // Load inside by default
  ]);
}

// --- CONTENT FUNCTIONS ---

async function loadHomeContent() {
  try {
    const snapshot = await getDoc(homeDocRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      titleInput.value = data.main_title || "";
      subtitleInput.value = data.main_subtitle || "";
    } else {
      titleInput.value = "Hello, I am Adrián Bernardino";
      subtitleInput.value = "0 — ... — ∞";
    }
  } catch (error) {
    console.error("Error loading content:", error);
  }
}

async function saveHomeContent() {
  try {
    saveContentButton.disabled = true;
    statusElement.textContent = "Saving content...";
    await setDoc(homeDocRef, {
      main_title: titleInput.value,
      main_subtitle: subtitleInput.value,
    }, { merge: true });
    statusElement.textContent = "Content saved successfully.";
    statusElement.className = "status-ok";
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Error saving content.";
    statusElement.className = "status-error";
  } finally {
    saveContentButton.disabled = false;
  }
}

// --- DESIGN FUNCTIONS ---

async function loadDesignData(context) {
  currentContext = context;
  statusElement.textContent = `Loading design for ${context}...`;
  
  try {
    const ref = designRef(context);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      currentDesignData = snapshot.data();
    } else {
      // If not in Firestore, try to fetch from JSON file as fallback/init
      try {
        const response = await fetch(`/design/${context}.json`);
        if (response.ok) {
            currentDesignData = await response.json();
            statusElement.textContent = `Loaded initial structure from ${context}.json (not saved to DB yet).`;
        } else {
            throw new Error("JSON not found");
        }
      } catch (e) {
        // Fallback object if everything fails
        currentDesignData = {
            default_theme: { background_mode: "deep_ocean", lava_speed: 50, lava_intensity: 50 },
            albums: {}
        };
      }
    }

    // Populate Target Select (Default + Albums)
    populateTargetSelect();
    // Fill form with 'default' theme initially
    fillDesignForm('default');

  } catch (error) {
    console.error("Error loading design:", error);
    statusElement.textContent = "Error loading design.";
    statusElement.className = "status-error";
  }
}

function populateTargetSelect() {
    targetSelect.innerHTML = '<option value="default">Default Theme</option>';
    
    if (currentDesignData.albums) {
        // Sort albums by slug or key just to be tidy
        Object.values(currentDesignData.albums).forEach(album => {
            const option = document.createElement("option");
            option.value = album.slug;
            option.textContent = `Album: ${album.title || album.slug}`;
            targetSelect.appendChild(option);
        });
    }
}

function fillDesignForm(targetKey) {
    let themeData;

    if (targetKey === 'default') {
        themeData = currentDesignData.default_theme || {};
    } else {
        // Look for the album in the albums object
        const album = currentDesignData.albums[targetKey];
        themeData = album || {}; // In this structure, the album object itself acts as the override container
    }

    // Fill inputs (use defaults if values missing)
    bgModeSelect.value = themeData.background_mode || "deep_ocean";
    speedInput.value = themeData.lava_speed || 50;
    intensityInput.value = themeData.lava_intensity || 50;
    
    // Colors might be nested or flat depending on your JSON. 
    // Assuming flat based on 'use_custom_colors' in JSON provided
    colorPriInput.value = themeData.lava_color_primary || "#000000";
    colorSecInput.value = themeData.lava_color_secondary || "#000000";
    colorAccInput.value = themeData.lava_color_accent || "#000000";
}

function updateCurrentInMemoryData() {
    const targetKey = targetSelect.value;
    
    // Construct theme object from form
    const formTheme = {
        background_mode: bgModeSelect.value,
        lava_speed: parseInt(speedInput.value, 10),
        lava_intensity: parseInt(intensityInput.value, 10),
        use_custom_colors: true, // Force custom if editing
        lava_color_primary: colorPriInput.value,
        lava_color_secondary: colorSecInput.value,
        lava_color_accent: colorAccInput.value
    };

    if (targetKey === 'default') {
        // Update default theme
        currentDesignData.default_theme = { 
            ...currentDesignData.default_theme, 
            ...formTheme 
        };
    } else {
        // Update specific album
        if (currentDesignData.albums[targetKey]) {
            currentDesignData.albums[targetKey] = {
                ...currentDesignData.albums[targetKey],
                ...formTheme
            };
        }
    }
}

async function saveDesign() {
    try {
        saveDesignButton.disabled = true;
        statusElement.textContent = `Saving ${currentContext} design...`;
        
        // 1. Update memory from form
        updateCurrentInMemoryData();

        // 2. Send to Firestore
        const ref = designRef(currentContext);
        
        // We use setDoc without merge:true to ensure structure consistency, 
        // or merge:true if we trust the structure. Let's use merge to be safe.
        await setDoc(ref, currentDesignData, { merge: true });

        statusElement.textContent = "Design saved successfully.";
        statusElement.className = "status-ok";
    } catch (error) {
        console.error(error);
        statusElement.textContent = "Error saving design.";
        statusElement.className = "status-error";
    } finally {
        saveDesignButton.disabled = false;
    }
}

// --- EVENT LISTENERS ---

// 1. Switch Context (Inside <-> Outside)
contextSelect.addEventListener("change", (e) => {
    loadDesignData(e.target.value);
});

// 2. Switch Target (Default <-> Album X)
targetSelect.addEventListener("change", (e) => {
    // Before switching, strictly speaking we should save current form state to memory?
    // For simplicity, we update memory every time user creates a save action, 
    // BUT better UX is to update memory on target switch so changes aren't lost if not saved.
    // Let's NOT auto-save to DB, but auto-update memory variable.
    
    // WARNING: This implies we need to know what the *previous* selection was to save it.
    // To simplify: WE RELOAD data from memory for the new target. 
    // Any unsaved edits to the PREVIOUS target might be lost if we don't capture them.
    // For this version, simplistic approach: Reload form values from memory for selected target.
    fillDesignForm(e.target.value);
});

// 3. Input changes - Update memory immediately? 
// Or just wait for Save? Let's wait for Save for simplicity, 
// BUT changing 'Target' select box will wipe changes. 
// Improved approach: Update memory on change event of inputs.
[bgModeSelect, speedInput, intensityInput, colorPriInput, colorSecInput, colorAccInput].forEach(input => {
    input.addEventListener("change", () => {
        updateCurrentInMemoryData();
    });
});

// 4. Save Buttons
saveContentButton.addEventListener("click", (e) => {
    e.preventDefault();
    saveHomeContent();
});

saveDesignButton.addEventListener("click", (e) => {
    e.preventDefault();
    saveDesign();
});

// 5. Auth
loginButton.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Login error.";
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showLogin("Signed out.");
  } catch (error) {
    console.error(error);
  }
});

// 6. Auth State
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }
  if (!ADMIN_EMAILS.includes(user.email)) {
    await signOut(auth);
    showLogin("Not authorized.");
    return;
  }
  await showAdmin(user);
}, (error) => {
  console.error(error);
  showLogin("Auth error.");
});