// js/lava-lamp.js
import { db } from "./firebase-setup.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export function initLavaLamp(context) {
  const container = document.createElement("div");
  container.id = "lava-container";
  
  // Creamos 3 "blobs" que representarán los 3 colores
  // Blob 1: Primario
  // Blob 2: Secundario
  // Blob 3: Acento
  container.innerHTML = `
    <div class="lava-blob blob-1"></div>
    <div class="lava-blob blob-2"></div>
    <div class="lava-blob blob-3"></div>
    <div class="lava-overlay"></div> `;
  
  document.body.prepend(container);

  // Referencia al documento de diseño correcto
  const designRef = doc(db, "pages", `design_${context}`);

  onSnapshot(designRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      // Determinamos si usamos el tema por defecto o un álbum específico (aquí simplificamos al default)
      // En el futuro, podrías pasar el 'slug' del álbum a esta función.
      const theme = data.default_theme || {};
      applyTheme(theme);
    }
  });
}

function applyTheme(theme) {
  const root = document.documentElement;

  // 1. Colores
  const c1 = theme.lava_color_primary || "#4ade80";
  const c2 = theme.lava_color_secondary || "#3b82f6";
  const c3 = theme.lava_color_accent || "#a855f7";

  root.style.setProperty("--lava-c1", c1);
  root.style.setProperty("--lava-c2", c2);
  root.style.setProperty("--lava-c3", c3);

  // 2. Velocidad (Invertida: 100 es rápido/poca duración, 0 es lento/mucha duración)
  // Rango de duración: 10s (rápido) a 60s (lento)
  const speedVal = theme.lava_speed || 50;
  const duration = 60 - (speedVal * 0.5); 
  root.style.setProperty("--lava-duration", `${duration}s`);

  // 3. Intensidad (Opacidad de los blobs)
  const intensity = theme.lava_intensity || 50;
  const opacity = 0.3 + (intensity / 200); // Min 0.3, Max 0.8
  root.style.setProperty("--lava-opacity", opacity);

  // 4. Modo de Fondo (Cambia la mezcla de colores)
  const mode = theme.background_mode || "deep_ocean";
  updateBlendMode(mode);
}

function updateBlendMode(mode) {
  const root = document.documentElement;
  // Ajustamos el tipo de mezcla según el modo seleccionado en Admin
  switch (mode) {
    case "neon_night":
      root.style.setProperty("--lava-blend", "screen");
      root.style.setProperty("--bg-base", "#000000");
      break;
    case "monochrome_glass":
      root.style.setProperty("--lava-blend", "overlay");
      root.style.setProperty("--bg-base", "#111");
      break;
    case "infrared":
      root.style.setProperty("--lava-blend", "difference");
      root.style.setProperty("--bg-base", "#222");
      break;
    case "classic_lava":
    case "deep_ocean":
    default:
      root.style.setProperty("--lava-blend", "normal"); // O hard-light
      root.style.setProperty("--bg-base", "#05040a");
      break;
  }
}