// Script para corregir el campo assignedEmail en Firestore
// Ejecutar desde la consola del navegador (F12 > Console)
// Asegúrate de estar en https://seamosgenios-portal.web.app o localhost:3000

async function fixAssignedEmails() {
    const { studentData } = await import('/src/lib/data.ts');
    const { db } = await import('/src/lib/firebase.ts');
    const { collection, doc, getDoc, updateDoc } = await import('firebase/firestore');

    const studentsCollection = collection(db, 'students');

    console.log('🔧 Iniciando corrección de emails asignados...');
    console.log(`📊 Total estudiantes en data.ts: ${studentData.length}`);

    let fixed = 0;
    let alreadyCorrect = 0;
    let notFound = 0;
    let errors = 0;

    for (const student of studentData) {
        try {
            const docRef = doc(studentsCollection, student.id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.log(`⚠️ ${student.id} no existe en Firestore`);
                notFound++;
                continue;
            }

            const data = docSnap.data();
            const expectedEmail = `${student.email}@gmail.com`;

            // Verificar si assignedEmail está correcto
            if (data.assignedEmail === expectedEmail) {
                alreadyCorrect++;
                continue;
            }

            // Corregir el campo assignedEmail
            await updateDoc(docRef, {
                assignedEmail: expectedEmail,
                email: student.email, // También actualizar el campo email sin @gmail.com
                emailNormalized: student.email.toLowerCase()
            });

            console.log(`✅ ${student.id} - Corregido: ${data.assignedEmail || 'vacío'} → ${expectedEmail}`);
            fixed++;

        } catch (error) {
            console.error(`❌ Error en ${student.id}:`, error);
            errors++;
        }
    }

    console.log('\n========================================');
    console.log('📊 RESUMEN DE CORRECCIÓN:');
    console.log(`✅ Corregidos: ${fixed}`);
    console.log(`✓ Ya correctos: ${alreadyCorrect}`);
    console.log(`⚠️ No encontrados: ${notFound}`);
    console.log(`❌ Errores: ${errors}`);
    console.log('========================================\n');

    return { fixed, alreadyCorrect, notFound, errors };
}

// Ejecutar
fixAssignedEmails();
