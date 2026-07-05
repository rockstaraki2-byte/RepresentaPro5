import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBF2sweJQHuc_I3S71dPjw0_5pEUQOzuu8",
  authDomain: "representapro-b84c3.firebaseapp.com",
  projectId: "representapro-b84c3",
  storageBucket: "representapro-b84c3.firebasestorage.app",
  messagingSenderId: "948207221757",
  appId: "1:948207221757:web:be1da69bbe4490076af794",
  measurementId: "G-K4P1RYCKW5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
