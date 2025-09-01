import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCcOgnbTdWCeyB07JBzr73S0M-oitg2eLo",
  authDomain: "fever-60ac9.firebaseapp.com",
  projectId: "fever-60ac9",
  storageBucket: "fever-60ac9.firebasestorage.app",
  messagingSenderId: "918975939599",
  appId: "1:918975939599:web:08c38aa764f3cb66018f7a",
  measurementId: "G-QWEB14SGT1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
