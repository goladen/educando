// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBzPXY7_iFaMjiw824Pa8HnO4nFBtK0r9s",
    authDomain: "aprendiendo-db0b3.firebaseapp.com",
    projectId: "aprendiendo-db0b3",
    storageBucket: "aprendiendo-db0b3.firebasestorage.app",
    messagingSenderId: "544528054442",
    appId: "1:544528054442:web:bbf6fef42f94a78307b8d3",
    measurementId: "G-Z5QCCJ9EJE"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);