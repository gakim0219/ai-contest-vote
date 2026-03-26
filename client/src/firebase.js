import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCsIhHtkEHySddlG1CnOXyljX8rIghG-OQ",
  authDomain: "ai-contest-vote.firebaseapp.com",
  projectId: "ai-contest-vote",
  storageBucket: "ai-contest-vote.firebasestorage.app",
  messagingSenderId: "135860317606",
  appId: "1:135860317606:web:a118f601f527b4a848b367",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
