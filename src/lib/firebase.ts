import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDocs } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
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
