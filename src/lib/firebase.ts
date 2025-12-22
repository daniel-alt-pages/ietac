import { initializeApp, getApps } from 'firebase/app';
import { studentData } from './data';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, getDocs, query, orderBy, arrayUnion, serverTimestamp, writeBatch, where, limit } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

// ============================================
// 🔥 DUAL DATABASE ARCHITECTURE
// BD Principal: Confirmaciones, Students, Security (HOSTING)
// BD Secundaria: Activity Logs, CRUD Logs (SOLO ESCRITURA)
// ============================================

// BD PRINCIPAL - seamosgenios-portal (Hosting)
const firebaseConfigPrimary = {
    apiKey: "AIzaSyCiJuElY7GLwJGRnBfukNac1JkskWOEg_k",
    authDomain: "seamosgenios-portal.firebaseapp.com",
    projectId: "seamosgenios-portal",
    storageBucket: "seamosgenios-portal.firebasestorage.app",
    messagingSenderId: "410641784762",
    appId: "1:410641784762:web:0edf862bbb8f945e2fc783",
    measurementId: "G-RBVRJEFDXG"
};

// BD SECUNDARIA - portal-sg-2 (Solo para logs)
const firebaseConfigSecondary = {
    apiKey: "AIzaSyC80Qn9kM3jgLfnTkwtUQEYqPIPAS_MK_I",
    authDomain: "portal-sg-2.firebaseapp.com",
    projectId: "portal-sg-2",
    storageBucket: "portal-sg-2.firebasestorage.app",
    messagingSenderId: "459838365046",
    appId: "1:459838365046:web:84b20a6175a32a27d3ee57",
    measurementId: "G-70VSL6SS5Y"
};

// Initialize Primary Firebase (main app - hosting)
const appPrimary = getApps().length === 0
    ? initializeApp(firebaseConfigPrimary)
    : getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfigPrimary);

// Initialize Secondary Firebase (logs only)
const appSecondary = getApps().find(a => a.name === 'secondary')
    || initializeApp(firebaseConfigSecondary, 'secondary');

// Firestore instances
const db = getFirestore(appPrimary);           // BD Principal
const dbSecondary = getFirestore(appSecondary); // BD Secundaria (logs)
export { db };

// Initialize Firebase Auth with Google Provider (uses primary)
const auth = getAuth(appPrimary);
const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (running only on client side)
if (typeof window !== 'undefined') {
    import('firebase/analytics').then(({ getAnalytics }) => {
        getAnalytics(appPrimary);
    }).catch(err => console.error("Analytics failed to load", err));
}

// ============================================
// COLLECTION REFERENCES
// ============================================

// BD PRINCIPAL: Datos críticos
const confirmationsCollection = collection(db, 'account_confirmations');
const studentsCollection = collection(db, 'students');

// BD SECUNDARIA: Logs (alto volumen de escrituras)
const activityCollection = collection(dbSecondary, 'activity_events');
const crudLogsCollection = collection(dbSecondary, 'crud_logs');

// ============================================
// CRUD LOGGING SYSTEM
// Registra todos los cambios para sincronizar con data.ts
// ============================================

export interface CRUDLogEntry {
    id?: string;
    timestamp: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    studentId: string;
    studentName: string;
    adminId: string;
    changes: {
        field: string;
        oldValue: string | number | boolean | null;
        newValue: string | number | boolean | null;
    }[];
    syncedToDataTs: boolean;
}

/**
 * 📝 Registrar cambio CRUD para sincronización
 */
export async function logCRUDChange(entry: Omit<CRUDLogEntry, 'id' | 'timestamp' | 'syncedToDataTs'>): Promise<boolean> {
    try {
        const logId = `${entry.action}_${entry.studentId}_${Date.now()}`;
        await setDoc(doc(crudLogsCollection, logId), {
            ...entry,
            timestamp: new Date().toISOString(),
            syncedToDataTs: false
        });
        console.log(`📝 CRUD Log: ${entry.action} - ${entry.studentName} (${entry.studentId})`);
        return true;
    } catch (error) {
        console.error('Error logging CRUD change:', error);
        return false;
    }
}

/**
 * 📋 Obtener todos los cambios pendientes de sincronizar
 */
export async function getPendingCRUDChanges(): Promise<CRUDLogEntry[]> {
    try {
        const q = query(crudLogsCollection, where('syncedToDataTs', '==', false), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const logs: CRUDLogEntry[] = [];
        snapshot.forEach(docSnap => {
            logs.push({ id: docSnap.id, ...docSnap.data() } as CRUDLogEntry);
        });
        return logs;
    } catch (error) {
        console.error('Error getting pending CRUD changes:', error);
        return [];
    }
}

/**
 * ✅ Marcar cambio como sincronizado con data.ts
 */
export async function markCRUDChangeAsSynced(logId: string): Promise<boolean> {
    try {
        await updateDoc(doc(crudLogsCollection, logId), { syncedToDataTs: true });
        return true;
    } catch (error) {
        console.error('Error marking CRUD change as synced:', error);
        return false;
    }
}

/**
 * 📄 Exportar cambios pendientes como texto para CRUD_LOG.md
 */
export async function exportPendingChangesAsMarkdown(): Promise<string> {
    const changes = await getPendingCRUDChanges();
    if (changes.length === 0) {
        return '✅ No hay cambios pendientes de sincronizar.';
    }

    let md = `## 📋 Cambios Pendientes de Sincronizar (${changes.length})\n\n`;
    md += `> Generado: ${new Date().toLocaleString('es-CO')}\n\n`;

    changes.forEach((change, idx) => {
        const date = new Date(change.timestamp);
        md += `### ${idx + 1}. ${change.action} - ${change.studentName}\n`;
        md += `- **ID:** ${change.studentId}\n`;
        md += `- **Fecha:** ${date.toLocaleDateString('es-CO')} ${date.toLocaleTimeString('es-CO')}\n`;
        md += `- **Admin:** ${change.adminId}\n`;
        md += `- **Cambios:**\n`;
        change.changes.forEach(c => {
            md += `  - \`${c.field}\`: \`${c.oldValue}\` → \`${c.newValue}\`\n`;
        });
        md += `\n---\n\n`;
    });

    return md;
}

// ============================================
// 🔒 CRUD DAILY LIMITS - Max 40 operaciones/día
// ============================================

const MAX_CRUD_PER_DAY = 40;
const CRUD_COUNTER_KEY = 'sg_crud_daily_counter';

interface CRUDCounter {
    date: string; // YYYY-MM-DD
    count: number;
}

/**
 * Obtener el contador de CRUD del día
 */
function getCRUDCounter(): CRUDCounter {
    if (typeof window === 'undefined') return { date: '', count: 0 };

    try {
        const stored = localStorage.getItem(CRUD_COUNTER_KEY);
        if (stored) {
            const counter: CRUDCounter = JSON.parse(stored);
            const today = new Date().toISOString().split('T')[0];
            if (counter.date === today) {
                return counter;
            }
        }
    } catch { /* ignore */ }

    return { date: new Date().toISOString().split('T')[0], count: 0 };
}

/**
 * Incrementar el contador de CRUD
 */
function incrementCRUDCounter(): void {
    if (typeof window === 'undefined') return;

    const counter = getCRUDCounter();
    counter.count++;
    localStorage.setItem(CRUD_COUNTER_KEY, JSON.stringify(counter));
}

/**
 * Verificar si se puede realizar una operación CRUD
 */
export function canPerformCRUD(): { allowed: boolean; remaining: number; message?: string } {
    const counter = getCRUDCounter();
    const remaining = MAX_CRUD_PER_DAY - counter.count;

    if (remaining <= 0) {
        return {
            allowed: false,
            remaining: 0,
            message: `Has alcanzado el límite de ${MAX_CRUD_PER_DAY} cambios diarios. El contador se reinicia a medianoche.`
        };
    }

    return { allowed: true, remaining };
}

/**
 * Obtener estadísticas de CRUD del día
 */
export function getCRUDStats(): { used: number; remaining: number; max: number } {
    const counter = getCRUDCounter();
    return {
        used: counter.count,
        remaining: MAX_CRUD_PER_DAY - counter.count,
        max: MAX_CRUD_PER_DAY
    };
}

/**
 * Consumir un uso de CRUD (llamar después de operación exitosa)
 */
export function consumeCRUDUsage(): void {
    incrementCRUDCounter();
}

// Confirmation data interface
export interface ConfirmationData {
    studentId: string;
    studentName: string;
    studentLastName: string;
    email: string;
    institution: string;
    confirmed: boolean;
    confirmedAt: string | null;
    createdAt: string;
}

// Save confirmation when student confirms account creation
export async function saveConfirmation(data: {
    studentId: string;
    studentName: string;
    studentLastName: string;
    email: string;
    institution: string;
}): Promise<boolean> {
    try {
        await setDoc(doc(confirmationsCollection, data.studentId), {
            ...data,
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error saving confirmation:', error);
        return false;
    }
}

// Subscribe to confirmation changes in real-time (for admin panel)
export function subscribeToConfirmations(callback: (confirmations: ConfirmationData[]) => void) {
    const q = query(confirmationsCollection, orderBy('confirmedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const confirmations: ConfirmationData[] = [];
        snapshot.forEach((docSnap) => {
            confirmations.push({
                studentId: docSnap.id,
                ...docSnap.data()
            } as ConfirmationData);
        });
        callback(confirmations);
    }, (error) => {
        console.error('Firebase subscription error:', error);
    });
}

// Get all confirmations (for initial admin panel load)
export async function getAllConfirmations(): Promise<ConfirmationData[]> {
    const confirmations: ConfirmationData[] = [];
    try {
        const q = query(confirmationsCollection, orderBy('confirmedAt', 'desc'));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
            confirmations.push({
                studentId: docSnap.id,
                ...docSnap.data()
            } as ConfirmationData);
        });
    } catch (error) {
        console.error('Error getting confirmations:', error);
    }
    return confirmations;
}

// Legacy function for backward compatibility
export async function updateConfirmation(studentId: string, confirmed: boolean) {
    try {
        await setDoc(doc(confirmationsCollection, studentId), {
            confirmed,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating confirmation:', error);
    }
}

// Legacy function for backward compatibility
export async function getConfirmations(): Promise<Record<string, boolean>> {
    const confirmations: Record<string, boolean> = {};
    try {
        const snapshot = await getDocs(confirmationsCollection);
        snapshot.forEach((docSnap) => {
            confirmations[docSnap.id] = docSnap.data().confirmed;
        });
    } catch (error) {
        console.error('Error getting confirmations:', error);
    }
    return confirmations;
}

// ============================================
// ACTIVITY EVENTS SYSTEM
// ============================================

// Activity event types - EXPANDED
export type ActivityEventType =
    | 'login'           // Usuario inició sesión
    | 'login_failed'    // Intento de login fallido
    | 'confirmation'    // Usuario confirmó su cuenta
    | 'view_credentials' // Usuario vio sus credenciales
    | 'page_view'       // Usuario visitó una página
    | 'copy_email'      // Usuario copió su email
    | 'copy_password'   // Usuario copió su contraseña
    | 'heartbeat'       // Ping de actividad (usuario activo)
    | 'google_verify'   // Verificación con Google exitosa
    | 'google_intruso'  // Intento de verificación con correo no autorizado
    | 'google_error'    // Error en verificación Google
    | 'admin_action'    // Acción de administrador
    | 'session_end';    // Fin de sesión/logout

// Activity event interface - ENHANCED
export interface ActivityEvent {
    id?: string;
    type: ActivityEventType;
    studentId: string;
    studentName: string;
    institution: string;
    timestamp: string;
    details?: string;
    phone?: string;
    userAgent?: string;
    // New fields for rich tracking
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
    ip?: string;
    location?: string;
}

// Device detection helper
function detectDeviceInfo(): { deviceType: 'desktop' | 'mobile' | 'tablet'; browser: string; os: string } {
    if (typeof window === 'undefined') {
        return { deviceType: 'desktop', browser: 'Server', os: 'Server' };
    }

    const ua = navigator.userAgent;

    // Device type
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
        deviceType = 'mobile';
    }

    // Browser
    let browser = 'Unknown';
    if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.split('Firefox/')[1]?.split(' ')[0];
    else if (ua.includes('Edg/')) browser = 'Edge ' + ua.split('Edg/')[1]?.split(' ')[0];
    else if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.split('Chrome/')[1]?.split(' ')[0];
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari ' + ua.split('Version/')[1]?.split(' ')[0];
    else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera';

    // OS
    let os = 'Unknown';
    if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
    else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
    else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '');
    else if (ua.includes('Android')) os = 'Android ' + (ua.match(/Android (\d+\.?\d*)/)?.[1] || '');
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS ' + (ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '');
    else if (ua.includes('Linux')) os = 'Linux';

    return { deviceType, browser, os };
}

// Save an activity event - ENHANCED with device detection
export async function saveActivityEvent(event: Omit<ActivityEvent, 'id' | 'timestamp' | 'deviceType' | 'browser' | 'os'>): Promise<boolean> {
    try {
        const eventId = `${event.type}_${event.studentId}_${Date.now()}`;
        const deviceInfo = detectDeviceInfo();

        await setDoc(doc(activityCollection, eventId), {
            ...event,
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
            ...deviceInfo
        });
        return true;
    } catch (error) {
        console.error('Error saving activity event:', error);
        return false;
    }
}

// Subscribe to activity events in real-time (for admin notifications)
export function subscribeToActivityEvents(callback: (events: ActivityEvent[]) => void, limit: number = 100) {
    const q = query(activityCollection, orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const events: ActivityEvent[] = [];
        let count = 0;
        snapshot.forEach((docSnap) => {
            if (count < limit) {
                events.push({
                    id: docSnap.id,
                    ...docSnap.data()
                } as ActivityEvent);
                count++;
            }
        });
        callback(events);
    }, (error) => {
        console.error('Activity events subscription error:', error);
    });
}

