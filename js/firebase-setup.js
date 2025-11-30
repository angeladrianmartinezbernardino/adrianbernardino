// js/firebase-setup.js

// Import Firebase core.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

// Import Firestore instance creator.
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Import Auth instance creator (for the admin panel).
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Shared Firebase project configuration.
const firebaseConfig = {
  apiKey: "AIzaSyCXJH_AH-_lhnBv3CpDn-GKKLvZKzIjYTQ",
  authDomain: "adrian-bernardino.firebaseapp.com",
  projectId: "adrian-bernardino",
  storageBucket: "adrianbernardino",
  messagingSenderId: "666230030620",
  appId: "1:666230030620:web:877ca977270ff3f7d73ad9",
  measurementId: "G-K2GREQ6BL5",
};

// Initialize the Firebase app only once.
const app = initializeApp(firebaseConfig);

// Create shared Firestore and Auth instances.
const db = getFirestore(app);
const auth = getAuth(app);

// Export everything so other modules can reuse it.
export { app, db, auth };
