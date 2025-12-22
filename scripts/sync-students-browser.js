// Script de sincronización - Ejecutar desde la consola del navegador
// Copia este código y pégalo en la consola de DevTools (F12 > Console)

async function syncAllStudentsToFirestore() {
    // Este script debe ejecutarse desde la consola del navegador
    // cuando la aplicación esté cargada

    const { studentData } = await import('/src/lib/data.ts');
    const { db } = await import('/src/lib/firebase.ts');
    const { collection, doc, setDoc, getDoc } = await import('firebase/firestore');

    const studentsCollection = collection(db, 'students');

    console.log('🚀 Sincronizando estudiantes...');

    let created = 0;
    let skipped = 0;

    for (const student of studentData) {
        const docRef = doc(studentsCollection, student.id);
        const existingDoc = await getDoc(docRef);

        if (existingDoc.exists()) {
            console.log(`⏭️ ${student.id} ya existe`);
            skipped++;
            continue;
        }

        await setDoc(docRef, {
            studentId: student.id,
            first: student.first,
            last: student.last,
            email: student.email,
            assignedEmail: `${student.email}@gmail.com`,
            password: student.password,
            birth: student.birth,
            gender: student.gender,
            phone: student.phone,
            institution: student.institution,
            verificationStatus: 'PENDING',
            loginCount: 0,
            createdAt: new Date().toISOString(),
            syncedFromDataTs: true
        });

        console.log(`✅ ${student.id} - ${student.first} ${student.last}`);
        created++;
    }

    console.log(`\n✅ Completado: ${created} creados, ${skipped} omitidos`);
}

// Ejecutar
syncAllStudentsToFirestore();