// Check if a student is currently active (had activity in last 5 minutes)
export function isStudentActive(events: ActivityEvent[], studentId: string, minutesThreshold: number = 5): boolean {
    const now = new Date();
    const threshold = minutesThreshold * 60 * 1000; // Convert to milliseconds

    const studentEvents = events.filter(e => e.studentId === studentId);
    if (studentEvents.length === 0) return false;

    const lastEvent = new Date(studentEvents[0].timestamp);
    return (now.getTime() - lastEvent.getTime()) < threshold;
}

// Get last activity time for a student
export function getLastActivityTime(events: ActivityEvent[], studentId: string): Date | null {
    const studentEvents = events.filter(e => e.studentId === studentId);
    if (studentEvents.length === 0) return null;
    return new Date(studentEvents[0].timestamp);
}

// Get activity statistics
export function getActivityStats(events: ActivityEvent[]) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayEvents = events.filter(e => new Date(e.timestamp) >= todayStart);

    return {
        totalEvents: events.length,
        todayEvents: todayEvents.length,
        todayLogins: todayEvents.filter(e => e.type === 'login').length,
        todayConfirmations: todayEvents.filter(e => e.type === 'confirmation').length,
        todayCredentialViews: todayEvents.filter(e => e.type === 'view_credentials').length,
        todayCopies: todayEvents.filter(e => e.type === 'copy_email' || e.type === 'copy_password').length,
        activeStudents: new Set(todayEvents.map(e => e.studentId)).size,
        eventsByType: {
            login: events.filter(e => e.type === 'login').length,
            confirmation: events.filter(e => e.type === 'confirmation').length,
            view_credentials: events.filter(e => e.type === 'view_credentials').length,
            copy_email: events.filter(e => e.type === 'copy_email').length,
            copy_password: events.filter(e => e.type === 'copy_password').length,
            page_view: events.filter(e => e.type === 'page_view').length,
            heartbeat: events.filter(e => e.type === 'heartbeat').length,
        },
        // Estadísticas adicionales profesionales
        uniqueStudentsTotal: new Set(events.map(e => e.studentId)).size,
        averageEventsPerStudent: events.length / Math.max(new Set(events.map(e => e.studentId)).size, 1),
        mostActiveHour: getMostActiveHour(events),
        eventsByInstitution: getEventsByInstitution(events),
    };
}

// Helper: Obtener la hora más activa
function getMostActiveHour(events: ActivityEvent[]): number {
    const hourCounts: { [key: number]: number } = {};
    events.forEach(e => {
        const hour = new Date(e.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    let maxHour = 0;
    let maxCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxHour = parseInt(hour);
        }
    });
    return maxHour;
}

// Helper: Eventos por institución
function getEventsByInstitution(events: ActivityEvent[]): { [key: string]: number } {
    const institutionCounts: { [key: string]: number } = {};
    events.forEach(e => {
        const inst = e.institution || 'Desconocida';
        institutionCounts[inst] = (institutionCounts[inst] || 0) + 1;
    });
    return institutionCounts;
}

