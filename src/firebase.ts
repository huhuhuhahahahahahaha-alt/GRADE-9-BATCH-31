import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with Database ID from configuration
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { app, auth, db };
