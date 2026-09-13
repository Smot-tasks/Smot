import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAB6aJnjtspUMDzNqM4B8dJo4hf87jRNM0",
    authDomain: "smot-dolab-w-elshanta.firebaseapp.com",
    databaseURL: "https://smot-dolab-w-elshanta-default-rtdb.firebaseio.com",
    projectId: "smot-dolab-w-elshanta",
    storageBucket: "smot-dolab-w-elshanta.firebasestorage.app",
    messagingSenderId: "860725846578",
    appId: "1:860725846578:web:96c0b8958ad0f28ce3922b",
    measurementId: "G-Y7XJJWJ2K3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };