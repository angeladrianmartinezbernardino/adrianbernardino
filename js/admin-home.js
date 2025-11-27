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
  collection,       // <-- Nuevo para CRUD
  addDoc,           // <-- Nuevo para CRUD
  updateDoc,        // <-- Nuevo para CRUD
  deleteDoc,        // <-- Nuevo para CRUD
  query,            // <-- Nuevo para CRUD
  orderBy,          // <-- Nuevo para CRUD
  onSnapshot,       // <-- Ya existía, pero se usa también para la galería
  serverTimestamp   // <-- Nuevo para fechas
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Import Storage helpers (Nuevo para subida/borrado de imágenes).
import {
    getStorage,
    ref,
    uploadBytes,
    deleteObject
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Inicializar Storage
const storage = getStorage();

// --- CONFIGURATION ---
const ADMIN_EMAILS = [
  "angeladrianmartinezbernardino@gmail.com"
];

// --- DOM ELEMENTS ---
// General
const statusElement = document.getElementById("status");
const loginViewElement = document.getElementById("login-view");
const adminViewElement = document.getElementById("admin-view");
const adminNameElement = document.getElementById("admin-name");
const loginButton = document.getElementById("btn-login-google");
const logoutButton = document.getElementById("btn-logout");

// Content Form (Home Texts)
const titleInput = document.getElementById("input-title");
const subtitleInput = document.getElementById("input-subtitle");
const saveContentButton = document.getElementById("btn-save-content");

// Design Form (Lava Lamp)
const contextSelect = document.getElementById("design-context");
const targetSelect = document.getElementById("design-target");
const bgModeSelect = document.getElementById("design-bg-mode");
const speedInput = document.getElementById("design-speed");
const intensityInput = document.getElementById("design-intensity");
const colorPriInput = document.getElementById("design-col-pri");
const colorSecInput = document.getElementById("design-col-sec");
const colorAccInput = document.getElementById("design-col-acc");
const saveDesignButton = document.getElementById("btn-save-design");

// --- GALLERY CRUD DOM ELEMENTS (NUEVO) ---
const uploadFile = document.getElementById("upload-file");
const uploadTitle = document.getElementById("upload-title");
const uploadYear = document.getElementById("upload-year");
const uploadAlbum = document.getElementById("upload-album");
const uploadColor = document.getElementById("upload-color");
const btnUpload = document.getElementById("btn-upload");
const uploadProgress = document.getElementById("upload-progress");
const galleryList = document.getElementById("gallery-list");

// Edit Modal Elements (NUEVO)
const editDialog = document.getElementById("edit-dialog");
const editIdInput = document.getElementById("edit-id");
const editTitleInput = document.getElementById("edit-title");
const editYearInput = document.getElementById("edit-year");
const editOrderInput = document.getElementById("edit-order");
const editAlbumInput = document.getElementById("edit-album");
const btnConfirmUpdate = document.getElementById("btn-confirm-update");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// --- STATE ---
// We keep the current design data in memory to edit it before saving
let currentDesignData = null; 
let currentContext = "inside"; // 'inside' or 'outside'

// Firestore references
const homeDocRef = doc(db, "pages", "home");
const designRef = (ctx) => doc(db, "pages", `design_${ctx}`); // pages/design_inside or pages/design_outside
const photosCollectionRef = collection(db, "pages", "inside", "inside"); // Referencia a la colección de fotos

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

  // Load initial data (Content + Design + Gallery List)
  await Promise.all([
    loadHomeContent(),
    loadDesignData("inside"), // Load inside design by default
    initGalleryListener()     // <-- Iniciar el listener del CRUD
  ]);
}

// --- CONTENT FUNCTIONS (TEXTS) ---

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

