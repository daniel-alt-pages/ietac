import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { studentData } from '../src/lib/data';

// ============================================
// SCRIPT DE SINCRONIZACIÓN DE ESTUDIANTES
// Copia todos los estudiantes de data.ts a Firestore
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCiJuElY7GLwJGRnBfukNac1JkskWOEg_k",
    authDomain: "seamosgenios-portal.firebaseapp.com",
    projectId: "seamosgenios-portal",
    storageBucket: "seamosgenios-portal.firebasestorage.app",
    messagingSenderId: "410641784762",
    appId: "1:410641784762:web:0edf862bbb8f945e2fc783",
    measurementId: "G-RBVRJEFDXG"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const studentsCollection = collection(db, 'students');

async function syncStudentsToFirestore() {
    console.log('🚀 Sincronizando estudiantes de data.ts a Firestore...\n');

    const stats = {
        total: studentData.length,
        created: 0,
        skipped: 0,
        errors: 0
    };

    const BATCH_SIZE = 400;

    for (let i = 0; i < studentData.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = studentData.slice(i, i + BATCH_SIZE);

        for (const student of chunk) {
            const docRef = doc(studentsCollection, student.id);
            const existingDoc = await getDoc(docRef);

            if (existingDoc.exists()) {
                console.log(`   ⏭️  ${student.id} - ${student.first} ${student.last} (ya existe)`);
                stats.skipped++;
                continue;
            }

            batch.set(docRef, {
                studentId: student.id,
                first: student.first,
                last: student.last,
                firstName: student.first,
                lastName: student.last,
                email: student.email,
                assignedEmail: student.email.includes('@') ? student.email : `${student.email}@gmail.com`,
                password: student.password,
                assignedPassword: student.password,
                birth: student.birth,
                gender: student.gender,
                phone: student.phone,
                institution: student.institution,
                verificationStatus: 'PENDING',
                loginCount: 0,
                createdAt: new Date().toISOString(),
                syncedFromDataTs: true
            });

            console.log(`   ✅ ${student.id} - ${student.first} ${student.last}`);
            stats.created++;
        }

        if (stats.created > 0) {
            await batch.commit();
            console.log(`\n   📦 Lote ${Math.ceil((i + BATCH_SIZE) / BATCH_SIZE)} guardado\n`);
        }
    }

    console.log('\n✅ SINCRONIZACIÓN COMPLETADA\n');
    console.log('📊 Estadísticas:');
    console.log(`   • Total estudiantes en data.ts: ${stats.total}`);
    console.log(`   • Creados en Firestore: ${stats.created}`);
    console.log(`   • Omitidos (ya existían): ${stats.skipped}`);
    console.log(`   • Errores: ${stats.errors}`);
}

syncStudentsToFirestore()
    .then(() => {
        console.log('\n✨ Proceso completado');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
