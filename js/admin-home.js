// js/admin-home.js
console.log("Admin script loading...");

import { app, db, auth } from "./firebase-setup.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  deleteObject,
  getDownloadURL,
  listAll
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

const storage = getStorage(app);
const ADMIN_EMAILS = ["angeladrianmartinezbernardino@gmail.com"];

// --- DOM ELEMENTS ---
const statusElement = document.getElementById("status");
const loginViewElement = document.getElementById("login-view");
const adminViewElement = document.getElementById("admin-view");
const adminNameElement = document.getElementById("admin-name");
const loginButton = document.getElementById("btn-login-google");
const logoutButton = document.getElementById("btn-logout");

// Edit Modal
const editDialog = document.getElementById("edit-dialog");
const editIdInput = document.getElementById("edit-id");
const editContextInput = document.getElementById("edit-context");
const editTitleInput = document.getElementById("edit-title");
const editYearInput = document.getElementById("edit-year");
const editOrderInput = document.getElementById("edit-order");
const editAlbumInput = document.getElementById("edit-album");
const btnConfirmUpdate = document.getElementById("btn-confirm-update");
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// --- STATE ---
const designData = {
  home: null,
  inside: null,
  outside: null
};

// Provider
const provider = new GoogleAuthProvider();

// --- AUTH FLOW ---
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

  // Initialize all sections
  await Promise.all([
    loadHomeContent(),
    initDesignSection("home"),
    initDesignSection("inside"),
    initDesignSection("outside"),
    initGallerySection("inside"),
    initGallerySection("outside"),
    initSocialMediaSection()
  ]);
}

// --- 1. HOME CONTENT ---
async function loadHomeContent() {
  const titleInput = document.getElementById("home-title");
  const subtitleInput = document.getElementById("home-subtitle");
  const saveBtn = document.getElementById("btn-save-home-content");

  try {
    const docRef = doc(db, "pages", "home");
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      titleInput.value = data.main_title || "";
      subtitleInput.value = data.main_subtitle || "";
    }
  } catch (error) { console.error("Error loading home content:", error); }

  saveBtn.addEventListener("click", async () => {
    try {
      saveBtn.disabled = true;
      await setDoc(doc(db, "pages", "home"), {
        main_title: titleInput.value,
        main_subtitle: subtitleInput.value,
      }, { merge: true });
      alert("Home content saved.");
    } catch (e) { alert("Error saving content: " + e.message); }
    finally { saveBtn.disabled = false; }
  });
}

