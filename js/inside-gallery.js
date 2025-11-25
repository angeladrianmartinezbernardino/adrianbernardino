// js/inside-gallery.js

// Import shared Firebase app and Firestore instance.
import { app, db } from "./firebase-setup.js";

// Import Firestore helpers.
import {
  collection,
  getDocs,
  query,
  orderBy,
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
  const modalViewLink = document.getElementById("modal-view-link");
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

    modalViewLink.href = photo.standardUrl;
    modalDownloadLink.href = photo.originalUrl;

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
  const photosRef = collection(db, "inside_photos");

  // You can adjust this query (by year, order, etc.) later.
  const q = query(photosRef, orderBy("year", "asc"), orderBy("order", "asc"));
  const snapshot = await getDocs(q);

  const photos = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Create Storage references for standard and original paths.
    const standardRef = ref(storage, data.standard_path);
    const originalRef = ref(storage, data.original_path);

    // Resolve public URLs for both versions.
    const [standardUrl, originalUrl] = await Promise.all([
      getDownloadURL(standardRef),
      getDownloadURL(originalRef),
    ]);

    photos.push({
      id: docSnap.id,
      album: data.album || "unknown",
      colorLabel: data.color_label || "",
      chapter: data.chapter || "",
      year: data.year || null,
      title: data.title || "",
      standardUrl,
      originalUrl,
      order: data.order || 0,
    });
  }

  return photos;
}
