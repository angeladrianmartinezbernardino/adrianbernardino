// js/inside-gallery.js

import { app, db } from "./firebase-setup.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,          // <-- NEW
  onSnapshot,   // <-- NEW
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Import Storage helpers.
import {
  getStorage,
  ref,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Create a shared Storage instance using the existing app.
const storage = getStorage(app);

// Keep all loaded photos in memory for filtering.
let allPhotos = [];
let currentModalPhoto = null;

/**
 * Helper to download an image as a blob, so it appears to come from the site
 * rather than redirecting to Firebase Storage.
 */
async function forceDownload(url, filename, buttonElement) {
  let originalText = "";
  if (buttonElement) {
    originalText = buttonElement.textContent;
    buttonElement.textContent = "Downloading...";
    buttonElement.disabled = true;
    buttonElement.style.opacity = "0.7";
    buttonElement.style.cursor = "wait";
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not ok");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "download.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Download failed:", error);
    // Fallback: open in new tab
    window.open(url, "_blank");
  } finally {
    if (buttonElement) {
      buttonElement.textContent = originalText;
      buttonElement.disabled = false;
      buttonElement.style.opacity = "";
      buttonElement.style.cursor = "";
    }
  }
}

// --- DESIGN LOGIC ---

// Reference to Inside design document
const designRef = doc(db, "pages", "design_inside");

function applyTheme(theme) {
  if (!theme) return;

  const root = document.documentElement;

  // Apply colors
  if (theme.lava_color_primary) root.style.setProperty("--lava-color-primary", theme.lava_color_primary);
  if (theme.lava_color_secondary) root.style.setProperty("--lava-color-secondary", theme.lava_color_secondary);
  if (theme.lava_color_accent) root.style.setProperty("--lava-color-accent", theme.lava_color_accent);

  // Apply speed (optional, affects future animations)
  if (theme.lava_speed) root.style.setProperty("--lava-speed", theme.lava_speed + "s");
}

// Listen for real-time changes
onSnapshot(designRef, (snapshot) => {
  if (snapshot.exists()) {
    const data = snapshot.data();
    // Apply default theme globally for now
    const theme = data.default_theme || {};
    applyTheme(theme);
    console.log("🎨 Design theme updated:", theme.background_mode);
  }
});

/**
 * Initializes the gallery once the DOM is ready.
 */
window.addEventListener("DOMContentLoaded", () => {
  const gridElement = document.getElementById("gallery-grid");
  const filtersContainer = document.getElementById("album-filters");

  const modalElement = document.getElementById("photo-modal");
  const modalImage = document.getElementById("modal-image");
  const modalTitle = document.getElementById("modal-title");
  const modalMeta = document.getElementById("modal-meta");
  const modalViewBtn = document.getElementById("modal-view-btn");
  const modalDownloadLink = document.getElementById("modal-download-link");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  if (!gridElement) {
    console.error("Gallery grid element not found.");
    return;
  }

  // Load photos from Firestore and render them.
  loadPhotosFromFirestore()
    .then((photos) => {
      allPhotos = photos;
      renderPhotos(gridElement, allPhotos);
    })
    .catch((error) => {
      console.error("Error loading photos:", error);
      gridElement.innerHTML = "<p>Failed to load photos.</p>";
    });

  // Filter buttons (album chips).
  if (filtersContainer) {
    filtersContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.dataset.album) return;

      const albumSlug = target.dataset.album;

      // Toggle active class.
      const buttons = filtersContainer.querySelectorAll(".filter-btn");
      buttons.forEach((btn) => btn.classList.remove("is-active"));
      target.classList.add("is-active");

      // Apply filtering.
      const filtered =
        albumSlug === "all"
          ? allPhotos
          : allPhotos.filter((photo) => photo.album === albumSlug);

      renderPhotos(gridElement, filtered);
    });
  }

  /**
   * Opens the modal to focus on a single photo.
   * @param {object} photo - Photo object with URLs and metadata.
   */
  function openModal(photo) {
    modalImage.src = photo.standardUrl;
    modalImage.alt = photo.title || "";

    modalTitle.textContent = photo.title || "Untitled photo";
    const metaParts = [];
    if (photo.year) metaParts.push(String(photo.year));
    if (photo.colorLabel) metaParts.push(photo.colorLabel);
    if (photo.album) metaParts.push(photo.album);
    modalMeta.textContent = metaParts.join(" · ");

    modalMeta.textContent = metaParts.join(" · ");

    // We don't set href anymore since it's a button for fullscreen
    // modalViewLink.href = photo.standardUrl; 

    // We'll handle the download click separately, but keep href as a fallback/hint
    modalDownloadLink.href = photo.originalUrl;
    currentModalPhoto = photo;

    modalElement.classList.add("open");
  }

  /**
   * Closes the photo modal.
   */
  function closeModal() {
    modalElement.classList.remove("open");
  }

  // Close button.
  modalCloseBtn?.addEventListener("click", () => {
    closeModal();
  });

  // Close when clicking outside the card.
  modalElement.addEventListener("click", (event) => {
    if (event.target === modalElement) {
      closeModal();
    }
  });

  // Esc key.
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalElement.classList.contains("open")) {
      closeModal();
    }
  });

  // Handle modal view (fullscreen) click
  if (modalViewBtn) {
    modalViewBtn.addEventListener("click", () => {
      if (modalImage && modalImage.src) {
        if (modalImage.requestFullscreen) {
          modalImage.requestFullscreen();
        } else if (modalImage.webkitRequestFullscreen) { /* Safari */
          modalImage.webkitRequestFullscreen();
        } else if (modalImage.msRequestFullscreen) { /* IE11 */
          modalImage.msRequestFullscreen();
        }
      }
    });
  }

  /**
   * Renders a list of photos into the gallery grid.
   * @param {HTMLElement} container
   * @param {Array} photos
   */
  function renderPhotos(container, photos) {
    container.innerHTML = "";

    if (!photos.length) {
      container.innerHTML =
        "<p style='opacity:0.8; font-size:0.85rem;'>No photos to display for this filter yet.</p>";
      return;
    }

    photos.forEach((photo) => {
      const card = document.createElement("article");
      card.className = "photo-card";

      const img = document.createElement("img");
      img.className = "photo-thumb";
      img.src = photo.standardUrl;
      img.alt = photo.title || "";

      // Overlay container.
      const overlay = document.createElement("div");
      overlay.className = "photo-overlay";

      const meta = document.createElement("div");
      meta.className = "photo-meta";
      meta.textContent = [photo.year, photo.colorLabel]
        .filter(Boolean)
        .join(" · ");

      const title = document.createElement("div");
      title.className = "photo-title";
      title.textContent = photo.title || "";

      const actions = document.createElement("div");
      actions.className = "photo-actions";

      const viewButton = document.createElement("button");
      viewButton.className = "btn-view";
      viewButton.type = "button";
      viewButton.textContent = "View";

      const downloadLink = document.createElement("a");
      downloadLink.className = "btn-download";
      downloadLink.href = photo.originalUrl;
      downloadLink.textContent = "Download";
      downloadLink.download = "";
      downloadLink.target = "_blank";
      downloadLink.rel = "noopener";

      // Clicking the whole card also opens the modal.
      card.addEventListener("click", () => openModal(photo));

      // Prevent card click when pressing "Download" (so it does not re-open modal).
      downloadLink.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const filename = photo.title
          ? photo.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".jpg"
          : "photo.jpg";
        forceDownload(photo.originalUrl, filename, downloadLink);
      });

      viewButton.addEventListener("click", (event) => {
        event.stopPropagation();
        openModal(photo);
      });

      actions.appendChild(viewButton);
      actions.appendChild(downloadLink);

      overlay.appendChild(meta);
      overlay.appendChild(title);
      overlay.appendChild(actions);

      card.appendChild(img);
      card.appendChild(overlay);

      container.appendChild(card);
    });
  }
});