// --- 1.5 SOCIAL MEDIA ---
function initSocialMediaSection() {
  const iconInput = document.getElementById("social-icon");
  const titleInput = document.getElementById("social-title");
  const urlInput = document.getElementById("social-url");
  const addBtn = document.getElementById("btn-add-social");
  const listElement = document.getElementById("social-list");

  // Listen for changes
  onSnapshot(doc(db, "pages", "home"), (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    const links = data.social_links || [];

    listElement.innerHTML = "";
    if (links.length === 0) {
      listElement.innerHTML = "<p class='muted'>No social links.</p>";
    } else {
      links.forEach((link, index) => {
        const row = document.createElement("div");
        row.style.background = "#020617";
        row.style.border = "1px solid rgba(148,163,184,0.1)";
        row.style.padding = "0.5rem 0.8rem";
        row.style.borderRadius = "8px";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <span style="font-size:1.2rem;">${link.icon || "🔗"}</span>
            <div>
              <div style="font-size:0.9rem; color:#e5e7eb;">${link.title}</div>
              <div style="font-size:0.75rem; color:#9ca3af;">${link.url}</div>
            </div>
          </div>
          <button class="btn-delete-social" style="background:none; border:none; cursor:pointer; opacity:0.6;" title="Delete">❌</button>
        `;

        row.querySelector(".btn-delete-social").addEventListener("click", async () => {
          if (!confirm("Delete this link?")) return;
          const newLinks = [...links];
          newLinks.splice(index, 1);
          await updateDoc(doc(db, "pages", "home"), { social_links: newLinks });
        });

        listElement.appendChild(row);
      });
    }
  });

  // Add Handler
  addBtn.addEventListener("click", async () => {
    const icon = iconInput.value.trim();
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();

    if (!title || !url) {
      alert("Title and URL are required.");
      return;
    }

    try {
      addBtn.disabled = true;
      const docRef = doc(db, "pages", "home");
      const snapshot = await getDoc(docRef);
      const currentLinks = snapshot.exists() ? (snapshot.data().social_links || []) : [];

      const newLink = { icon, title, url };
      await updateDoc(docRef, { social_links: [...currentLinks, newLink] });

      iconInput.value = "";
      titleInput.value = "";
      urlInput.value = "";
    } catch (e) {
      alert("Error adding link: " + e.message);
    } finally {
      addBtn.disabled = false;
    }
  });
}

// --- 2. DESIGN SECTIONS ---
async function initDesignSection(context) {
  const saveBtn = document.getElementById(`btn-save-design-${context}`);
  const targetSelect = document.getElementById(`design-target-${context}`);

  // Load data
  try {
    const docRef = doc(db, "pages", `design_${context}`);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      designData[context] = snapshot.data();
    } else {
      designData[context] = { default_theme: { background_mode: "deep_ocean" }, albums: {} };
    }
  } catch (e) {
    console.error(`Error loading design for ${context}:`, e);
    designData[context] = { default_theme: { background_mode: "deep_ocean" }, albums: {} };
  }

  // Populate Target Select (if applicable)
  if (targetSelect && designData[context].albums) {
    // Keep default option
    targetSelect.innerHTML = '<option value="default">Default Theme</option>';
    Object.values(designData[context].albums).forEach(album => {
      const option = document.createElement("option");
      option.value = album.slug;
      option.textContent = `Album: ${album.title || album.slug}`;
      targetSelect.appendChild(option);
    });

    // Listen for target change to refill form
    targetSelect.addEventListener("change", () => fillDesignForm(context));
  }

  // Fill form initially
  fillDesignForm(context);

  // Save Listener
  saveBtn.addEventListener("click", () => saveDesign(context));
}

function fillDesignForm(context) {
  const targetSelect = document.getElementById(`design-target-${context}`);
  const targetKey = targetSelect ? targetSelect.value : "default";

  const data = designData[context];
  const theme = (targetKey === "default") ? data.default_theme : (data.albums?.[targetKey] || {});

  // Elements
  const bgMode = document.getElementById(`design-bg-mode-${context}`);
  const speed = document.getElementById(`design-speed-${context}`);
  const intensity = document.getElementById(`design-intensity-${context}`);
  const colPri = document.getElementById(`design-col-pri-${context}`);
  const colSec = document.getElementById(`design-col-sec-${context}`);
  const colAcc = document.getElementById(`design-col-acc-${context}`);

  if (bgMode) bgMode.value = theme.background_mode || "deep_ocean";
  if (speed) speed.value = theme.lava_speed || 50;
  if (intensity) intensity.value = theme.lava_intensity || 50;
  if (colPri) colPri.value = theme.lava_color_primary || "#000000";
  if (colSec) colSec.value = theme.lava_color_secondary || "#000000";
  if (colAcc) colAcc.value = theme.lava_color_accent || "#000000";
}

async function saveDesign(context) {
  const targetSelect = document.getElementById(`design-target-${context}`);
  const targetKey = targetSelect ? targetSelect.value : "default";

  // Read values
  const bgMode = document.getElementById(`design-bg-mode-${context}`).value;
  const speed = parseInt(document.getElementById(`design-speed-${context}`).value) || 50;
  const intensity = parseInt(document.getElementById(`design-intensity-${context}`).value) || 50;
  const colPri = document.getElementById(`design-col-pri-${context}`).value;
  const colSec = document.getElementById(`design-col-sec-${context}`).value;
  const colAcc = document.getElementById(`design-col-acc-${context}`).value;

  const newTheme = {
    background_mode: bgMode,
    lava_speed: speed,
    lava_intensity: intensity,
    use_custom_colors: true,
    lava_color_primary: colPri,
    lava_color_secondary: colSec,
    lava_color_accent: colAcc
  };

  // Update memory
  if (targetKey === "default") {
    designData[context].default_theme = { ...designData[context].default_theme, ...newTheme };
  } else {
    if (!designData[context].albums) designData[context].albums = {};
    if (!designData[context].albums[targetKey]) designData[context].albums[targetKey] = {};
    designData[context].albums[targetKey] = { ...designData[context].albums[targetKey], ...newTheme };
  }

  // Save to DB
  try {
    await setDoc(doc(db, "pages", `design_${context}`), designData[context], { merge: true });
    alert(`Design for ${context} (${targetKey}) saved.`);
  } catch (e) {
    alert("Error saving design: " + e.message);
  }
}

// --- 3. GALLERY CRUD ---
function initGallerySection(context) {
  const listElement = document.getElementById(`gallery-list-${context}`);
  const uploadBtn = document.getElementById(`btn-upload-${context}`);
  const syncBtn = document.getElementById(`btn-sync-${context}`);

  // 1. Listen for Real-time Updates
  const colRef = collection(db, "pages", context, context);
  const q = query(colRef, orderBy("year", "desc"));

  onSnapshot(q, (snapshot) => {
    listElement.innerHTML = "";
    if (snapshot.empty) {
      listElement.innerHTML = "<p class='muted'>No photos found.</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const viewPath = data.standard_path || data.original_path;

      const row = document.createElement("div");
      row.style.background = "#020617";
      row.style.border = "1px solid rgba(148,163,184,0.1)";
      row.style.padding = "0.8rem";
      row.style.borderRadius = "8px";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:1rem;">
            <img class="row-thumb" style="height:60px; width:auto; max-width:120px; object-fit:contain; border-radius:4px; background:#1a1d26; display:none;" alt="Thumb" />
            <div>
                <strong style="color: #e5e7eb;">${data.title || "Untitled"}</strong>
                <div style="font-size:0.8rem; color: #9ca3af; margin-top:0.2rem;">
                    ${data.year} · ${data.album} · Sort: ${data.order || 0}
                </div>
                <div style="font-size:0.7rem; color: #555; margin-top:0.2rem; word-break:break-all;">
                    ID: ${id}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.5rem;">
            <a href="#" target="_blank" class="btn-view-link" style="font-size:1.2rem; text-decoration:none; opacity: 0.5; pointer-events: none;" title="Loading...">⏳</a>
            <button class="btn-edit" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Edit">✏️</button>
            <button class="btn-delete" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Delete">🗑️</button>
        </div>
      `;

      // Handlers
      row.querySelector(".btn-edit").addEventListener("click", () => openEditModal(id, data, context));
      row.querySelector(".btn-delete").addEventListener("click", () => handleDelete(id, data, context));

      listElement.appendChild(row);

      // Async Image Load
      if (viewPath) {
        getDownloadURL(ref(storage, viewPath))
          .then((url) => {
            const link = row.querySelector(".btn-view-link");
            const thumb = row.querySelector(".row-thumb");
            if (link) {
              link.href = url;
              link.textContent = "👁️";
              link.style.opacity = "1";
              link.style.pointerEvents = "auto";
            }
            if (thumb) {
              thumb.src = url;
              thumb.style.display = "block";
            }
          })
          .catch(e => {
            // Fallback to original if standard fails
            if (data.original_path && viewPath !== data.original_path) {
              getDownloadURL(ref(storage, data.original_path))
                .then(url => {
                  const link = row.querySelector(".btn-view-link");
                  const thumb = row.querySelector(".row-thumb");
                  if (link) { link.href = url; link.textContent = "👁️"; link.style.opacity = "1"; link.style.pointerEvents = "auto"; }
                  if (thumb) { thumb.src = url; thumb.style.display = "block"; }
                })
                .catch(err => console.warn("Thumb load failed", err));
            }
          });
      }
    });
  });

  // 2. Upload Handler
  uploadBtn.addEventListener("click", () => handleUpload(context));

  // 3. Sync Handler
  if (syncBtn) {
    syncBtn.addEventListener("click", () => handleSync(context));
  }
}

async function handleSync(context) {
  const syncBtn = document.getElementById(`btn-sync-${context}`);
  try {
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing...";

    // 1. List all files in 'image/'
    const listRef = ref(storage, 'image/');
    const res = await listAll(listRef);
    const storageFiles = res.items; // Array of Reference

    // 2. Get all existing docs in current context
    const colRef = collection(db, "pages", context, context);
    const snapshot = await getDocs(colRef);
    const existingPaths = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.original_path) existingPaths.add(data.original_path);
    });

    // 3. Find missing and add them
    let addedCount = 0;
    for (const itemRef of storageFiles) {
      const fullPath = itemRef.fullPath;
      if (!existingPaths.has(fullPath)) {
        // Add to Firestore
        const name = itemRef.name;
        const lastDot = name.lastIndexOf('.');
        const nameNoExt = lastDot !== -1 ? name.substring(0, lastDot) : name;

        // Optimistic standard path
        const standardPath = `image/webp/${nameNoExt}_2048x2048.webp`;

        await addDoc(colRef, {
          title: nameNoExt,
          year: new Date().getFullYear(), // Default to current year
          album: "imported",
          color_label: "",
          original_path: fullPath,
          standard_path: standardPath,
          order: 0,
          created_at: serverTimestamp()
        });
        addedCount++;
      }
    }

    alert(`Sync complete. Imported ${addedCount} new images.`);

  } catch (e) {
    console.error(e);
    alert("Sync failed: " + e.message);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = "🔄 Sync GCS";
  }
}

async function handleUpload(context) {
  const fileInput = document.getElementById(`upload-file-${context}`);
  const titleInput = document.getElementById(`upload-title-${context}`);
  const yearInput = document.getElementById(`upload-year-${context}`);
  const albumInput = document.getElementById(`upload-album-${context}`);
  const colorInput = document.getElementById(`upload-color-${context}`);
  const progress = document.getElementById(`upload-progress-${context}`);
  const btn = document.getElementById(`btn-upload-${context}`);

  const file = fileInput.files[0];
  if (!file) { alert("Select a file."); return; }

  try {
    btn.disabled = true;
    progress.style.display = "block";
    progress.textContent = "Uploading...";

    const originalName = file.name;
    const lastDot = originalName.lastIndexOf('.');
    const nameNoExt = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;

    const storageRef = ref(storage, `image/${originalName}`);
    await uploadBytes(storageRef, file);

    const standardPath = `image/webp/${nameNoExt}_2048x2048.webp`;

    await addDoc(collection(db, "pages", context, context), {
      title: titleInput.value || "Untitled",
      year: parseInt(yearInput.value) || new Date().getFullYear(),
      album: albumInput.value || "default",
      color_label: colorInput.value || "",
      original_path: `image/${originalName}`,
      standard_path: standardPath,
      order: 0,
      created_at: serverTimestamp()
    });

    alert("Uploaded successfully.");
    fileInput.value = "";
    titleInput.value = "";
  } catch (e) {
    alert("Upload failed: " + e.message);
  } finally {
    btn.disabled = false;
    progress.style.display = "none";
  }
}