// --- DESIGN FUNCTIONS (LAVA LAMP) ---

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
        const album = currentDesignData.albums[targetKey];
        themeData = album || {}; 
    }

    bgModeSelect.value = themeData.background_mode || "deep_ocean";
    speedInput.value = themeData.lava_speed || 50;
    intensityInput.value = themeData.lava_intensity || 50;
    
    colorPriInput.value = themeData.lava_color_primary || "#000000";
    colorSecInput.value = themeData.lava_color_secondary || "#000000";
    colorAccInput.value = themeData.lava_color_accent || "#000000";
}

function updateCurrentInMemoryData() {
    const targetKey = targetSelect.value;
    
    const formTheme = {
        background_mode: bgModeSelect.value,
        lava_speed: parseInt(speedInput.value, 10),
        lava_intensity: parseInt(intensityInput.value, 10),
        use_custom_colors: true, 
        lava_color_primary: colorPriInput.value,
        lava_color_secondary: colorSecInput.value,
        lava_color_accent: colorAccInput.value
    };

    if (targetKey === 'default') {
        currentDesignData.default_theme = { 
            ...currentDesignData.default_theme, 
            ...formTheme 
        };
    } else {
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
        
        updateCurrentInMemoryData();
        const ref = designRef(currentContext);
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

// ======================================================
// === NEW: GALLERY CRUD LOGIC (The Core Request) ===
// ======================================================

// 1. READ (Real-time List)
function initGalleryListener() {
    // Ordenamos por año descendente para ver lo más nuevo primero
    const q = query(photosCollectionRef, orderBy("year", "desc"));
    
    onSnapshot(q, (snapshot) => {
        galleryList.innerHTML = ""; // Limpiar lista
        if (snapshot.empty) {
            galleryList.innerHTML = "<p class='muted'>No photos found in database.</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Construimos la fila para cada foto
            const row = document.createElement("div");
            row.style.background = "#020617";
            row.style.border = "1px solid rgba(148,163,184,0.1)";
            row.style.padding = "0.8rem";
            row.style.borderRadius = "8px";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            
            // URL para "View in browser". Si standard_path existe, usamos esa (asumimos acceso público o token gestionado por Storage)
            // Nota: Para acceso directo simple, usamos la URL base de storage.
            const viewPath = data.standard_path || data.original_path;
            const viewUrl = `https://storage.googleapis.com/adrian-bernardino.firebasestorage.app/${viewPath}`;

            row.innerHTML = `
                <div>
                    <strong style="color: #e5e7eb;">${data.title || "Untitled"}</strong>
                    <div style="font-size:0.8rem; color: #9ca3af; margin-top:0.2rem;">
                        ${data.year} · ${data.album} · Sort: ${data.order || 0}
                    </div>
                    <div style="font-size:0.7rem; color: #555; margin-top:0.2rem; word-break:break-all;">
                        ID: ${id}
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <a href="${viewUrl}" 
                       target="_blank" 
                       style="font-size:1.2rem; text-decoration:none;" 
                       title="View Image">👁️</a>
                       
                    <button class="btn-edit" data-id="${id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Edit Metadata">✏️</button>
                    
                    <button class="btn-delete" data-id="${id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Delete Permanently">🗑️</button>
                </div>
            `;
            
            // Asignar eventos a los botones generados dinámicamente
            // (Usamos closures para pasar 'data' y 'id' de forma segura)
            const btnEdit = row.querySelector(".btn-edit");
            btnEdit.addEventListener("click", () => openEditModal(id, data));

            const btnDelete = row.querySelector(".btn-delete");
            btnDelete.addEventListener("click", () => handleDelete(id, data));
            
            galleryList.appendChild(row);
        });
    });
}

// 2. CREATE (Upload + Database Entry)
btnUpload.addEventListener("click", async () => {
    const file = uploadFile.files[0];
    if (!file) {
        alert("Please select a file.");
        return;
    }

    const title = uploadTitle.value || "Untitled";
    const year = parseInt(uploadYear.value) || new Date().getFullYear();
    const album = uploadAlbum.value || "daily";
    const color = uploadColor.value || "";

    // Upload Paths logic based on Report v2
    // Original goes to: image/filename.ext
    const storageRefOriginal = ref(storage, `image/${file.name}`);
    
    // Prediction of WebP path generated by extension: image/webp/filename_2048x2048.webp
    // Nota: La extensión suele añadir _2048x2048.webp al nombre original.
    const standardPathPredicted = `image/webp/${file.name}_2048x2048.webp`;

    try {
        btnUpload.disabled = true;
        uploadProgress.style.display = "block";
        uploadProgress.textContent = "Uploading original to Storage...";

        // A. Upload to Storage
        await uploadBytes(storageRefOriginal, file);

        uploadProgress.textContent = "Registering in Database...";

        // B. Add to Firestore
        await addDoc(photosCollectionRef, {
            title: title,
            year: year,
            album: album,
            color_label: color,
            original_path: `image/${file.name}`,
            standard_path: standardPathPredicted, // Será válido cuando la extensión termine
            order: 0, 
            created_at: serverTimestamp()
        });

        alert("Upload successful! The optimized version will appear shortly.");
        
        // Reset form
        uploadFile.value = "";
        uploadTitle.value = "";
    } catch (error) {
        console.error("Upload failed:", error);
        alert("Error during upload: " + error.message);
    } finally {
        btnUpload.disabled = false;
        uploadProgress.style.display = "none";
    }
});

// 3. UPDATE (Edit Metadata)
function openEditModal(id, data) {
    editIdInput.value = id;
    editTitleInput.value = data.title || "";
    editYearInput.value = data.year || 0;
    editOrderInput.value = data.order || 0;
    editAlbumInput.value = data.album || "";
    
    editDialog.showModal();
}

btnCancelEdit.addEventListener("click", () => {
    editDialog.close();
});

btnConfirmUpdate.addEventListener("click", async () => {
    const id = editIdInput.value;
    if (!id) return;

    try {
        const docRef = doc(db, "pages", "inside", "inside", id);
        await updateDoc(docRef, {
            title: editTitleInput.value,
            year: parseInt(editYearInput.value),
            order: parseInt(editOrderInput.value),
            album: editAlbumInput.value
        });
        editDialog.close();
        // No necesitamos alertar éxito, el listener actualizará la lista automáticamente
    } catch (error) {
        console.error("Update failed", error);
        alert("Failed to update.");
    }
});

// 4. DELETE (Remove from DB + Storage)
async function handleDelete(id, data) {
    if (!confirm(`Are you sure you want to delete "${data.title}"? This cannot be undone.`)) return;

    try {
        statusElement.textContent = "Deleting...";

        // A. Delete Original from Storage
        if (data.original_path) {
            const origRef = ref(storage, data.original_path);
            await deleteObject(origRef).catch(e => console.warn("Original file not found or already deleted:", e));
        }

        // B. Delete Standard/WebP from Storage
        if (data.standard_path) {
            const stdRef = ref(storage, data.standard_path);
            await deleteObject(stdRef).catch(e => console.warn("Standard file not found:", e));
        }

        // C. Delete Document from Firestore
        await deleteDoc(doc(db, "pages", "inside", "inside", id));
        
        statusElement.textContent = "Delete successful.";
        statusElement.className = "status-ok";

    } catch (error) {
        console.error("Delete failed", error);
        statusElement.textContent = "Error deleting.";
        statusElement.className = "status-error";
        alert("Error deleting: " + error.message);
    }
}

// --- EVENT LISTENERS (EXISTING) ---

// 1. Switch Context (Inside <-> Outside)
contextSelect.addEventListener("change", (e) => {
    loadDesignData(e.target.value);
});

// 2. Switch Target (Default <-> Album X)
targetSelect.addEventListener("change", (e) => {
    fillDesignForm(e.target.value);
});

// 3. Input changes
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