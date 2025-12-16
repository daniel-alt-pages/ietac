import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';

// Explicit Configuration for Production Stability
const firebaseConfig = {
    apiKey: "AIzaSyDmkfJfjnfgqo4ih4HGquKMfacy695_-WE",
    authDomain: "db-ietac.firebaseapp.com",
    projectId: "db-ietac",
    storageBucket: "db-ietac.firebasestorage.app",
    messagingSenderId: "150489309092",
    appId: "1:150489309092:web:d6f26c965e4d1e8b7c2b31"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// Collection reference for student confirmations
const confirmationsCollection = collection(db, 'confirmations');

// Update confirmation status
export async function updateConfirmation(studentId: string, confirmed: boolean) {
    try {
        await setDoc(doc(confirmationsCollection, studentId), {
            confirmed,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error updating confirmation:', error);
    }
}

// Subscribe to confirmation changes in real-time
export function subscribeToConfirmations(callback: (confirmations: Record<string, boolean>) => void) {
    return onSnapshot(confirmationsCollection, (snapshot) => {
        const confirmations: Record<string, boolean> = {};
        snapshot.forEach((doc) => {
            confirmations[doc.id] = doc.data().confirmed;
        });
        callback(confirmations);
    }, (error) => {
        console.error('Firebase subscription error:', error);
    });
}

// Get all confirmations (initial load)
export async function getConfirmations(): Promise<Record<string, boolean>> {
    const confirmations: Record<string, boolean> = {};
    try {
        const snapshot = await getDocs(confirmationsCollection);
        snapshot.forEach((doc) => {
            confirmations[doc.id] = doc.data().confirmed;
        });
    } catch (error) {
        console.error('Error getting confirmations:', error);
    }
    return confirmations;
}

export { db };
