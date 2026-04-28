import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCKpwPcFZqsJPBv5y3kRxz3OeLKQ8kijJM",
  authDomain: "driveil-6283c.firebaseapp.com",
  projectId: "driveil-6283c",
  storageBucket: "driveil-6283c.firebasestorage.app",
  messagingSenderId: "320521092801",
  appId: "1:320521092801:web:c27688243c96061fac5e40"
};

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
