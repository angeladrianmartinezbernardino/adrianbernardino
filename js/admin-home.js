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
  collection,       // Para crear/leer la lista de fotos
  addDoc,           // Para añadir registro de foto
  updateDoc,        // Para editar registro
  deleteDoc,        // Para borrar registro
  query,            // Para ordenar lista
  orderBy,          // Para ordenar lista
  onSnapshot,       // Para escuchar cambios en tiempo real
  serverTimestamp   // Para guardar la fecha de subida
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Import Storage helpers.
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

// --- GALLERY CRUD DOM ELEMENTS ---
const uploadFile = document.getElementById("upload-file");
const uploadTitle = document.getElementById("upload-title");
const uploadYear = document.getElementById("upload-year");
const uploadAlbum = document.getElementById("upload-album");
const uploadColor = document.getElementById("upload-color");
const btnUpload = document.getElementById("btn-upload");
const uploadProgress = document.getElementById("upload-progress");
const galleryList = document.getElementById("gallery-list");

// Edit Modal Elements
const editDialog = document.getElementById("edit-dialog");
const editIdInput = document.getElementById("edit-id");
const editTitleInput = document.getElementById("edit-title");
const editYearInput = document.getElementById("edit-year");
const editOrderInput = document.getElementById("edit-order");
const editAlbumInput = document.getElementById("edit-album");
const btnConfirmUpdate = document.getElementById("btn-confirm-update");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// --- STATE ---
let currentDesignData = null; 
let currentContext = "inside"; 

// Firestore references
const homeDocRef = doc(db, "pages", "home");
const designRef = (ctx) => doc(db, "pages", `design_${ctx}`);
const photosCollectionRef = collection(db, "pages", "inside", "inside"); 

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

  // Cargar todo: Contenido, Diseño y Galería
  await Promise.all([
    loadHomeContent(),
    loadDesignData("inside"),
    initGalleryListener()
  ]);
}

// --- 1. CONTENT FUNCTIONS (TEXTS) ---
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
  } catch (error) { console.error("Error loading content:", error); }
}

async function saveHomeContent() {
  try {
    saveContentButton.disabled = true;
    statusElement.textContent = "Saving content...";
    await setDoc(homeDocRef, {
      main_title: titleInput.value,
      main_subtitle: subtitleInput.value,
    }, { merge: true });
    statusElement.textContent = "Content saved.";
    statusElement.className = "status-ok";
  } catch (error) {
    console.error(error);
    statusElement.textContent = "Error saving content.";
    statusElement.className = "status-error";
  } finally {
    saveContentButton.disabled = false;
  }
}

// --- 2. DESIGN FUNCTIONS (LAVA LAMP) ---
async function loadDesignData(context) {
  currentContext = context;
  statusElement.textContent = `Loading design for ${context}...`;
  try {
    const ref = designRef(context);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      currentDesignData = snapshot.data();
    } else {
      try {
        const response = await fetch(`/design/${context}.json`);
        if (response.ok) currentDesignData = await response.json();
        else throw new Error("JSON not found");
      } catch (e) {
        currentDesignData = { default_theme: { background_mode: "deep_ocean" }, albums: {} };
      }
    }
    populateTargetSelect();
    fillDesignForm('default');
  } catch (error) { console.error(error); }
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
    let themeData = (targetKey === 'default') ? currentDesignData.default_theme : (currentDesignData.albums[targetKey] || {});
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
        currentDesignData.default_theme = { ...currentDesignData.default_theme, ...formTheme };
    } else {
        if (currentDesignData.albums[targetKey]) {
            currentDesignData.albums[targetKey] = { ...currentDesignData.albums[targetKey], ...formTheme };
        }
    }
}

async function saveDesign() {
    try {
        saveDesignButton.disabled = true;
        updateCurrentInMemoryData();
        await setDoc(designRef(currentContext), currentDesignData, { merge: true });
        statusElement.textContent = "Design saved.";
        statusElement.className = "status-ok";
    } catch (error) {
        console.error(error);
        statusElement.textContent = "Error saving design.";
        statusElement.className = "status-error";
    } finally {
        saveDesignButton.disabled = false;
    }
}

// --- 3. GALLERY CRUD LOGIC (CORREGIDO) ---

