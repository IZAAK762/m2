import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3HHJOSjZYMPXMduvyPmUTPy_jxx10j74",
  authDomain: "m2-app-9b4ed.firebaseapp.com",
  projectId: "m2-app-9b4ed",
  storageBucket: "m2-app-9b4ed.firebasestorage.app",
  messagingSenderId: "137810029948",
  appId: "1:137810029948:web:5f89278c71d972450e08f9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);