// --- 4. EDIT / DELETE ---
function openEditModal(id, data, context) {
  editIdInput.value = id;
  editContextInput.value = context;
  editTitleInput.value = data.title || "";
  editYearInput.value = data.year || 0;
  editOrderInput.value = data.order || 0;
  editAlbumInput.value = data.album || "";
  editDialog.showModal();
}

btnCancelEdit.addEventListener("click", () => editDialog.close());

btnConfirmUpdate.addEventListener("click", async () => {
  const id = editIdInput.value;
  const context = editContextInput.value;
  if (!id || !context) return;

  try {
    await updateDoc(doc(db, "pages", context, context, id), {
      title: editTitleInput.value,
      year: parseInt(editYearInput.value),
      order: parseInt(editOrderInput.value),
      album: editAlbumInput.value
    });
    editDialog.close();
  } catch (e) {
    alert("Update failed: " + e.message);
  }
});

async function handleDelete(id, data, context) {
  if (!confirm(`Delete "${data.title}"?`)) return;
  try {
    if (data.original_path) await deleteObject(ref(storage, data.original_path)).catch(e => console.warn(e));
    if (data.standard_path) await deleteObject(ref(storage, data.standard_path)).catch(e => console.warn(e));

    await deleteDoc(doc(db, "pages", context, context, id));
  } catch (e) {
    alert("Delete failed: " + e.message);
  }
}

// --- AUTH LISTENERS ---
loginButton.addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { console.error(e); }
});
logoutButton.addEventListener("click", async () => {
  try { await signOut(auth); showLogin("Signed out."); }
  catch (e) { console.error(e); }
});
onAuthStateChanged(auth, async (user) => {
  if (!user) { showLogin(); return; }
  if (!ADMIN_EMAILS.includes(user.email)) { await signOut(auth); showLogin("Not authorized."); return; }
  await showAdmin(user);
}, (e) => { console.error(e); showLogin("Auth error."); });