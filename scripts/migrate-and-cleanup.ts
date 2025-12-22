import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc, query, where } from 'firebase/firestore';

// ============================================
// SCRIPT DE MIGRACIÓN Y LIMPIEZA
// Ejecutar UNA VEZ cuando haya cuota disponible
// ============================================

// BD PRINCIPAL
const firebaseConfigPrimary = {
    apiKey: "AIzaSyCiJuElY7GLwJGRnBfukNac1JkskWOEg_k",
    authDomain: "seamosgenios-portal.firebaseapp.com",
    projectId: "seamosgenios-portal",
    storageBucket: "seamosgenios-portal.firebasestorage.app",
    messagingSenderId: "410641784762",
    appId: "1:410641784762:web:0edf862bbb8f945e2fc783",
    measurementId: "G-RBVRJEFDXG"
};

// BD SECUNDARIA
const firebaseConfigSecondary = {
    apiKey: "AIzaSyC80Qn9kM3jgLfnTkwtUQEYqPIPAS_MK_I",
    authDomain: "portal-sg-2.firebaseapp.com",
    projectId: "portal-sg-2",
    storageBucket: "portal-sg-2.firebasestorage.app",
    messagingSenderId: "459838365046",
    appId: "1:459838365046:web:84b20a6175a32a27d3ee57",
    measurementId: "G-70VSL6SS5Y"
};

const appPrimary = initializeApp(firebaseConfigPrimary);
const appSecondary = initializeApp(firebaseConfigSecondary, 'secondary');

const dbPrimary = getFirestore(appPrimary);
const dbSecondary = getFirestore(appSecondary);

// Eventos esenciales que se mantienen
const ESSENTIAL_EVENTS = ['login', 'confirmation', 'google_verify'];

async function migrateAndCleanup() {
    console.log('🚀 Iniciando migración y limpieza...\n');

    let stats = {
        activityMigrated: 0,
        activityDeleted: 0,
        securityDeleted: 0,
        duplicatesRemoved: 0,
        nonEssentialRemoved: 0
    };

    try {
        // ============================================
        // PASO 1: Migrar activity_events esenciales
        // ============================================
        console.log('📊 PASO 1: Migrando activity_events...');

        const activityPrimaryCol = collection(dbPrimary, 'activity_events');
        const activitySnapshot = await getDocs(activityPrimaryCol);

        console.log(`   Encontrados ${activitySnapshot.size} eventos en BD principal`);

        // Filtrar solo eventos esenciales
        const essentialEvents: any[] = [];
        const seenEvents = new Set<string>();

        activitySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            const eventKey = `${data.type}_${data.studentId}_${data.timestamp}`;

            // Solo eventos esenciales y no duplicados
            if (ESSENTIAL_EVENTS.includes(data.type) && !seenEvents.has(eventKey)) {
                essentialEvents.push({ id: docSnap.id, data });
                seenEvents.add(eventKey);
            }
        });

        console.log(`   Eventos esenciales únicos: ${essentialEvents.length}`);
        stats.duplicatesRemoved = activitySnapshot.size - essentialEvents.length;

        // Migrar en lotes de 400 (límite de Firestore es 500)
        const BATCH_SIZE = 400;
        for (let i = 0; i < essentialEvents.length; i += BATCH_SIZE) {
            const batch = writeBatch(dbSecondary);
            const chunk = essentialEvents.slice(i, i + BATCH_SIZE);

            chunk.forEach(event => {
                const docRef = doc(dbSecondary, 'activity_events', event.id);
                batch.set(docRef, event.data);
            });

            await batch.commit();
            stats.activityMigrated += chunk.length;
            console.log(`   ✓ Migrados ${stats.activityMigrated}/${essentialEvents.length} eventos`);
        }

        // ============================================
        // PASO 2: Eliminar activity_events de BD principal
        // ============================================
        console.log('\n🗑️  PASO 2: Eliminando activity_events de BD principal...');

        for (let i = 0; i < activitySnapshot.size; i += BATCH_SIZE) {
            const batch = writeBatch(dbPrimary);
            const docs = activitySnapshot.docs.slice(i, i + BATCH_SIZE);

            docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });

            await batch.commit();
            stats.activityDeleted += docs.length;
            console.log(`   ✓ Eliminados ${stats.activityDeleted}/${activitySnapshot.size} eventos`);
        }

        // ============================================
        // PASO 3: Eliminar colección security_status antigua
        // ============================================
        console.log('\n🗑️  PASO 3: Eliminando colección security_status...');

        const securityCol = collection(dbPrimary, 'security_status');
        const securitySnapshot = await getDocs(securityCol);

        console.log(`   Encontrados ${securitySnapshot.size} documentos de seguridad`);

        for (let i = 0; i < securitySnapshot.size; i += BATCH_SIZE) {
            const batch = writeBatch(dbPrimary);
            const docs = securitySnapshot.docs.slice(i, i + BATCH_SIZE);

            docs.forEach(docSnap => {
                batch.delete(docSnap.ref);
            });

            await batch.commit();
            stats.securityDeleted += docs.length;
            console.log(`   ✓ Eliminados ${stats.securityDeleted}/${securitySnapshot.size} documentos`);
        }

        // ============================================
        // PASO 4: Limpiar logs no esenciales de BD secundaria
        // ============================================
        console.log('\n🧹 PASO 4: Limpiando logs no esenciales en BD secundaria...');

        const activitySecondaryCol = collection(dbSecondary, 'activity_events');
        const allSecondaryEvents = await getDocs(activitySecondaryCol);

        const toDelete: any[] = [];
        allSecondaryEvents.forEach(docSnap => {
            const data = docSnap.data();
            if (!ESSENTIAL_EVENTS.includes(data.type)) {
                toDelete.push(docSnap.ref);
            }
        });

        console.log(`   Eventos no esenciales a eliminar: ${toDelete.length}`);

        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = writeBatch(dbSecondary);
            const chunk = toDelete.slice(i, i + BATCH_SIZE);

            chunk.forEach(ref => {
                batch.delete(ref);
            });

            await batch.commit();
            stats.nonEssentialRemoved += chunk.length;
            console.log(`   ✓ Eliminados ${stats.nonEssentialRemoved}/${toDelete.length} eventos`);
        }

        // ============================================
        // RESUMEN
        // ============================================
        console.log('\n✅ MIGRACIÓN Y LIMPIEZA COMPLETADA\n');
        console.log('📊 Estadísticas:');
        console.log(`   • Eventos migrados a BD secundaria: ${stats.activityMigrated}`);
        console.log(`   • Eventos eliminados de BD principal: ${stats.activityDeleted}`);
        console.log(`   • Documentos de seguridad eliminados: ${stats.securityDeleted}`);
        console.log(`   • Duplicados removidos: ${stats.duplicatesRemoved}`);
        console.log(`   • Eventos no esenciales eliminados: ${stats.nonEssentialRemoved}`);
        console.log(`\n💾 Espacio liberado en BD principal: ~${Math.round((stats.activityDeleted + stats.securityDeleted) * 0.5)} KB`);

    } catch (error) {
        console.error('❌ Error durante migración:', error);
        throw error;
    }
}

// Ejecutar
migrateAndCleanup()
    .then(() => {
        console.log('\n✨ Proceso completado exitosamente');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
    });