// Get student activity timeline
export function getStudentTimeline(events: ActivityEvent[], studentId: string): ActivityEvent[] {
    return events
        .filter(e => e.studentId === studentId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Get students who need attention (logged in but didn't confirm)
export function getStudentsNeedingAttention(events: ActivityEvent[]): string[] {
    const loggedIn = new Set(events.filter(e => e.type === 'login').map(e => e.studentId));
    const confirmed = new Set(events.filter(e => e.type === 'confirmation').map(e => e.studentId));

    return Array.from(loggedIn).filter(id => !confirmed.has(id));
}

// Student summary for dashboard
export interface StudentSummary {
    studentId: string;
    studentName: string;
    institution: string;
    phone?: string;
    verificationStatus: 'VERIFIED' | 'PENDING' | 'MISMATCH' | 'INTRUSO';
    lastActivity?: string;
    lastActivityType?: ActivityEventType;
    totalEvents: number;
    loginCount: number;
    hasAlerts: boolean;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
}

// Get students summary with aggregated data from events
export function getStudentsSummary(events: ActivityEvent[], students: StudentDocument[]): StudentSummary[] {
    const summaryMap = new Map<string, StudentSummary>();

    // First, add all students from the database
    students.forEach(student => {
        summaryMap.set(student.studentId, {
            studentId: student.studentId,
            studentName: `${student.first || ''} ${student.last || ''}`.trim() || student.studentId,
            institution: student.institution || 'N/A',
            phone: student.phone,
            verificationStatus: (student.verificationStatus as StudentSummary['verificationStatus']) || 'PENDING',
            totalEvents: 0,
            loginCount: student.loginCount || 0,
            hasAlerts: false,
            deviceType: undefined,
            browser: undefined,
            os: undefined
        });
    });

    // Then, enrich with event data
    events.forEach(event => {
        let summary = summaryMap.get(event.studentId);

        if (!summary) {
            // Student from events but not in database (e.g., intruso)
            summary = {
                studentId: event.studentId,
                studentName: event.studentName,
                institution: event.institution,
                phone: event.phone,
                verificationStatus: event.type === 'google_intruso' ? 'INTRUSO' : 'PENDING',
                totalEvents: 0,
                loginCount: 0,
                hasAlerts: event.type === 'google_intruso',
                deviceType: event.deviceType,
                browser: event.browser,
                os: event.os
            };
            summaryMap.set(event.studentId, summary);
        }

        summary.totalEvents++;

        // Update last activity if this event is more recent
        if (!summary.lastActivity || event.timestamp > summary.lastActivity) {
            summary.lastActivity = event.timestamp;
            summary.lastActivityType = event.type;
            if (event.deviceType) summary.deviceType = event.deviceType;
            if (event.browser) summary.browser = event.browser;
            if (event.os) summary.os = event.os;
        }

        // Check for alerts
        if (event.type === 'google_intruso') {
            summary.hasAlerts = true;
            summary.verificationStatus = 'INTRUSO';
        }

        if (event.type === 'login') {
            summary.loginCount++;
        }
    });

    // Convert to array, filter invalid entries, and sort by last activity (most recent first)
    return Array.from(summaryMap.values())
        // Filter out invalid/legacy entries with unknown IDs
        .filter(s =>
            s.studentId &&
            s.studentId !== 'DESCONOCIDO' &&
            s.studentId !== 'SIN_SESSION' &&
            s.studentId !== 'N/A' &&
            s.studentId.length > 3
        )
        .sort((a, b) => {
            // Alerts first
            if (a.hasAlerts && !b.hasAlerts) return -1;
            if (!a.hasAlerts && b.hasAlerts) return 1;
            // Then by last activity
            if (!a.lastActivity && !b.lastActivity) return 0;
            if (!a.lastActivity) return 1;
            if (!b.lastActivity) return -1;
            return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });
}

// ============================================
// SECURITY SYSTEM - Infractions & Sessions
// 🔧 OPTIMIZACIÓN: Datos de seguridad UNIFICADOS en colección students
// Ya no usamos colección separada security_status
// ============================================

// 🧪 TEST USER - Bypasses all security restrictions for testing
const TEST_USER_ID = '1045671402';

// NOTA: Los datos de seguridad ahora se guardan en el documento del estudiante
// Campos: disabled, disabledAt, disabledReason, infractions, activeSessionId, etc.

// Security status interface
export interface StudentSecurityStatus {
    studentId: string;
    disabled: boolean;
    disabledAt?: string;
    disabledReason?: string;
    infractions: InfractionRecord[];
    activeSessionId?: string;
    activeSessionStartedAt?: string;
    lastStepTime?: string;
    lastStep?: string;
    enabledAt?: string;
    enabledBy?: string;
}

// Infraction record
export interface InfractionRecord {
    type: 'speed_violation' | 'duplicate_session' | 'manual_block';
    timestamp: string;
    details: string;
    stepFrom?: string;
    stepTo?: string;
    timeTaken?: number; // seconds
}

// Minimum time between steps (in seconds)
const STEP_TIME_LIMITS: Record<string, number> = {
    'credentials_to_google': 5,      // Min 5 seconds to read credentials
    'google_step_1_to_2': 3,         // Min 3 seconds between Google steps
    'google_step_2_to_3': 3,
    'google_step_3_to_4': 3,
    'google_step_4_to_5': 3,
    'google_step_5_to_confirm': 5,   // Min 5 seconds before confirming
    'default': 2                      // Default minimum 2 seconds
};

// Generate unique session ID
export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get student security status (now reads from students collection)
export async function getStudentSecurityStatus(studentId: string): Promise<StudentSecurityStatus | null> {
    try {
        const docSnap = await getDoc(doc(studentsCollection, studentId));
        if (!docSnap.exists()) return null;

        const data = docSnap.data();
        return {
            studentId,
            disabled: data.disabled || false,
            disabledAt: data.disabledAt,
            disabledReason: data.disabledReason,
            infractions: data.infractions || [],
            activeSessionId: data.activeSessionId,
            activeSessionStartedAt: data.activeSessionStartedAt,
            lastStepTime: data.lastStepTime,
            lastStep: data.lastStep,
            enabledAt: data.enabledAt,
            enabledBy: data.enabledBy
        };
    } catch (error) {
        console.error('Error getting security status:', error);
        return null;
    }
}

// Check if student is disabled
export async function isStudentDisabled(studentId: string): Promise<{ disabled: boolean; reason?: string }> {
    // 🧪 TEST USER BYPASS
    if (studentId === TEST_USER_ID) return { disabled: false };

    const status = await getStudentSecurityStatus(studentId);
    if (!status) return { disabled: false };
    return {
        disabled: status.disabled,
        reason: status.disabledReason
    };
}

// Check and register session (returns false if another session is active)
export async function checkAndRegisterSession(studentId: string, sessionId: string): Promise<{
    allowed: boolean;
    reason?: string;
    existingSessionId?: string;
}> {
    // 🧪 TEST USER BYPASS - Allow unlimited sessions
    if (studentId === TEST_USER_ID) return { allowed: true };

    try {
        const status = await getStudentSecurityStatus(studentId);

        // Check if disabled first
        if (status?.disabled) {
            return {
                allowed: false,
                reason: status.disabledReason || 'Tu cuenta ha sido inhabilitada. Contacta al administrador.'
            };
        }

        // Check for active session
        if (status?.activeSessionId && status.activeSessionId !== sessionId) {
            const sessionStartedAt = status.activeSessionStartedAt ? new Date(status.activeSessionStartedAt) : null;
            const now = new Date();
            // Session expires after 30 minutes of inactivity
            const SESSION_TIMEOUT = 30 * 60 * 1000;

            if (sessionStartedAt && (now.getTime() - sessionStartedAt.getTime()) < SESSION_TIMEOUT) {
                // Active session exists - record infraction
                await recordInfraction(studentId, {
                    type: 'duplicate_session',
                    timestamp: now.toISOString(),
                    details: `Intento de sesión duplicada. Sesión activa: ${status.activeSessionId}`
                });
                return {
                    allowed: false,
                    reason: 'Ya hay una sesión activa en otro dispositivo. Solo se permite un dispositivo a la vez.',
                    existingSessionId: status.activeSessionId
                };
            }
        }

        // Register this session (in student document)
        await setDoc(doc(studentsCollection, studentId), {
            disabled: status?.disabled || false,
            infractions: status?.infractions || [],
            activeSessionId: sessionId,
            activeSessionStartedAt: new Date().toISOString()
        }, { merge: true });

        return { allowed: true };
    } catch (error) {
        console.error('Error checking session:', error);
        return { allowed: true }; // Allow on error to not block users
    }
}

// Clear session when user logs out or leaves
export async function clearSession(studentId: string, sessionId: string): Promise<void> {
    try {
        const status = await getStudentSecurityStatus(studentId);
        if (status?.activeSessionId === sessionId) {
            await setDoc(doc(studentsCollection, studentId), {
                activeSessionId: null,
                activeSessionStartedAt: null
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error clearing session:', error);
    }
}

// Validate step timing (returns infraction if too fast)
export async function validateStepTiming(
    studentId: string,
    fromStep: string,
    toStep: string,
    sessionId: string
): Promise<{ valid: boolean; infraction?: string; disabled?: boolean }> {
    // 🧪 TEST USER BYPASS - No speed restrictions
    if (studentId === TEST_USER_ID) return { valid: true };

    try {
        const status = await getStudentSecurityStatus(studentId);
        const now = new Date();

        if (status?.lastStepTime && status.lastStep) {
            const lastTime = new Date(status.lastStepTime);
            const timeTaken = (now.getTime() - lastTime.getTime()) / 1000; // seconds

            const stepKey = `${status.lastStep}_to_${toStep}`;
            const minTime = STEP_TIME_LIMITS[stepKey] || STEP_TIME_LIMITS['default'];

            if (timeTaken < minTime) {
                // Too fast! Record infraction
                const infraction: InfractionRecord = {
                    type: 'speed_violation',
                    timestamp: now.toISOString(),
                    details: `Avance muy rápido de "${fromStep}" a "${toStep}". Tiempo: ${timeTaken.toFixed(1)}s (mínimo: ${minTime}s)`,
                    stepFrom: fromStep,
                    stepTo: toStep,
                    timeTaken: timeTaken
                };

                await recordInfraction(studentId, infraction);

                // Get updated status with new infraction
                const updatedStatus = await getStudentSecurityStatus(studentId);
                const allInfractions = updatedStatus?.infractions || [];
                const speedViolations = allInfractions.filter(i => i.type === 'speed_violation');

                // Check for 2 consecutive rapid steps (immediate block)
                const lastTwoViolations = speedViolations.slice(-2);
                if (lastTwoViolations.length >= 2) {
                    const time1 = new Date(lastTwoViolations[0].timestamp);
                    const time2 = new Date(lastTwoViolations[1].timestamp);
                    const timeBetween = (time2.getTime() - time1.getTime()) / 1000;

                    // If both violations happened within 30 seconds of each other = consecutive rapid steps
                    if (timeBetween < 30) {
                        await disableStudent(studentId,
                            `BLOQUEO AUTOMÁTICO: 2 pasos consecutivos demasiado rápidos. ` +
                            `Pasos: "${lastTwoViolations[0].stepFrom}" → "${lastTwoViolations[0].stepTo}" y ` +
                            `"${lastTwoViolations[1].stepFrom}" → "${lastTwoViolations[1].stepTo}". ` +
                            `Posible intento de saltar el proceso sin leer instrucciones.`
                        );
                        return {
                            valid: false,
                            infraction: 'Tu cuenta ha sido inhabilitada por avanzar demasiado rápido en pasos consecutivos.',
                            disabled: true
                        };
                    }
                }

                // Check if should disable (2 total speed violations = disable)
                if (speedViolations.length >= 2) {
                    await disableStudent(studentId,
                        `BLOQUEO AUTOMÁTICO: ${speedViolations.length} infracciones de velocidad. ` +
                        `Última infracción: "${fromStep}" a "${toStep}" en ${timeTaken.toFixed(1)}s. ` +
                        `El usuario avanzó sin tomar tiempo para leer las instrucciones.`
                    );
                    return {
                        valid: false,
                        infraction: 'Cuenta inhabilitada por múltiples infracciones de velocidad.',
                        disabled: true
                    };
                }

                return {
                    valid: false,
                    infraction: `⚠️ ¡Vas demasiado rápido! Tómate tu tiempo para seguir las instrucciones. (Infracción ${speedViolations.length}/2)`
                };
            }
        }

        // Update step timing (in student document)
        await setDoc(doc(studentsCollection, studentId), {
            lastStepTime: now.toISOString(),
            lastStep: toStep,
            activeSessionId: sessionId,
            activeSessionStartedAt: status?.activeSessionStartedAt || now.toISOString()
        }, { merge: true });

        return { valid: true };
    } catch (error) {
        console.error('Error validating step timing:', error);
        return { valid: true }; // Allow on error
    }
}

// Record an infraction (in student document)
export async function recordInfraction(studentId: string, infraction: InfractionRecord): Promise<void> {
    try {
        const status = await getStudentSecurityStatus(studentId);
        const infractions = status?.infractions || [];
        infractions.push(infraction);

        await setDoc(doc(studentsCollection, studentId), {
            infractions
        }, { merge: true });
    } catch (error) {
        console.error('Error recording infraction:', error);
    }
}

// Disable a student (writes to student document)
export async function disableStudent(studentId: string, reason: string): Promise<void> {
    try {
        await setDoc(doc(studentsCollection, studentId), {
            disabled: true,
            disabledAt: new Date().toISOString(),
            disabledReason: reason,
            activeSessionId: null // Clear session
        }, { merge: true });
    } catch (error) {
        console.error('Error disabling student:', error);
    }
}

// Enable a student (admin action - writes to student document)
export async function enableStudent(studentId: string, adminId?: string): Promise<void> {
    try {
        await setDoc(doc(studentsCollection, studentId), {
            disabled: false,
            disabledReason: null,
            enabledAt: new Date().toISOString(),
            enabledBy: adminId || 'admin'
        }, { merge: true });
    } catch (error) {
        console.error('Error enabling student:', error);
    }
}

// Subscribe to all security statuses (now from students collection)
export function subscribeToSecurityStatuses(callback: (statuses: StudentSecurityStatus[]) => void) {
    // 🔧 OPTIMIZACIÓN: Solo escuchar estudiantes con disabled=true para reducir tráfico
    const q = query(studentsCollection, where('disabled', '==', true));
    return onSnapshot(q, (snapshot) => {
        const statuses: StudentSecurityStatus[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            statuses.push({
                studentId: docSnap.id,
                disabled: data.disabled || false,
                disabledAt: data.disabledAt,
                disabledReason: data.disabledReason,
                infractions: data.infractions || [],
                activeSessionId: data.activeSessionId,
                activeSessionStartedAt: data.activeSessionStartedAt
            } as StudentSecurityStatus);
        });
        callback(statuses);
    }, (error) => {
        console.error('Security statuses subscription error:', error);
    });
}

// Get all disabled students (now from students collection)
export async function getDisabledStudents(): Promise<StudentSecurityStatus[]> {
    try {
        const q = query(studentsCollection, where('disabled', '==', true));
        const snapshot = await getDocs(q);
        const disabled: StudentSecurityStatus[] = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            disabled.push({
                studentId: docSnap.id,
                disabled: data.disabled || false,
                disabledAt: data.disabledAt,
                disabledReason: data.disabledReason,
                infractions: data.infractions || []
            } as StudentSecurityStatus);
        });
        return disabled;
    } catch (error) {
        console.error('Error getting disabled students:', error);
        return [];
    }
}

// ============================================
// STUDENTS SYSTEM - Datos centralizados
// (studentsCollection definida arriba en COLLECTION REFERENCES)
// ============================================

// Interface para documento de estudiante en Firestore
export interface StudentDocument {
    // Identificadores
    studentId: string;           // ID del documento (número de documento)
    emailNormalized?: string;     // Email sin @gmail.com (para búsquedas)

    // Datos personales (nuevo esquema)
    firstName?: string;
    lastName?: string;
    fullName?: string;
    institution: string;
    phone?: string;
    birth?: string;
    gender?: string;

    // Datos personales (esquema antiguo - compatibilidad)
    first?: string;              // Alternativo a firstName
    last?: string;               // Alternativo a lastName
    email?: string;              // Sin @gmail.com, alternativo a emailNormalized
    password?: string;           // Alternativo a assignedPassword

    // Credenciales asignadas
    assignedEmail?: string;       // Email completo con @gmail.com
    assignedPassword?: string;

    // Estado de verificación
    verificationStatus?: 'PENDING' | 'VERIFIED' | 'MISMATCH' | 'INTRUSO';
    verifiedAt?: string | null;
    verifiedWithEmail?: string | null; // Email used for Google verification
    verifiedWithName?: string | null; // Name from Google account
    googleEmail?: string | null; // Legacy/Alias for verifiedWithEmailto
    createdAt?: string;
    lastActivity?: string | null;
    loginCount?: number;
    updatedAt?: string;

    // Estado de eliminación (CRUD)
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
    syncedFromData?: boolean;

    // Actividad centralizada (anti-duplicados)
    activityLog?: StudentActivity[];
}

// Tipo para actividad del estudiante
export interface StudentActivity {
    type: 'login' | 'copy' | 'step_advance' | 'confirmation' | 'google_verify' | 'other';
    timestamp: string;
    details?: string;
}

// Función auxiliar para normalizar email
function normalizeEmailForId(email: string): string {
    return email.toLowerCase().replace('@gmail.com', '').replace(/[^a-z0-9.]/g, '');
}

// Función auxiliar para limpiar nombre (quitar prefijos IETAC/SG)
function cleanStudentName(first: string): string {
    return first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim();
}

// ============================================
// CRUD FUNCTIONS
// ============================================

/**
 * Crear o actualizar un estudiante en Firestore
 */
export async function upsertStudent(data: {
    first: string;
    last: string;
    email: string;
    id: string;
    password: string;
    gender: string;
    phone: string;
    birth: string;
    institution: string;
}): Promise<boolean> {
    try {
        const emailNormalized = normalizeEmailForId(data.email);
        const firstName = cleanStudentName(data.first);

        const studentDoc: StudentDocument = {
            studentId: data.id,
            emailNormalized,
            firstName,
            lastName: data.last,
            fullName: `${firstName} ${data.last}`,
            institution: data.institution,
            phone: data.phone,
            birth: data.birth,
            gender: data.gender,
            assignedEmail: `${data.email}@gmail.com`,
            assignedPassword: data.password,
            verificationStatus: 'PENDING',
            verifiedAt: null,
            verifiedWithEmail: null,
            createdAt: new Date().toISOString(),
            lastActivity: null,
            loginCount: 0,
            activityLog: []
        };

        await setDoc(doc(studentsCollection, data.id), studentDoc, { merge: true });
        return true;
    } catch (error) {
        console.error('Error upserting student:', error);
        return false;
    }
}

/**
 * Obtener estudiante por ID
 */
export async function getStudentById(studentId: string): Promise<StudentDocument | null> {
    try {
        const docRef = doc(studentsCollection, studentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as StudentDocument;
        }
        return null;
    } catch (error) {
        console.error('Error getting student:', error);
        return null;
    }
}

/**
 * Obtener todos los estudiantes
 */
export async function getAllStudents(): Promise<StudentDocument[]> {
    try {
        const snapshot = await getDocs(studentsCollection);
        const students: StudentDocument[] = [];
        snapshot.forEach((docSnap) => {
            students.push(docSnap.data() as StudentDocument);
        });
        return students;
    } catch (error) {
        console.error('Error getting all students:', error);
        return [];
    }
}

/**
 * Actualizar datos de un estudiante
 */
export async function updateStudentData(studentId: string, data: Partial<StudentDocument>): Promise<boolean> {
    try {
        const docRef = doc(studentsCollection, studentId);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error('Error updating student:', error);
        return false;
    }
}

/**
 * Agregar actividad al log del estudiante (centralizado, anti-duplicados)
 */
export async function logStudentActivityCentralized(
    studentId: string,
    activity: Omit<StudentActivity, 'timestamp'>
): Promise<boolean> {
    try {
        const docRef = doc(studentsCollection, studentId);
        await updateDoc(docRef, {
            activityLog: arrayUnion({
                ...activity,
                timestamp: new Date().toISOString()
            }),
            lastActivity: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error logging student activity:', error);
        return false;
    }
}

/**
 * Incrementar contador de login
 */
export async function incrementLoginCount(studentId: string): Promise<boolean> {
    try {
        const student = await getStudentById(studentId);
        if (student) {
            await updateDoc(doc(studentsCollection, studentId), {
                loginCount: (student.loginCount || 0) + 1,
                lastActivity: serverTimestamp()
            });
        }
        return true;
    } catch (error) {
        console.error('Error incrementing login count:', error);
        return false;
    }
}

// ============================================
// VERIFICACIÓN GOOGLE AUTH
// ============================================

/**
 * Marcar estudiante como verificado con Google
 */
export async function markStudentVerified(
    studentId: string,
    googleEmail: string
): Promise<boolean> {
    try {
        await updateDoc(doc(studentsCollection, studentId), {
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date().toISOString(),
            verifiedWithEmail: googleEmail,
            activityLog: arrayUnion({
                type: 'google_verify',
                timestamp: new Date().toISOString(),
                details: `Verificado con Google: ${googleEmail}`
            })
        });
        return true;
    } catch (error) {
        console.error('Error marking student verified:', error);
        return false;
    }
}

/**
 * Marcar verificación como mismatch (email no coincide)
 */
export async function markVerificationMismatch(
    studentId: string,
    attemptedEmail: string,
    attemptedName?: string
): Promise<boolean> {
    try {
        await updateDoc(doc(studentsCollection, studentId), {
            verificationStatus: 'MISMATCH',
            activityLog: arrayUnion({
                type: 'google_verify',
                timestamp: new Date().toISOString(),
                details: `MISMATCH: Intentó verificar con ${attemptedEmail} (${attemptedName || 'Nombre no disponible'})`
            })
        });
        return true;
    } catch (error) {
        console.error('Error marking verification mismatch:', error);
        return false;
    }
}

/**
 * Resetear verificación (acción admin)
 */
export async function resetVerification(studentId: string): Promise<boolean> {
    try {
        await updateDoc(doc(studentsCollection, studentId), {
            verificationStatus: 'PENDING',
            verifiedAt: null,
            verifiedWithEmail: null
        });
        return true;
    } catch (error) {
        console.error('Error resetting verification:', error);
        return false;
    }
}

// ============================================
// SEED FUNCTION (para migrar datos desde data.ts)
// ============================================

/**
 * Seed masivo de estudiantes a Firestore
 * Usar desde consola del navegador o un endpoint admin
 */
export async function seedStudentsToFirestore(students: Array<{
    first: string;
    last: string;
    email: string;
    id: string;
    password: string;
    gender: string;
    phone: string;
    birth: string;
    institution: string;
}>): Promise<{ success: number; errors: number }> {
    const batch = writeBatch(db);
    let success = 0;
    let errors = 0;

    for (const student of students) {
        try {
            const emailNormalized = normalizeEmailForId(student.email);
            const firstName = cleanStudentName(student.first);

            const studentDoc: StudentDocument = {
                studentId: student.id,
                emailNormalized,
                firstName,
                lastName: student.last,
                fullName: `${firstName} ${student.last}`,
                institution: student.institution,
                phone: student.phone,
                birth: student.birth,
                gender: student.gender,
                assignedEmail: `${student.email}@gmail.com`,
                assignedPassword: student.password,
                verificationStatus: 'PENDING',
                verifiedAt: null,
                verifiedWithEmail: null,
                createdAt: new Date().toISOString(),
                lastActivity: null,
                loginCount: 0,
                activityLog: []
            };

            batch.set(doc(studentsCollection, student.id), studentDoc);
            success++;
        } catch (error) {
            console.error(`Error preparing student ${student.id}:`, error);
            errors++;
        }
    }

    try {
        await batch.commit();
        console.log(`✅ Seed completado: ${success} estudiantes creados, ${errors} errores`);
    } catch (error) {
        console.error('Error committing batch:', error);
        errors = students.length;
        success = 0;
    }

    return { success, errors };
}

// ============================================
// SUSCRIPCIÓN EN TIEMPO REAL
// ============================================

/**
 * Suscribirse a cambios en estudiantes (para admin)
 */
export function subscribeToStudents(callback: (students: StudentDocument[]) => void) {
    return onSnapshot(studentsCollection, (snapshot) => {
        const students: StudentDocument[] = [];
        snapshot.forEach((docSnap) => {
            students.push(docSnap.data() as StudentDocument);
        });
        callback(students);
    }, (error) => {
        console.error('Students subscription error:', error);
    });
}

/**
 * Obtener estadísticas de verificación
 */
export async function getVerificationStats(): Promise<{
    total: number;
    verified: number;
    pending: number;
    mismatch: number;
    rate: number;
}> {
    const students = await getAllStudents();
    const verified = students.filter(s => s.verificationStatus === 'VERIFIED').length;
    const pending = students.filter(s => s.verificationStatus === 'PENDING').length;
    const mismatch = students.filter(s => s.verificationStatus === 'MISMATCH').length;

    return {
        total: students.length,
        verified,
        pending,
        mismatch,
        rate: students.length > 0 ? Math.round((verified / students.length) * 100) : 0
    };
}

// ============================================
// GOOGLE AUTH VERIFICATION
// ============================================

/**
 * Verificar cuenta del estudiante con Google Auth
 * Compara el email de Google con el email asignado
 */
export async function verifyWithGoogleAuth(
    studentId: string,
    expectedEmail: string
): Promise<{
    success: boolean;
    message: string;
    googleEmail?: string;
}> {
    try {
        // 1. Abrir popup de Google
        const result = await signInWithPopup(auth, googleProvider);
        const googleEmail = result.user.email?.toLowerCase() || '';

        // 2. Cerrar sesión inmediatamente (solo queríamos el email)
        await signOut(auth);

        // 3. Normalizar y comparar emails
        const normalizedExpected = expectedEmail.toLowerCase().replace('@gmail.com', '');
        const normalizedGoogle = googleEmail.replace('@gmail.com', '');

        if (normalizedExpected === normalizedGoogle) {
            // ✅ ÉXITO - Marcar como verificado
            await markStudentVerified(studentId, googleEmail);

            // Log centralizado
            await logStudentActivityCentralized(studentId, {
                type: 'google_verify',
                details: `✅ Verificación exitosa con ${googleEmail}`
            });

            return {
                success: true,
                message: '¡Excelente! Tu cuenta fue creada correctamente.',
                googleEmail
            };
        }

        // ❌ MISMATCH - Email no coincide
        await markVerificationMismatch(studentId, googleEmail);

        // Log centralizado
        await logStudentActivityCentralized(studentId, {
            type: 'google_verify',
            details: `❌ Mismatch: esperado ${expectedEmail}, recibido ${googleEmail}`
        });

        return {
            success: false,
            message: `El correo ${googleEmail} NO coincide con el asignado (${expectedEmail}).`,
            googleEmail
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Google Auth verification error:', error);

        // Log del error
        await logStudentActivityCentralized(studentId, {
            type: 'other',
            details: `Error en verificación Google: ${errorMessage}`
        });

        return {
            success: false,
            message: 'Error al verificar. Por favor intenta de nuevo.'
        };
    }
}

/**
 * Suscribirse a cambios en el estado de autenticación
 */
export function subscribeToAuthState(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

// ============================================
// SEGUIMIENTO UNIFICADO - Reemplaza saveActivityEvent
// ============================================

/**
 * Registrar actividad unificada (reemplaza el sistema disperso anterior)
 * Todos los eventos van al documento del estudiante en 'students'
 */
export async function trackStudentActivity(
    studentId: string,
    eventType: 'login' | 'copy' | 'step_advance' | 'confirmation' | 'google_verify' | 'credential_view' | 'other',
    details?: string
): Promise<boolean> {
    try {
        // Solo usar el log centralizado en el documento del estudiante
        const docRef = doc(studentsCollection, studentId);
        const studentDoc = await getDoc(docRef);

        if (studentDoc.exists()) {
            // Estudiante existe en la nueva colección - usar log centralizado
            await updateDoc(docRef, {
                activityLog: arrayUnion({
                    type: eventType,
                    timestamp: new Date().toISOString(),
                    details: details || ''
                }),
                lastActivity: serverTimestamp(),
                loginCount: eventType === 'login'
                    ? (studentDoc.data().loginCount || 0) + 1
                    : studentDoc.data().loginCount || 0
            });
            return true;
        }

        // Fallback: estudiante no está en la nueva colección aún
        // Usar el sistema antiguo temporalmente
        console.warn(`Student ${studentId} not found in 'students' collection, using legacy logging`);
        return false;
    } catch (error) {
        console.error('Error tracking student activity:', error);
        return false;
    }
}

// ============================================
// EXPRESS VERIFICATION FLOW - Skip Steps System
// ============================================

// Interface para historial de verificación express
export interface SkipVerificationAttempt {
    timestamp: string;
    googleEmail: string;
    expectedEmail: string;
    success: boolean;
    details: string;
    userAgent?: string;
}

// Constantes de seguridad
const MAX_SKIP_ATTEMPTS_PER_DAY = 3;
const COOLDOWN_AFTER_FAILURE_MS = 5 * 60 * 1000; // 5 minutos
const MAX_CONSECUTIVE_MISMATCHES = 3;

/**
 * Verificar si el estudiante puede intentar skip (rate limiting)
 */
export async function canAttemptExpressVerification(studentId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingAttempts?: number;
    cooldownEndsAt?: string;
}> {
    // 🧪 TEST USER BYPASS - Unlimited attempts
    if (studentId === TEST_USER_ID) return { allowed: true, remainingAttempts: 999 };

    try {
        const student = await getStudentById(studentId);
        if (!student) {
            return { allowed: false, reason: 'Estudiante no encontrado en el sistema.' };
        }

        // Verificar estado de verificación actual
        if (student.verificationStatus === 'VERIFIED') {
            return { allowed: false, reason: 'Tu cuenta ya está verificada.' };
        }

        // Obtener historial de intentos de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const activityLog = student.activityLog || [];
        const todaySkipAttempts = activityLog.filter(
            a => a.type === 'google_verify' &&
                a.timestamp >= todayISO &&
                a.details?.includes('EXPRESS')
        );

        // Rate limiting: máximo 3 intentos por día
        if (todaySkipAttempts.length >= MAX_SKIP_ATTEMPTS_PER_DAY) {
            return {
                allowed: false,
                reason: `Has alcanzado el límite de ${MAX_SKIP_ATTEMPTS_PER_DAY} intentos diarios. Intenta mañana.`,
                remainingAttempts: 0
            };
        }

        // Cooldown: verificar último intento fallido
        const lastFailedAttempt = activityLog
            .filter(a => a.type === 'google_verify' &&
                a.details?.includes('EXPRESS') &&
                a.details?.includes('MISMATCH'))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (lastFailedAttempt) {
            const lastFailTime = new Date(lastFailedAttempt.timestamp).getTime();
            const now = Date.now();
            const timeSinceLastFail = now - lastFailTime;

            if (timeSinceLastFail < COOLDOWN_AFTER_FAILURE_MS) {
                const cooldownEndsAt = new Date(lastFailTime + COOLDOWN_AFTER_FAILURE_MS);
                const remainingSeconds = Math.ceil((COOLDOWN_AFTER_FAILURE_MS - timeSinceLastFail) / 1000);
                return {
                    allowed: false,
                    reason: `Debes esperar ${Math.ceil(remainingSeconds / 60)} minutos antes de intentar de nuevo.`,
                    cooldownEndsAt: cooldownEndsAt.toISOString()
                };
            }
        }

        // Verificar mismatches consecutivos
        const recentMismatches = activityLog
            .filter(a => a.type === 'google_verify' && a.details?.includes('MISMATCH'))
            .slice(-MAX_CONSECUTIVE_MISMATCHES);

        if (recentMismatches.length >= MAX_CONSECUTIVE_MISMATCHES) {
            // Verificar si todos son consecutivos (sin éxitos entre ellos)
            const lastSuccess = activityLog
                .filter(a => a.type === 'google_verify' && a.details?.includes('VERIFIED'))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

            const oldestMismatch = recentMismatches[0];
            if (!lastSuccess || new Date(oldestMismatch.timestamp) > new Date(lastSuccess.timestamp)) {
                // 3 mismatches consecutivos sin éxito - bloquear cuenta
                await disableStudent(studentId,
                    `BLOQUEO AUTOMÁTICO: ${MAX_CONSECUTIVE_MISMATCHES} intentos de verificación fallidos consecutivos. ` +
                    `El usuario intentó verificar con emails incorrectos múltiples veces.`
                );
                return {
                    allowed: false,
                    reason: 'Tu cuenta ha sido inhabilitada por múltiples intentos fallidos. Contacta al administrador.'
                };
            }
        }

        return {
            allowed: true,
            remainingAttempts: MAX_SKIP_ATTEMPTS_PER_DAY - todaySkipAttempts.length
        };
    } catch (error) {
        console.error('Error checking express verification eligibility:', error);
        return { allowed: false, reason: 'Error al verificar elegibilidad. Intenta de nuevo.' };
    }
}

/**
 * Ejecutar verificación express con Google Auth
 * Esta función maneja todo el flujo de skip de pasos
 */
export async function executeExpressVerification(
    studentId: string,
    expectedEmail: string
): Promise<{
    success: boolean;
    verified: boolean;
    message: string;
    googleEmail?: string;
    shouldRedirectToLogin?: boolean;
}> {
    try {
        // 1. Verificar elegibilidad primero
        const eligibility = await canAttemptExpressVerification(studentId);
        if (!eligibility.allowed) {
            return {
                success: false,
                verified: false,
                message: eligibility.reason || 'No puedes realizar esta verificación en este momento.'
            };
        }

        // 2. Abrir popup de Google
        const result = await signInWithPopup(auth, googleProvider);
        const googleEmail = result.user.email?.toLowerCase() || '';

        // 3. Cerrar sesión inmediatamente (solo queríamos el email)
        await signOut(auth);

        // 4. Normalizar y comparar emails
        const normalizedExpected = expectedEmail.toLowerCase().replace('@gmail.com', '');
        const normalizedGoogle = googleEmail.replace('@gmail.com', '');

        const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'server';

        if (normalizedExpected === normalizedGoogle) {
            // ✅ ÉXITO - Marcar como verificado
            await markStudentVerified(studentId, googleEmail);

            // Log de éxito EXPRESS
            await logStudentActivityCentralized(studentId, {
                type: 'google_verify',
                details: `✅ EXPRESS VERIFIED: Verificación express exitosa con ${googleEmail}`
            });

            return {
                success: true,
                verified: true,
                message: '¡Excelente! Tu cuenta ha sido verificada correctamente.',
                googleEmail
            };
        }

        // ❌ MISMATCH - Email no coincide
        await markVerificationMismatch(studentId, googleEmail);

        // Log de fallo EXPRESS con detalles para auditoría
        await logStudentActivityCentralized(studentId, {
            type: 'google_verify',
            details: `❌ EXPRESS MISMATCH: Esperado ${expectedEmail}, recibido ${googleEmail}. UA: ${userAgent.substring(0, 100)}`
        });

        return {
            success: true, // La operación fue exitosa, pero no verificó
            verified: false,
            message: `El correo "${googleEmail}" no coincide con tu cuenta asignada. Serás redirigido al inicio.`,
            googleEmail,
            shouldRedirectToLogin: true
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

        // Detectar si el usuario canceló el popup
        if (errorMessage.includes('popup-closed') || errorMessage.includes('cancelled')) {
            return {
                success: false,
                verified: false,
                message: 'Verificación cancelada. Puedes intentar de nuevo.'
            };
        }

        console.error('Express verification error:', error);

        // Log del error
        await logStudentActivityCentralized(studentId, {
            type: 'other',
            details: `Error en verificación EXPRESS: ${errorMessage}`
        });

        return {
            success: false,
            verified: false,
            message: 'Error al conectar con Google. Por favor intenta de nuevo.'
        };
    }
}

/**
 * Obtener estadísticas de verificación express para admin
 */
export async function getExpressVerificationStats(): Promise<{
    totalExpressAttempts: number;
    successfulExpress: number;
    failedExpress: number;
    blockedByMismatch: number;
}> {
    try {
        const students = await getAllStudents();
        let totalExpressAttempts = 0;
        let successfulExpress = 0;
        let failedExpress = 0;
        let blockedByMismatch = 0;

        students.forEach(student => {
            const expressAttempts = (student.activityLog || []).filter(
                a => a.type === 'google_verify' && a.details?.includes('EXPRESS')
            );
            totalExpressAttempts += expressAttempts.length;
            successfulExpress += expressAttempts.filter(a => a.details?.includes('VERIFIED')).length;
            failedExpress += expressAttempts.filter(a => a.details?.includes('MISMATCH')).length;
        });

        // Contar bloqueados por mismatch (from students collection)
        const securityQuery = query(studentsCollection, where('disabled', '==', true));
        const securitySnapshot = await getDocs(securityQuery);
        securitySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.disabledReason?.includes('intentos de verificación fallidos')) {
                blockedByMismatch++;
            }
        });

        return {
            totalExpressAttempts,
            successfulExpress,
            failedExpress,
            blockedByMismatch
        };
    } catch (error) {
        console.error('Error getting express verification stats:', error);
        return {
            totalExpressAttempts: 0,
            successfulExpress: 0,
            failedExpress: 0,
            blockedByMismatch: 0
        };
    }
}

// ============================================
// 🧠 SISTEMA DE VERIFICACIÓN INTELIGENTE V2
// ============================================

/**
 * Tipo de resultado de verificación inteligente
 */
export type VerificationResult =
    | { type: 'INTRUSO'; message: string; detectedEmail: string }
    | { type: 'PRIMERA_VEZ'; message: string; studentData: StudentDocument }
    | { type: 'VETERANO'; message: string; studentData: StudentDocument }
    | { type: 'CANCELLED'; message: string }
    | { type: 'ERROR'; message: string };

/**
 * 🧠 VERIFICACIÓN INTELIGENTE CON GOOGLE AUTH
 * 
 * Árbol de decisión:
 * 🔴 RAMA A (Intruso): Email no existe → SignOut + Error + Redirect Home
 * 🟢 RAMA B (Primera Vez): Existe + PENDING → Update DB + Toast Éxito
 * 🚀 RAMA C (Veterano): Existe + VERIFIED → Fast-track, cero modales
 * 
 * @param authenticatedStudentId - ID del estudiante que está logueado en el sistema
 * @param authenticatedStudentName - Nombre del estudiante logueado
 * @param authenticatedInstitution - Institución del estudiante logueado
 * @param assignedEmail - Email asignado al estudiante (para comparación)
 */
export async function intelligentGoogleVerification(
    authenticatedStudentId?: string,
    authenticatedStudentName?: string,
    authenticatedInstitution?: string,
    assignedEmail?: string
): Promise<VerificationResult> {
    try {
        // PASO 1: Autenticación con Google (Popup)
        const result = await signInWithPopup(auth, googleProvider);
        const googleEmail = result.user.email?.toLowerCase() || '';
        const googleName = result.user.displayName || 'Nombre Desconocido';
        const normalizedEmail = googleEmail.replace('@gmail.com', '');

        // PASO 2: Buscar en nuestra "Lista de Invitados" (students collection)
        // PASO 2: Buscar en nuestra "Lista de Invitados" (students collection)
        // ESTRATEGIA HÍBRIDA: ID (Más confiable) > Email (Fallback)
        let studentDoc: StudentDocument | null = null;
        let isIdLookup = false;

        // A. Intentar buscar por ID si el usuario está autenticado (Lo más seguro)
        if (authenticatedStudentId) {
            studentDoc = await getStudentById(authenticatedStudentId);
            if (studentDoc) isIdLookup = true;
        }

        // B. Si no se encontró por ID (o no hay ID), intentar buscar por Email
        if (!studentDoc) {
            studentDoc = await getStudentByEmail(googleEmail);
        }

        // 🔴 RAMA A: EL INTRUSO (Email no está en nuestra base de datos ni corresponde al usuario)
        if (!studentDoc) {
            // Logout forzado INMEDIATO
            await signOut(auth);

            // 📝 REGISTRAR INTENTO DE INTRUSO
            await saveActivityEvent({
                type: 'google_intruso',
                studentId: authenticatedStudentId || 'SIN_SESSION',
                studentName: authenticatedStudentName || 'Usuario sin sesión',
                institution: authenticatedInstitution || 'N/A',
                details: `⛔ INTRUSO: Email ${googleEmail} no encontrado en base de datos. Nombre Google: ${googleName}`
            });

            return {
                type: 'INTRUSO',
                message: `⛔ Acceso Denegado: El correo "${googleEmail}" no está autorizado. Debes iniciar sesión ÚNICAMENTE con la cuenta institucional que te asignamos.`,
                detectedEmail: googleEmail
            };
        }

        // VALIDACIÓN DE IDENTIDAD EXTENDIDA (Si buscamos por ID)
        if (isIdLookup && studentDoc) {
            // Verificar que el email de Google coincida con el asignado
            const assigned = (studentDoc.assignedEmail || studentDoc.email || '').toLowerCase().replace('@gmail.com', '');

            // Si hay un mismatch, manejémoslo aquí
            if (assigned !== normalizedEmail) {
                // Pero espera... si ya estaba verificado y usa SU email verificado, está bien.
                const alreadyVerifiedEmail = (studentDoc.verifiedWithEmail || '').toLowerCase().replace('@gmail.com', '');

                if (studentDoc.verificationStatus === 'VERIFIED' && alreadyVerifiedEmail === normalizedEmail) {
                    // Es el usuario verificado entrando correctamente (Fast Track)
                    // Dejamos pasar a la lógica de VETERANO abajo
                } else {
                    // REAL MISMATCH
                    await markVerificationMismatch(studentDoc.studentId, googleEmail, googleName);
                    await signOut(auth);
                    return {
                        type: 'ERROR', // O un tipo específico MISMATCH
                        message: `⛔ Error de Identidad: Estás logueado como ${studentDoc.first}, pero intentaste verificar con "${googleEmail}" que no es tu correo asignado (${assigned}@gmail.com).`
                    };
                }
            }
        }

        // El email existe en nuestra base de datos - Ahora verificamos el estado
        const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'server';

        if (studentDoc.verificationStatus === 'PENDING' || studentDoc.verificationStatus === 'MISMATCH') {
            // 🟢 RAMA B: EL CUMPLIDOR (Primera vez verificando)

            // Actualizar a VERIFIED
            await updateStudentData(studentDoc.studentId, {
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date().toISOString(),
                verifiedWithEmail: googleEmail,
                verifiedWithName: googleName,
                loginCount: (studentDoc.loginCount || 0) + 1,
                lastActivity: new Date().toISOString()
            });

            // Log de verificación exitosa
            await logStudentActivityCentralized(studentDoc.studentId, {
                type: 'google_verify',
                details: `✅ VERIFICACIÓN EXITOSA: Cuenta activada con ${googleEmail}. UA: ${userAgent.substring(0, 50)}`
            });

            // Cerrar sesión de Google (ya tenemos lo que necesitamos)
            await signOut(auth);

            return {
                type: 'PRIMERA_VEZ',
                message: '✅ ¡Perfecto! Tu cuenta ha sido verificada y activada.',
                studentData: { ...studentDoc, verificationStatus: 'VERIFIED' }
            };
        }

        // 🚀 RAMA C: EL VETERANO (Ya está verificado - Fast Track)
        if (studentDoc.verificationStatus === 'VERIFIED') {
            // Solo actualizar lastLogin (operación ligera)
            await updateStudentData(studentDoc.studentId, {
                loginCount: (studentDoc.loginCount || 0) + 1,
                lastActivity: new Date().toISOString()
            });

            // Log mínimo
            await logStudentActivityCentralized(studentDoc.studentId, {
                type: 'login',
                details: `🚀 FAST-TRACK: Re-ingreso de usuario verificado`
            });

            // Cerrar sesión de Google
            await signOut(auth);

            return {
                type: 'VETERANO',
                message: '👋 Hola de nuevo, todo está en orden.',
                studentData: studentDoc
            };
        }

        // Fallback para cualquier otro estado
        await signOut(auth);
        return {
            type: 'ERROR',
            message: 'Estado de cuenta desconocido. Contacta al administrador.'
        };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

        // Usuario canceló el popup
        if (errorMessage.includes('popup-closed') || errorMessage.includes('cancelled')) {
            return {
                type: 'CANCELLED',
                message: 'Verificación cancelada.'
            };
        }

        console.error('intelligentGoogleVerification error:', error);

        return {
            type: 'ERROR',
            message: 'Error al conectar con Google. Intenta de nuevo.'
        };
    }
}

/**
 * Buscar estudiante por email normalizado (sin @gmail.com)
 * Busca en la colección students usando el email como clave
 */
async function getStudentByEmail(email: string): Promise<StudentDocument | null> {
    try {
        const normalized = email.toLowerCase().replace('@gmail.com', '');
        const q = query(studentsCollection, where('assignedEmail', '==', `${normalized}@gmail.com`));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return { ...doc.data(), studentId: doc.id } as StudentDocument;
    } catch (error) {
        console.error('Error searching student by email:', error);
        return null;
    }
}

// Export auth para uso externo si es necesario
export { auth, googleProvider };

// ============================================
// 🛠️ CRUD SYSTEM FOR ADMINISTRATORS
// ============================================

/**
 * Interfaz para crear/editar estudiantes
 */
export interface StudentCRUDData {
    id: string;
    first: string;
    last: string;
    birth: string;
    gender: string;
    email: string;
    password: string;
    phone: string;
    institution: string;
}

/**
 * Tokens de eliminación activos (en memoria para seguridad)
 * El token expira en 60 segundos
 */
const deletionTokens: Map<string, { studentId: string; token: string; expiresAt: number; adminId: string }> = new Map();

/**
 * Genera un token de 6 dígitos para confirmar eliminación
 */
export function generateDeletionToken(studentId: string, adminId: string): string {
    // Limpiar tokens expirados
    const now = Date.now();
    deletionTokens.forEach((value, key) => {
        if (value.expiresAt < now) {
            deletionTokens.delete(key);
        }
    });

    // Generar token de 6 dígitos
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 60000; // Expira en 60 segundos

    deletionTokens.set(studentId, { studentId, token, expiresAt, adminId });

    console.log(`🔐 Token de eliminación generado para ${studentId}: ${token} (expira en 60s)`);

    return token;
}

/**
 * Valida un token de eliminación
 */
export function validateDeletionToken(studentId: string, inputToken: string, adminId: string): { valid: boolean; message: string } {
    const tokenData = deletionTokens.get(studentId);

    if (!tokenData) {
        return { valid: false, message: 'No hay token activo para este estudiante. Genera uno nuevo.' };
    }

    if (tokenData.expiresAt < Date.now()) {
        deletionTokens.delete(studentId);
        return { valid: false, message: 'El token ha expirado. Genera uno nuevo.' };
    }

    if (tokenData.adminId !== adminId) {
        return { valid: false, message: 'Token no válido para este administrador.' };
    }

    if (tokenData.token !== inputToken) {
        return { valid: false, message: 'Token incorrecto. Verifica el código.' };
    }

    // Token válido - eliminarlo para que no se pueda reusar
    deletionTokens.delete(studentId);
    return { valid: true, message: 'Token válido.' };
}

/**
 * Crea un nuevo estudiante en Firestore
 */
export async function createStudent(studentData: StudentCRUDData): Promise<{ success: boolean; message: string }> {
    try {
        // Verificar que no exista ya
        const existingDoc = await getDoc(doc(studentsCollection, studentData.id));
        if (existingDoc.exists()) {
            return { success: false, message: 'Ya existe un estudiante con este ID.' };
        }

        // Crear el documento
        await setDoc(doc(studentsCollection, studentData.id), {
            studentId: studentData.id,
            first: studentData.first,
            last: studentData.last,
            birth: studentData.birth,
            gender: studentData.gender,
            email: studentData.email,
            password: studentData.password,
            phone: studentData.phone,
            institution: studentData.institution,
            assignedEmail: `${studentData.email}@gmail.com`,
            verificationStatus: 'PENDING',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            loginCount: 0
        });

        // Registrar el evento
        await saveActivityEvent({
            type: 'login',
            studentId: studentData.id,
            studentName: `${studentData.first} ${studentData.last}`,
            institution: studentData.institution,
            details: `🆕 Estudiante creado por admin`
        });

        return { success: true, message: 'Estudiante creado exitosamente.' };
    } catch (error) {
        console.error('Error creating student:', error);
        return { success: false, message: 'Error al crear el estudiante.' };
    }
}

/**
 * Actualiza un estudiante existente
 * IMPORTANTE: Registra cambios automáticamente para sincronización con data.ts
 */
export async function updateStudentCRUD(
    studentId: string,
    updates: Partial<StudentCRUDData>,
    adminId: string = 'admin'
): Promise<{ success: boolean; message: string }> {
    try {
        const docRef = doc(studentsCollection, studentId);
        const existingDoc = await getDoc(docRef);

        if (!existingDoc.exists()) {
            return { success: false, message: 'Estudiante no encontrado.' };
        }

        const existingData = existingDoc.data();

        // Preparar datos de actualización
        const updateData: Record<string, unknown> = {
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: adminId
        };

        // Si se actualiza el email, actualizar también assignedEmail
        if (updates.email) {
            updateData.assignedEmail = `${updates.email}@gmail.com`;
        }

        await updateDoc(docRef, updateData);

        // 📝 REGISTRAR CAMBIOS PARA SINCRONIZACIÓN
        const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
        Object.keys(updates).forEach(field => {
            const oldVal = existingData[field];
            const newVal = (updates as Record<string, unknown>)[field];
            if (oldVal !== newVal) {
                changes.push({
                    field,
                    oldValue: oldVal ?? null,
                    newValue: newVal ?? null
                });
            }
        });

        if (changes.length > 0) {
            await logCRUDChange({
                action: 'UPDATE',
                studentId,
                studentName: `${existingData.first || existingData.firstName || ''} ${existingData.last || existingData.lastName || ''}`.trim(),
                adminId,
                changes: changes as CRUDLogEntry['changes']
            });
        }

        // Registrar el evento de actividad
        await saveActivityEvent({
            type: 'admin_action',
            studentId: studentId,
            studentName: updates.first && updates.last ? `${updates.first} ${updates.last}` : 'Estudiante',
            institution: updates.institution || existingData.institution || 'Desconocida',
            details: `📝 Datos actualizados por ${adminId}: ${changes.map(c => c.field).join(', ')}`
        });

        return { success: true, message: `Estudiante actualizado. ${changes.length} campo(s) modificado(s).` };
    } catch (error) {
        console.error('Error updating student:', error);
        return { success: false, message: 'Error al actualizar el estudiante.' };
    }
}

/**
 * Elimina un estudiante (REQUIERE TOKEN DE CONFIRMACIÓN)
 */
export async function deleteStudent(
    studentId: string,
    confirmationToken: string,
    adminId: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Validar el token primero
        const tokenValidation = validateDeletionToken(studentId, confirmationToken, adminId);
        if (!tokenValidation.valid) {
            return { success: false, message: tokenValidation.message };
        }

        const docRef = doc(studentsCollection, studentId);
        const existingDoc = await getDoc(docRef);

        if (!existingDoc.exists()) {
            return { success: false, message: 'Estudiante no encontrado.' };
        }

        const studentData = existingDoc.data();

        // En lugar de eliminar físicamente, marcamos como eliminado (soft delete)
        // Esto permite recuperación si es necesario
        await updateDoc(docRef, {
            deleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: adminId,
            previousData: studentData // Guardar datos anteriores para posible recuperación
        });

        // Registrar el evento de eliminación
        await saveActivityEvent({
            type: 'login',
            studentId: studentId,
            studentName: `${studentData.first || ''} ${studentData.last || ''}`,
            institution: studentData.institution || 'Desconocida',
            details: `🗑️ ELIMINADO por admin ${adminId} (soft delete)`
        });

        return { success: true, message: 'Estudiante eliminado exitosamente.' };
    } catch (error) {
        console.error('Error deleting student:', error);
        return { success: false, message: 'Error al eliminar el estudiante.' };
    }
}

/**
 * Restaura un estudiante eliminado (soft delete)
 */
export async function restoreStudent(studentId: string, adminId: string): Promise<{ success: boolean; message: string }> {
    try {
        const docRef = doc(studentsCollection, studentId);
        const existingDoc = await getDoc(docRef);

        if (!existingDoc.exists()) {
            return { success: false, message: 'Estudiante no encontrado.' };
        }

        const data = existingDoc.data();
        if (!data.deleted) {
            return { success: false, message: 'Este estudiante no está eliminado.' };
        }

        await updateDoc(docRef, {
            deleted: false,
            restoredAt: new Date().toISOString(),
            restoredBy: adminId
        });

        return { success: true, message: 'Estudiante restaurado exitosamente.' };
    } catch (error) {
        console.error('Error restoring student:', error);
        return { success: false, message: 'Error al restaurar el estudiante.' };
    }
}

/**
 * Obtiene todos los estudiantes de Firestore (excluyendo eliminados por defecto)
 */
export async function getAllStudentsFromFirestore(includeDeleted: boolean = false): Promise<StudentDocument[]> {
    try {
        // Usamos un Map para garantizar unicidad por studentId
        const studentsMap = new Map<string, StudentDocument>();

        // 1. Cargar datos locales (Fuente de verdad base)
        studentData.forEach(s => {
            studentsMap.set(s.id, {
                studentId: s.id,
                first: s.first,
                last: s.last,
                firstName: s.first,
                lastName: s.last,
                email: s.email,
                assignedEmail: s.email.includes('@') ? s.email : `${s.email}@gmail.com`,
                institution: s.institution,
                phone: s.phone,
                birth: s.birth,
                gender: s.gender,
                password: s.password,
                verificationStatus: 'PENDING',
                loginCount: 0
            });
        });

        // 2. Obtener datos de Firestore y fusionar/sobrescribir
        const snapshot = await getDocs(studentsCollection);

        snapshot.forEach((docSnap) => {
            const firestoreData = docSnap.data();
            const existingLocal = studentsMap.get(docSnap.id);

            if (existingLocal) {
                // Fusionar: datos locales + Firestore (Firestore tiene prioridad en estado)
                studentsMap.set(docSnap.id, {
                    ...existingLocal,
                    ...firestoreData,
                    studentId: docSnap.id
                } as StudentDocument);
            } else {
                // Estudiante solo en Firestore (creado manualmente)
                studentsMap.set(docSnap.id, {
                    ...firestoreData,
                    studentId: docSnap.id
                } as StudentDocument);
            }
        });

        // 3. Convertir Map a Array y filtrar eliminados
        const students = Array.from(studentsMap.values());
        return students.filter(s => includeDeleted || !s.deleted);

    } catch (error) {
        console.error('Error fetching students from Firestore:', error);
        return [];
    }
}

/**
 * 🧹 UTLIDAD: Limpiar Firestore (Ahorrar espacio/cuota)
 * Elimina documentos de Firestore que son idénticos a los datos locales y están en estado PENDING.
 * Esto borra la redundancia y deja solo los registros activos/verificados.
 */
export async function optimizeFirestoreUsage(): Promise<{ deleted: number, kept: number }> {
    try {
        const snapshot = await getDocs(studentsCollection);
        let deletedCount = 0;
        let keptCount = 0;

        const batchSize = 400; // Límite de batch
        let batch = writeBatch(db);
        let opCounter = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as StudentDocument;

            // Criterios para mantener en Firestore:
            // 1. Está verificado o bloqueado (NO Pending)
            // 2. Tiene actividad registrada
            // 3. NO existe en data.ts (es un usuario nuevo creado por admin)
            const isModified = data.verificationStatus !== 'PENDING' ||
                (data.activityLog && data.activityLog.length > 0) ||
                data.deleted;

            const existsInLocal = studentData.some(s => s.id === docSnap.id);

            if (!isModified && existsInLocal) {
                // Es redundante -> BORRAR
                batch.delete(docSnap.ref);
                deletedCount++;
                opCounter++;
            } else {
                keptCount++;
            }

            if (opCounter >= batchSize) {
                await batch.commit();
                batch = writeBatch(db);
                opCounter = 0;
            }
        }

        if (opCounter > 0) {
            await batch.commit();
        }

        console.log(`🧹 Optimización completada: ${deletedCount} docs redundantes eliminados, ${keptCount} mantenidos.`);
        return { deleted: deletedCount, kept: keptCount };
    } catch (error) {
        console.error('Error optimizing Firestore:', error);
        return { deleted: 0, kept: 0 };
    }
}

/**
 * Obtiene un estudiante por ID desde Firestore
 */
export async function getStudentFromFirestore(studentId: string): Promise<StudentDocument | null> {
    try {
        const docRef = doc(studentsCollection, studentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return null;
        }

        return {
            studentId: docSnap.id,
            ...docSnap.data()
        } as StudentDocument;
    } catch (error) {
        console.error('Error fetching student:', error);
        return null;
    }
}

/**
 * Sincroniza estudiantes de data.ts a Firestore (sin duplicar)
 */
export async function syncStudentsToFirestore(students: StudentCRUDData[]): Promise<{ created: number; updated: number; errors: number }> {
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const student of students) {
        try {
            const docRef = doc(studentsCollection, student.id);
            const existingDoc = await getDoc(docRef);

            if (existingDoc.exists()) {
                // Ya existe - no sobrescribir si ya tiene datos
                const data = existingDoc.data();
                if (!data.syncedFromData) {
                    await updateDoc(docRef, {
                        syncedFromData: true,
                        lastSyncAt: new Date().toISOString()
                    });
                    updated++;
                }
            } else {
                // No existe - crear
                await setDoc(docRef, {
                    studentId: student.id,
                    first: student.first,
                    last: student.last,
                    birth: student.birth,
                    gender: student.gender,
                    email: student.email,
                    password: student.password,
                    phone: student.phone,
                    institution: student.institution,
                    assignedEmail: `${student.email}@gmail.com`,
                    verificationStatus: 'PENDING',
                    createdAt: new Date().toISOString(),
                    syncedFromData: true,
                    loginCount: 0
                });
                created++;
            }
        } catch (error) {
            console.error(`Error syncing student ${student.id}:`, error);
            errors++;
        }
    }

    return { created, updated, errors };
}