// READ (Real-time List)
function initGalleryListener() {
    const q = query(photosCollectionRef, orderBy("year", "desc"));
    
    onSnapshot(q, (snapshot) => {
        galleryList.innerHTML = ""; 
        if (snapshot.empty) {
            galleryList.innerHTML = "<p class='muted'>No photos found in database.</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Construir URL pública para ver la imagen
            // Usamos la versión standard si existe, si no la original
            const viewPath = data.standard_path || data.original_path;
            const viewUrl = `https://storage.googleapis.com/adrian-bernardino.firebasestorage.app/${viewPath}`;

            const row = document.createElement("div");
            row.style.background = "#020617";
            row.style.border = "1px solid rgba(148,163,184,0.1)";
            row.style.padding = "0.8rem";
            row.style.borderRadius = "8px";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            
            row.innerHTML = `
                <div>
                    <strong style="color: #e5e7eb;">${data.title || "Untitled"}</strong>
                    <div style="font-size:0.8rem; color: #9ca3af; margin-top:0.2rem;">
                        ${data.year} · ${data.album} · Sort: ${data.order || 0}
                    </div>
                    <div style="font-size:0.7rem; color: #555; margin-top:0.2rem; word-break:break-all;">
                        ID: ${id}<br>
                        Path: ${viewPath}
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <a href="${viewUrl}" target="_blank" style="font-size:1.2rem; text-decoration:none;" title="View Image">👁️</a>
                    <button class="btn-edit" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Edit Metadata">✏️</button>
                    <button class="btn-delete" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Delete Permanently">🗑️</button>
                </div>
            `;
            
            row.querySelector(".btn-edit").addEventListener("click", () => openEditModal(id, data));
            row.querySelector(".btn-delete").addEventListener("click", () => handleDelete(id, data));
            
            galleryList.appendChild(row);
        });
    });
}

// CREATE (Upload + Database Entry) - CORREGIDO PARA NOMBRES LIMPIOS
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

    // 1. Limpieza del nombre (remover extensión original .jpg/.png)
    const originalName = file.name; // Ej: foto.jpg
    const lastDotIndex = originalName.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName; // Ej: foto

    // 2. Rutas
    // La original se guarda intacta
    const storageRefOriginal = ref(storage, `image/${originalName}`);
    
    // La predicción WebP usa el nombre limpio + sufijo
    // Resultado: image/webp/foto_2048x2048.webp
    const standardPathPredicted = `image/webp/${nameWithoutExt}_2048x2048.webp`;

    try {
        btnUpload.disabled = true;
        uploadProgress.style.display = "block";
        uploadProgress.textContent = "Uploading original to Storage...";

        // A. Subir a Storage
        await uploadBytes(storageRefOriginal, file);

        uploadProgress.textContent = "Registering in Database...";

        // B. Guardar en Firestore
        await addDoc(photosCollectionRef, {
            title: title,
            year: year,
            album: album,
            color_label: color,
            original_path: `image/${originalName}`,
            standard_path: standardPathPredicted, // Ruta limpia predecida
            order: 0, 
            created_at: serverTimestamp()
        });

        alert("Upload successful! Optimized version processing...");
        
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

// UPDATE
function openEditModal(id, data) {
    editIdInput.value = id;
    editTitleInput.value = data.title || "";
    editYearInput.value = data.year || 0;
    editOrderInput.value = data.order || 0;
    editAlbumInput.value = data.album || "";
    editDialog.showModal();
}

btnCancelEdit.addEventListener("click", () => editDialog.close());

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
    } catch (error) {
        console.error("Update failed", error);
        alert("Failed to update.");
    }
});

// DELETE
async function handleDelete(id, data) {
    if (!confirm(`Are you sure you want to delete "${data.title}"?`)) return;

    try {
        statusElement.textContent = "Deleting...";
        if (data.original_path) {
            const origRef = ref(storage, data.original_path);
            await deleteObject(origRef).catch(e => console.warn("Original not found:", e));
        }
        if (data.standard_path) {
            const stdRef = ref(storage, data.standard_path);
            await deleteObject(stdRef).catch(e => console.warn("Standard not found:", e));
        }
        await deleteDoc(doc(db, "pages", "inside", "inside", id));
        statusElement.textContent = "Delete successful.";
        statusElement.className = "status-ok";
    } catch (error) {
        console.error("Delete failed", error);
        alert("Error deleting: " + error.message);
    }
}

// --- EVENT LISTENERS (Shared) ---
contextSelect.addEventListener("change", (e) => loadDesignData(e.target.value));
targetSelect.addEventListener("change", (e) => fillDesignForm(e.target.value));
[bgModeSelect, speedInput, intensityInput, colorPriInput, colorSecInput, colorAccInput].forEach(input => {
    input.addEventListener("change", () => updateCurrentInMemoryData());
});
saveContentButton.addEventListener("click", (e) => { e.preventDefault(); saveHomeContent(); });
saveDesignButton.addEventListener("click", (e) => { e.preventDefault(); saveDesign(); });

loginButton.addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); } 
  catch (error) { console.error(error); statusElement.textContent = "Login error."; }
});
logoutButton.addEventListener("click", async () => {
  try { await signOut(auth); showLogin("Signed out."); } 
  catch (error) { console.error(error); }
});
onAuthStateChanged(auth, async (user) => {
  if (!user) { showLogin(); return; }
  if (!ADMIN_EMAILS.includes(user.email)) { await signOut(auth); showLogin("Not authorized."); return; }
  await showAdmin(user);
}, (error) => { console.error(error); showLogin("Auth error."); });