/**
 * Loads all photos for /inside from Firestore and resolves their Storage URLs.
 * Firestore collection: inside_photos
 * Required fields:
 *   album, color_label, year, title, standard_path, original_path, order
 * @returns {Promise<Array>}
 */
async function loadPhotosFromFirestore() {
  const photosRef = collection(db, "pages", "inside", "inside");
  const q = query(photosRef, orderBy("year", "asc"), orderBy("order", "asc"));

  try {
    const snapshot = await getDocs(q);
    const photos = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      try {
        const pathForStandard = data.standard_path || data.original_path;

        const standardRef = ref(storage, pathForStandard);
        const originalRef = ref(storage, data.original_path);

        // Fetch URLs safely. If standard fails, fallback to original.
        let standardUrl, originalUrl;
        try {
          originalUrl = await getDownloadURL(originalRef);
        } catch (e) {
          console.warn(`Missing original file for ${docSnap.id}:`, data.original_path);
          continue; // Skip if original is missing
        }

        try {
          standardUrl = await getDownloadURL(standardRef);
        } catch (e) {
          // Fallback to original if standard is missing
          standardUrl = originalUrl;
        }

        photos.push({
          id: docSnap.id,
          album: data.album || "unknown",
          colorLabel: data.color_label || "",
          year: data.year || null,
          title: data.title || "",
          standardUrl,
          originalUrl,
          order: data.order || 0,
        });
      } catch (err) {
        console.warn(`Error loading photo ${docSnap.id}:`, err);
      }
    }
    return photos;
  } catch (error) {
    console.error("Critical error in Firestore:", error);
    throw error;
  }
}
