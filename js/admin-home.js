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