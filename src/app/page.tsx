"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Sidebar from '@/components/Dashboard/Sidebar';
import MobileNav from '@/components/Dashboard/MobileNav';
import Header from '@/components/Dashboard/Header';
import StudentTable from '@/components/Dashboard/StudentTable';
import { studentData, Student } from '@/lib/data';
import {
  subscribeToConfirmations,
  updateConfirmation,
  saveConfirmation,
  saveActivityEvent,
  subscribeToActivityEvents,
  ActivityEvent,
  isStudentActive,
  // Security system
  checkAndRegisterSession,
  generateSessionId,
  isStudentDisabled,
  validateStepTiming,
  clearSession,
  updateSessionActivity,
  subscribeToSecurityStatuses,
  enableStudent,
  disableStudent,
  StudentSecurityStatus,
  // Google Auth & Tracking unificado
  verifyWithGoogleAuth,
  trackStudentActivity,
  // Express verification flow
  executeExpressVerification,
  canAttemptExpressVerification,
  // Verification stats
  getVerificationStats,
  // 🧠 Sistema de Verificación Inteligente V2
  intelligentGoogleVerification,
  VerificationResult,
  // Fast-Track
  getStudentById,
  // 🚀 Optimización: carga bajo demanda
  getConfirmations,
  db
} from '@/lib/firebase';
import { exportToExcel } from '@/lib/exportExcel';
import { exportIETACToExcel } from '@/lib/exportIETAC';
import { Check } from 'lucide-react';
import AdminCRUD from '@/components/AdminCRUD';
import VerificationReport from '@/components/VerificationReport';
import ActivityDashboard from '@/components/ActivityDashboard';
import GoogleVerificationReport from '@/components/GoogleVerificationReport';
import AdminBroadcast from '@/components/AdminBroadcast';
import NotificationSettingsManager from '@/components/NotificationSettingsManager';
import NotificationPermissionButton from '@/components/NotificationPermissionButton';
import NotificationPromptModal from '@/components/NotificationPromptModal';
import AdminAlertsPanel from '@/components/AdminAlertsPanel';
import BroadcastHistory from '@/components/BroadcastHistory';

// ============================================
// 🔧 MODO MANTENIMIENTO
// Cambiar a false para reactivar el sistema
// ============================================
const MAINTENANCE_MODE = false;
const MAINTENANCE_MESSAGE = "Estamos realizando mejoras en el sistema. Volveremos pronto.";

// Credentials type
interface Credentials {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  suggestedPassword: string;
}

// Admin credentials (plain text to avoid decoding errors)
// const _d = (s: string) => atob(s.split('').reverse().join(''));
const ADMIN_ID = '431302100';
const ADMIN_BIRTH = '20/07/2023';

// IETAC Admin credentials
// ID = 3117930027, Birth = 27/05/1990
const IETAC_ADMIN_ID = '3117930027';
const IETAC_ADMIN_BIRTH = '27/05/1990';
const IETAC_ADMIN_NAME = 'Jesús Rodriguez';
const IETAC_ADMIN_ROLE = 'Coordinador';
const IETAC_INSTITUTION = 'IETAC';

// monthsFull definido dentro del componente para evitar duplicación

type AppView = 'login' | 'admin-dashboard' | 'ietac-dashboard' | 'student-flow';
type StudentStep = 'credentials' | 'device-selection' | 'pc-qr' | 'guide-intro' | 'guide-1-name' | 'guide-2-basic' | 'guide-3-email' | 'guide-4-password' | 'confirmation-final';

// 🧪 TEST USER - Bypasses UI restrictions for testing
const TEST_USER_ID = '1045671402';

export default function Home() {
  // Auth state
  const [view, setView] = useState<AppView>('login');
  const [loginId, setLoginId] = useState('');
  const [loginBirth, setLoginBirth] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Student flow state
  const [authenticatedStudent, setAuthenticatedStudent] = useState<Student | null>(null);
  const [studentStep, setStudentStep] = useState<StudentStep>('credentials');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [googleStep, setGoogleStep] = useState(1);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastData, setToastData] = useState<{ message: string; instruction: string; emoji: string } | null>(null);

  // Tutorial/Tour State - Spotlight system
  const [tourActive, setTourActive] = useState(true);
  const [tourStep, setTourStep] = useState<string | null>(null);
  const [showStepIntro, setShowStepIntro] = useState(false);

  const [confirmationStatus, setConfirmationStatus] = useState<'pending' | 'confirming' | 'confirmed' | 'error'>('pending');

  // Admin dashboard state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('ALL');
  const [nameFilter, setNameFilter] = useState('ALL');
  const [lastnameFilter, setLastnameFilter] = useState('ALL');
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [todayLogins, setTodayLogins] = useState(0);
  const [todayConfirmations, setTodayConfirmations] = useState(0);
  const [ietacStatusFilter, setIetacStatusFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [ietacViewMode, setIetacViewMode] = useState<'cards' | 'table'>('cards');
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [adminView, setAdminView] = useState<'data' | 'statistics'>('data');
  const [showAdminCRUD, setShowAdminCRUD] = useState(false);
  const [showVerificationReport, setShowVerificationReport] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showGoogleReport, setShowGoogleReport] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showBroadcastHistory, setShowBroadcastHistory] = useState(false);

  // Security system state - Persist sessionId in localStorage to avoid false positives on reload
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      // Try to get existing sessionId from localStorage
      const existingSessionId = localStorage.getItem('sg_session_id');
      if (existingSessionId) {
        return existingSessionId;
      }
      // Generate new one and save it
      const newSessionId = generateSessionId();
      localStorage.setItem('sg_session_id', newSessionId);
      return newSessionId;
    }
    return generateSessionId();
  });
  const [securityStatuses, setSecurityStatuses] = useState<StudentSecurityStatus[]>([]);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);

  // 🔐 Google Auth verification stats
  const [verificationStats, setVerificationStats] = useState<{
    total: number;
    verified: number;
    pending: number;
    mismatch: number;
    rate: number;
  }>({ total: 0, verified: 0, pending: 0, mismatch: 0, rate: 0 });

  // Modal for name copy confirmation
  const [nameConfirmModal, setNameConfirmModal] = useState<{
    show: boolean;
    fullName: string;
    institution: string;
  } | null>(null);
  const [nameModalCountdown, setNameModalCountdown] = useState(0);

  // Modal for account blocked notification
  const [blockedModal, setBlockedModal] = useState<{
    show: boolean;
    reason: string;
    studentName: string;
  } | null>(null);

  // Modal for credentials download notification
  const [downloadModal, setDownloadModal] = useState<{
    show: boolean;
    downloading: boolean;
  } | null>(null);

  // Welcome modal for students (Google connect or create account)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Tutorial visibility state
  const [showIetacTutorial, setShowIetacTutorial] = useState(false);
  const [ietacTab, setIetacTab] = useState<'students' | 'stats' | 'settings'>('students');
  const [ietacPanelExpanded, setIetacPanelExpanded] = useState(false); // Acordeón para móvil

  // Modal de confirmación final profesional
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [finalConfirmCountdown, setFinalConfirmCountdown] = useState(15);
  const [finalConfirmChecklist, setFinalConfirmChecklist] = useState({
    emailCorrect: false,
    screenshotSaved: false,
    willVerify: false
  });

  // Modales de advertencia profesionales para pasos críticos
  const [showEmailWarningModal, setShowEmailWarningModal] = useState(false);
  const [emailWarningCountdown, setEmailWarningCountdown] = useState(8);
  const [showPasswordWarningModal, setShowPasswordWarningModal] = useState(false);
  const [passwordWarningCountdown, setPasswordWarningCountdown] = useState(6);

  // 🔒 Sistema de detección de interacción (copiado)
  const [copiedFields, setCopiedFields] = useState<{
    firstName: boolean;
    lastName: boolean;
    email: boolean;
    password: boolean;
  }>({
    firstName: false,
    lastName: false,
    email: false,
    password: false
  });

  // Modal de advertencia por no copiar (15 segundos)
  const [showNoCopyWarningModal, setShowNoCopyWarningModal] = useState(false);
  const [noCopyWarningCountdown, setNoCopyWarningCountdown] = useState(15);
  const [noCopyWarningField, setNoCopyWarningField] = useState<string>('');

  // Modal de ultimátum antes del paso 4
  const [showUltimatumModal, setShowUltimatumModal] = useState(false);
  const [ultimatumCountdown, setUltimatumCountdown] = useState(10);
  const [ultimatumAccepted, setUltimatumAccepted] = useState(false);

  // Modal paso 1 - Seguimiento de asistencias
  const [showStep1InfoModal, setShowStep1InfoModal] = useState(false);
  const [step1InfoCountdown, setStep1InfoCountdown] = useState(8);

  // Modal para revisar credenciales sin salir
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

  // Estado de verificación Google Auth
  const [googleVerified, setGoogleVerified] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [googleVerifyError, setGoogleVerifyError] = useState<string | null>(null);

  // 🚀 Estado para verificación EXPRESS (skip steps)
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [expressVerifying, setExpressVerifying] = useState(false);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [expressSuccess, setExpressSuccess] = useState(false);
  const [expressRemainingAttempts, setExpressRemainingAttempts] = useState<number | null>(null);
  const [expressRedirectCountdown, setExpressRedirectCountdown] = useState(5);

  // 🚫 Modal de Intruso (correo no autorizado)
  const [showIntruderModal, setShowIntruderModal] = useState(false);
  const [intruderMessage, setIntruderMessage] = useState('');
  const [intruderEmail, setIntruderEmail] = useState('');

  // 💡 Sugerencias de login basadas en historial
  const [loginSuggestions, setLoginSuggestions] = useState<{ id: string, birth: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Toggle password visibility with Firebase tracking
  const togglePasswordVisibility = async (studentId: string) => {
    const wasHidden = !visiblePasswords.has(studentId);

    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });

    // Solo registrar cuando el usuario MUESTRA la contraseña (no cuando la oculta)
    if (wasHidden) {
      const student = studentData.find(s => s.id === studentId);
      if (student) {
        await saveActivityEvent({
          type: 'view_credentials',
          studentId: student.id,
          studentName: `${student.first} ${student.last}`,
          institution: student.institution,
          phone: student.phone,
          details: 'Hizo visible la contraseña'
        });
      }
    }
  };

  // Copy to clipboard with full Firebase tracking and contextual toasts
  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);

      // 🔒 Rastrear campos críticos copiados
      if (fieldId === 'first') {
        setCopiedFields(prev => ({ ...prev, firstName: true }));
      } else if (fieldId === 'last') {
        setCopiedFields(prev => ({ ...prev, lastName: true }));
      } else if (fieldId === 'user') {
        setCopiedFields(prev => ({ ...prev, email: true }));
      } else if (fieldId === 'pass' || fieldId === 'pass2') {
        setCopiedFields(prev => ({ ...prev, password: true }));
      }


      // Si es el nombre (first), mostrar modal de confirmación por 10 segundos
      if (fieldId === 'first' && authenticatedStudent) {
        const tag = authenticatedStudent.institution === 'IETAC' ? 'IETAC' : 'SG';
        const cleanName = authenticatedStudent.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim().toUpperCase();
        setNameConfirmModal({
          show: true,
          fullName: `${tag} - ${cleanName}`,
          institution: tag
        });
        // Iniciar countdown de 10 segundos
        setNameModalCountdown(10);
        const countdownInterval = setInterval(() => {
          setNameModalCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return; // No mostrar toast normal para el nombre
      }

      // Mostrar toast contextual según el campo copiado
      const toastMessages: Record<string, { message: string; instruction: string; emoji: string }> = {
        'first': { message: '¡Nombre copiado!', instruction: 'Ve a Google y pégalo en el campo "Nombre"', emoji: '📋' },
        'last': { message: '¡Apellidos copiado!', instruction: 'Pégalo en el campo "Apellidos" de Google', emoji: '📋' },
        'day': { message: '¡Día copiado!', instruction: 'Selecciona este día en el selector de Google', emoji: '📅' },
        'month': { message: '¡Mes copiado!', instruction: 'Busca este mes en el dropdown de Google', emoji: '📅' },
        'year': { message: '¡Año copiado!', instruction: 'Ingresa este año en Google', emoji: '📅' },
        'gender': { message: '¡Género copiado!', instruction: 'Selecciona esta opción en Google', emoji: '👤' },
        'user': { message: '¡Usuario copiado!', instruction: 'Pégalo en "Crear tu propia dirección"', emoji: '✉️' },
        'pass': { message: '¡Contraseña copiada!', instruction: 'Pégala en ambos campos de contraseña', emoji: '🔒' },
      };

      const toast = toastMessages[fieldId] || { message: '¡Copiado!', instruction: 'Pégalo en Google', emoji: '📋' };
      setToastData(toast);

      // Ocultar toast después de 3 segundos
      setTimeout(() => setToastData(null), 3000);

      // Extract student info from fieldId (format: "email-" or "pass-" + studentId)
      const studentId = fieldId.replace(/^(email|pass)-/, '');
      const student = studentData.find(s => s.id === studentId);

      if (student) {
        // Determinar tipo de evento
        const eventType = fieldId.startsWith('email-') ? 'copy_email' : 'copy_password';

        // Registrar evento en Firebase
        await saveActivityEvent({
          type: eventType,
          studentId: student.id,
          studentName: `${student.first} ${student.last}`,
          institution: student.institution,
          phone: student.phone,
          details: eventType === 'copy_email' ? `Copió email: ${student.email}@gmail.com` : 'Copió contraseña'
        });
      }

      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Error copiando al portapapeles:', error);
    }
  };

  // Track WhatsApp contact
  const trackWhatsAppContact = async (studentId: string) => {
    const student = studentData.find(s => s.id === studentId);
    if (student) {
      await saveActivityEvent({
        type: 'page_view', // Usamos page_view como evento genérico para contacto
        studentId: student.id,
        studentName: `${student.first} ${student.last}`,
        institution: student.institution,
        phone: student.phone,
        details: 'Admin contactó vía WhatsApp'
      });
    }
  };

  // Track phone call
  const trackPhoneCall = async (studentId: string) => {
    const student = studentData.find(s => s.id === studentId);
    if (student) {
      await saveActivityEvent({
        type: 'page_view', // Usamos page_view como evento genérico para contacto
        studentId: student.id,
        studentName: `${student.first} ${student.last}`,
        institution: student.institution,
        phone: student.phone,
        details: 'Admin inició llamada telefónica'
      });
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Tutorial: Mostrar intro al entrar a cada paso de guía
  useEffect(() => {
    const guideSteps = ['guide-1-name', 'guide-2-basic', 'guide-3-email', 'guide-4-password'];
    if (guideSteps.includes(studentStep) && tourActive) {
      setShowStepIntro(true);
      setTourStep('intro');
    }
  }, [studentStep, tourActive]);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(2009);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthsFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close calendar on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 🔐 Load verification stats when admin dashboard is opened
  useEffect(() => {
    if (view === 'admin-dashboard' || view === 'ietac-dashboard') {
      getVerificationStats().then(stats => {
        setVerificationStats(stats);
      }).catch(console.error);
    }
  }, [view]);

  // Restore student credentials helper
  const restoreStudentCredentials = (student: Student) => {
    const cleanName = student.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim().toUpperCase();
    const lastName = student.last.toUpperCase();
    setCredentials({
      username: student.email,
      email: `${student.email}@gmail.com`,
      firstName: cleanName,
      lastName: lastName,
      displayName: `${cleanName} ${lastName}`,
      suggestedPassword: student.password
    });
  };

  // Load session from localStorage
  useLayoutEffect(() => {
    try {
      const savedSession = localStorage.getItem('sg_unified_session');
      if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.view === 'admin-dashboard') {
          setView('admin-dashboard');
        } else if (session.view === 'ietac-dashboard') {
          setView('ietac-dashboard');
        } else if (session.studentId) {
          const student = studentData.find(s => s.id === session.studentId);
          if (student) {
            setAuthenticatedStudent(student);
            // Inline credentials restoration to avoid hoisting issues
            const cleanName = student.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim().toUpperCase();
            const lastName = student.last.toUpperCase();
            setCredentials({
              username: student.email,
              email: `${student.email}@gmail.com`,
              firstName: cleanName,
              lastName: lastName,
              displayName: `${cleanName} ${lastName}`,
              suggestedPassword: student.password
            });
            setView('student-flow');
            if (session.studentStep) setStudentStep(session.studentStep);
            if (session.googleStep) setGoogleStep(session.googleStep);

            // 🔔 Verificar si necesita pedir permiso de notificaciones
            const alreadyAsked = localStorage.getItem(`notification_asked_${student.id}`);
            if (!alreadyAsked && 'Notification' in window) {
              setTimeout(() => setShowNotificationPrompt(true), 2000);
            }
          }
        }
        if (session.loginId) setLoginId(session.loginId);
        if (session.loginBirth) setLoginBirth(session.loginBirth);
      }
    } catch (e) {
      console.error('Session load error', e);
    }
    setIsHydrated(true);
  }, []);

  // Save session
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem('sg_unified_session', JSON.stringify({
        view,
        studentId: authenticatedStudent?.id || null,
        studentStep,
        googleStep,
        loginId,
        loginBirth
      }));
    } catch (e) {
      console.error('Session save error', e);
    }
  }, [view, authenticatedStudent, studentStep, googleStep, loginId, loginBirth, isHydrated]);

  // Sync tutorial state with localStorage
  useEffect(() => {
    if (view === 'ietac-dashboard') {
      const show = localStorage.getItem('ietac_show_tutorial') === 'true';
      setShowIetacTutorial(show);
    }
  }, [view]);

  // 🔐 Periodic session activity update to prevent false positives
  useEffect(() => {
    if (!authenticatedStudent) return;

    // Update activity immediately when student is set
    updateSessionActivity(authenticatedStudent.id, sessionId);

    // Update every 2 minutes to keep session alive
    const activityInterval = setInterval(() => {
      updateSessionActivity(authenticatedStudent.id, sessionId);
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(activityInterval);
  }, [authenticatedStudent, sessionId]);

  // 💡 Load login history for suggestions
  useEffect(() => {
    try {
      const history = localStorage.getItem('sg_login_history');
      if (history) {
        const parsed = JSON.parse(history) as { id: string, birth: string }[];
        setLoginSuggestions(parsed.slice(0, 5)); // Max 5 suggestions
      }
    } catch { /* ignore */ }
  }, []);

  // 🔒 Clean session on browser close to prevent false "duplicate session" errors
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (authenticatedStudent) {
        // Use navigator.sendBeacon for reliable session cleanup on page close
        const payload = JSON.stringify({
          studentId: authenticatedStudent.id,
          sessionId: sessionId
        });
        navigator.sendBeacon('/api/clear-session', payload);
        // Also try sync clear (may not complete)
        clearSession(authenticatedStudent.id, sessionId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [authenticatedStudent, sessionId]);

  // 💾 Save login to history after successful login
  const saveLoginToHistory = (id: string, birth: string) => {
    try {
      const history = localStorage.getItem('sg_login_history');
      let parsed: { id: string, birth: string }[] = history ? JSON.parse(history) : [];

      // Remove if already exists (to move to top)
      parsed = parsed.filter(item => item.id !== id);

      // Add to beginning
      parsed.unshift({ id, birth });

      // Keep only last 5
      parsed = parsed.slice(0, 5);

      localStorage.setItem('sg_login_history', JSON.stringify(parsed));
      setLoginSuggestions(parsed);
    } catch { /* ignore */ }
  };

  // 🚀 ULTRA OPTIMIZACIÓN: Caché de 7 días para reducir lecturas de Firebase
  const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días de caché

  const loadCachedData = (key: string) => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION_MS) {
          return data; // Caché válido
        }
      }
    } catch { /* ignore */ }
    return null;
  };

  const saveCachedData = (key: string, data: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* ignore */ }
  };

  // 💡 Cargar datos con caché inteligente
  useEffect(() => {
    if (view !== 'admin-dashboard' && view !== 'ietac-dashboard') return;

    let isMounted = true;

    const loadData = async () => {
      // 1. CONFIRMACIONES - Intentar caché primero
      const cachedConfirmations = loadCachedData('sg_cache_confirmations');
      if (cachedConfirmations) {
        setConfirmations(cachedConfirmations);
        setIsLoading(false);
      }

      // 2. ACTIVIDAD - Intentar caché primero
      const cachedActivity = loadCachedData('sg_cache_activity');
      if (cachedActivity) {
        setActivityEvents(cachedActivity);
        // Calcular stats de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        let logins = 0, confirmationsToday = 0;
        cachedActivity.forEach((e: { timestamp: string; type: string }) => {
          if (e.timestamp >= todayISO) {
            if (e.type === 'login') logins++;
            if (e.type === 'confirmation') confirmationsToday++;
          }
        });
        setTodayLogins(logins);
        setTodayConfirmations(confirmationsToday);
      }

      // 3. SEGURIDAD - Intentar caché primero
      const cachedSecurity = loadCachedData('sg_cache_security');
      if (cachedSecurity) {
        setSecurityStatuses(cachedSecurity);
      }

      // 🌐 Si el caché está vencido o no existe, cargar de Firebase UNA VEZ
      // (no usar suscripciones en tiempo real para ahorrar cuota)
      const shouldRefresh = !cachedConfirmations || !cachedActivity || !cachedSecurity;

      if (shouldRefresh && isMounted) {
        try {
          // Cargar confirmaciones
          const confirmationsData = await getConfirmations();
          if (isMounted) {
            setConfirmations(confirmationsData);
            saveCachedData('sg_cache_confirmations', confirmationsData);
          }

          // Cargar actividad (limitada a últimos 100 eventos)
          const { getDocs, query, orderBy, limit, collection } = await import('firebase/firestore');
          const activityQuery = query(
            collection(db, 'activity_events'),
            orderBy('timestamp', 'desc'),
            limit(100)
          );
          const activitySnap = await getDocs(activityQuery);
          const activityData: ActivityEvent[] = [];
          activitySnap.forEach(doc => {
            activityData.push({ id: doc.id, ...doc.data() } as ActivityEvent);
          });
          if (isMounted) {
            setActivityEvents(activityData);
            saveCachedData('sg_cache_activity', activityData);

            // Calcular stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();
            let logins = 0, confirmationsToday = 0;
            activityData.forEach(e => {
              if (e.timestamp >= todayISO) {
                if (e.type === 'login') logins++;
                if (e.type === 'confirmation') confirmationsToday++;
              }
            });
            setTodayLogins(logins);
            setTodayConfirmations(confirmationsToday);
          }

          // Cargar seguridad
          const securitySnap = await getDocs(collection(db, 'security_status'));
          const securityData: StudentSecurityStatus[] = [];
          securitySnap.forEach(doc => {
            securityData.push({ studentId: doc.id, ...doc.data() } as StudentSecurityStatus);
          });
          if (isMounted) {
            setSecurityStatuses(securityData);
            saveCachedData('sg_cache_security', securityData);
          }

          setIsLoading(false);
        } catch (error) {
          console.error('Error loading Firebase data:', error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [view]);

  // Load filters from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && view === 'admin-dashboard') {
      const inst = localStorage.getItem('institutionFilter');
      const name = localStorage.getItem('nameFilter');
      const last = localStorage.getItem('lastnameFilter');
      if (inst) setInstitutionFilter(inst);
      if (name) setNameFilter(name);
      if (last) setLastnameFilter(last);
    }
  }, [view]);

  // Save filters
  useEffect(() => {
    if (view === 'admin-dashboard' && typeof window !== 'undefined') {
      localStorage.setItem('institutionFilter', institutionFilter);
      localStorage.setItem('nameFilter', nameFilter);
      localStorage.setItem('lastnameFilter', lastnameFilter);
    }
  }, [institutionFilter, nameFilter, lastnameFilter, view]);

  // Get time ago string
  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return past.toLocaleDateString();
  };

  // Normalize date for comparison
  const normalizeDate = (date: string): string => {
    let d = date.trim().toLowerCase();
    const monthsMap: Record<string, string> = {
      // Meses completos (deben ir primero para evitar conflictos)
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
      // Meses abreviados
      'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };

    // Reemplazar nombres de meses por números (orden por longitud para evitar conflictos)
    const sortedMonths = Object.entries(monthsMap).sort((a, b) => b[0].length - a[0].length);
    for (const [name, num] of sortedMonths) {
      if (d.includes(name)) {
        d = d.replace(name, num);
        break;
      }
    }
    return d.replace(/[\s\-]+/g, '/');
  };

  // Login handler
  const handleLogin = async () => {
    setLoginError('');
    setSecurityWarning(null);

    const inputNorm = normalizeDate(loginBirth);
    const adminNorm = normalizeDate(ADMIN_BIRTH);
    const ietacAdminNorm = normalizeDate(IETAC_ADMIN_BIRTH);

    // Check super admin
    if (loginId.trim() === ADMIN_ID && inputNorm === adminNorm) {
      setView('admin-dashboard');
      return;
    }

    // Check IETAC admin
    if (loginId.trim() === IETAC_ADMIN_ID && inputNorm === ietacAdminNorm) {
      setView('ietac-dashboard');
      // Check if first time user
      if (!localStorage.getItem('ietac_tutorial_completed')) {
        localStorage.setItem('ietac_show_tutorial', 'true');
      }
      return;
    }

    // Check student - Primero data.ts (siempre disponible), luego Firebase como respaldo
    let student: Student | null = null;

    // 📁 PASO 1: Buscar en data.ts (más rápido y confiable)
    const localStudent = studentData.find(
      s => s.id === loginId.trim() && normalizeDate(s.birth) === inputNorm
    );

    if (localStudent) {
      student = localStudent;
    } else {
      // 🔥 PASO 2: Si no está en data.ts, buscar en Firebase (para estudiantes CRUD)
      try {
        const firestoreStudent = await getStudentById(loginId.trim());
        if (firestoreStudent && !firestoreStudent.deleted && normalizeDate(firestoreStudent.birth || '') === inputNorm) {
          student = {
            id: firestoreStudent.studentId,
            first: firestoreStudent.first || firestoreStudent.firstName || '',
            last: firestoreStudent.last || firestoreStudent.lastName || '',
            birth: firestoreStudent.birth || '',
            gender: (firestoreStudent.gender || 'M') as 'M' | 'F',
            email: firestoreStudent.email || firestoreStudent.emailNormalized || '',
            password: firestoreStudent.password || '',
            phone: firestoreStudent.phone || '',
            institution: firestoreStudent.institution || 'IETAC'
          };
        }
      } catch (err) {
        console.warn('Firebase lookup failed, continuing with local data only:', err);
      }
    }

    if (student) {
      // 🔒 SECURITY CHECK 1: Check if student is disabled
      const disabledCheck = await isStudentDisabled(student.id);
      if (disabledCheck.disabled) {
        setLoginError(`⚠️ Tu cuenta ha sido inhabilitada: ${disabledCheck.reason || 'Contacta al administrador.'}`);
        return;
      }

      // 🔒 SECURITY CHECK 2: Check for duplicate sessions
      const sessionCheck = await checkAndRegisterSession(student.id, sessionId);
      if (!sessionCheck.allowed) {
        setLoginError(`🔐 ${sessionCheck.reason}`);
        return;
      }

      setAuthenticatedStudent(student);
      restoreStudentCredentials(student);
      setView('student-flow');

      // 🚀 FAST-TRACK: Si ya está verificado, directo a confirmación final
      const firestoreStudent = await getStudentById(student.id);
      if (firestoreStudent?.verificationStatus === 'VERIFIED') {
        setStudentStep('confirmation-final');
        setGoogleVerified(true);
        // Pequeño delay para asegurar que el toast se vea
        setTimeout(() => {
          showTemporaryToast('👋 ¡Bienvenido de nuevo! Tu cuenta ya está totalmente verificada.', 'success', 4000);
        }, 500);
      } else {
        setStudentStep('credentials'); // Flujo normal para NO verificados
        // 🎯 Mostrar modal de bienvenida para estudiantes no verificados
        setShowWelcomeModal(true);
      }

      // Save credentials to cache for suggestions
      const cleanName = student.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim().toUpperCase();
      const lastName = student.last.toUpperCase();
      const cachedCredentials = {
        email: `${cleanName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}.sg.est@gmail.com`,
        password: student.password,
        firstName: cleanName,
        lastName: lastName,
        phone: student.phone,
        id: student.id,
        institution: student.institution,
        birth: student.birth,
        gender: student.gender
      };
      localStorage.setItem('sg_student_credentials', JSON.stringify(cachedCredentials));

      // 💡 Save to login history for autocomplete suggestions
      saveLoginToHistory(student.id, loginBirth);

      // Register login event in Firebase
      saveActivityEvent({
        type: 'login',
        studentId: student.id,
        studentName: `${student.first} ${student.last}`,
        institution: student.institution,
        phone: student.phone,
        details: 'Inicio de sesión exitoso'
      });

      // 🔔 Mostrar prompt de notificaciones (solo una vez por usuario)
      const alreadyAsked = localStorage.getItem(`notification_asked_${student.id}`);
      if (!alreadyAsked && 'Notification' in window) {
        setTimeout(() => setShowNotificationPrompt(true), 1500);
      }
    } else {
      setLoginError('ID o fecha incorrectos. Verifica tus datos.');
    }
  };

  // Logout
  const handleLogout = () => {
    // Clear session in Firebase if student was logged in
    if (authenticatedStudent) {
      clearSession(authenticatedStudent.id, sessionId);
    }

    localStorage.removeItem('sg_unified_session');
    setView('login');
    setAuthenticatedStudent(null);
    setCredentials(null);
    setStudentStep('credentials');
    setGoogleStep(1);
    setLoginId('');
    setLoginBirth('');
    setConfirmationStatus('pending');
    setSecurityWarning(null);
  };

  // Handle step advance with speed validation AND copy verification
  const handleStepAdvance = async (fromStep: string, toStep: StudentStep) => {
    if (!authenticatedStudent) return;

    // 🧪 TEST USER BYPASS - Skip all copy verifications and modals
    const isTestUser = authenticatedStudent.id === TEST_USER_ID;

    if (isTestUser) {
      // Test user can advance directly without restrictions
      setStudentStep(toStep);
      return;
    }

    // 🔒 VERIFICACIÓN DE COPIADO - Ahora solo advierte, no bloquea
    // La verificación real es Google Auth al final
    // Paso 1 (guide-1-name) -> verificar si copió nombre
    if (fromStep === 'guide-1-name' && (!copiedFields.firstName || !copiedFields.lastName)) {
      // Solo mostrar toast de advertencia, pero permitir continuar
      console.warn('⚠️ Usuario avanzó sin copiar nombre/apellidos');
    }

    // Paso 3 (email) -> verificar si copió email
    if (fromStep === 'guide-3-email' && !copiedFields.email) {
      console.warn('⚠️ Usuario avanzó sin copiar email');
    }

    // 🚨 ULTIMÁTUM simplificado antes del paso 4 (contraseña) - Reducido a 3s
    if (toStep === 'guide-4-password' && !ultimatumAccepted) {
      setShowUltimatumModal(true);
      setUltimatumCountdown(3); // Reducido de 10s a 3s
      const timer = setInterval(() => {
        setUltimatumCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return; // No avanzar hasta que acepte ultimátum
    }

    // Validate step timing
    const validation = await validateStepTiming(
      authenticatedStudent.id,
      fromStep,
      toStep,
      sessionId
    );

    if (!validation.valid) {
      // Show warning
      setSecurityWarning(validation.infraction || 'Error de validación');

      // If disabled, SHOW MODAL -> WAIT 10s -> LOGOUT
      if (validation.disabled) {
        setBlockedModal({
          show: true,
          reason: validation.infraction || 'Tu cuenta ha sido inhabilitada por comportamiento sospechoso.',
          studentName: `${authenticatedStudent.first} ${authenticatedStudent.last}`
        });

        // Auto-logout after 10 seconds
        setTimeout(() => {
          // Clear session
          if (authenticatedStudent?.id) {
            clearSession(authenticatedStudent.id, sessionId);
          }
          localStorage.removeItem('sg_unified_session');

          // Reset state
          setAuthenticatedStudent(null);
          setCredentials(null);
          setStudentStep('credentials');
          setGoogleStep(1);
          setView('login');
          setBlockedModal(null); // Close modal after logout
        }, 10000); // 10 seconds delay

        return; // Don't advance
      }

      // Show warning for 5 seconds then allow to continue
      setTimeout(() => setSecurityWarning(null), 5000);
      return; // Don't advance
    }

    // Valid - advance to next step
    setStudentStep(toStep);

    // 🚀 Modal breve solo para el primer paso (orientación inicial)
    if (toStep === 'guide-1-name') {
      setShowStep1InfoModal(true);
      setStep1InfoCountdown(3); // Reducido de 8 a 3 segundos
      const timer = setInterval(() => {
        setStep1InfoCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // 📝 NOTA: Los modales de paso 3 (email) y paso 4 (password) se han eliminado
    // porque la verificación definitiva ahora es Google Auth al final del proceso.
    // Esto reduce la fricción del usuario mientras mantiene la seguridad.
  };

  // Calendar helpers
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    setSelectedDay(day);
    const formattedDate = `${day.toString().padStart(2, '0')} ${monthsFull[calendarMonth]} ${calendarYear}`;
    setLoginBirth(formattedDate);
    setShowCalendar(false);
  };

  // Student confirmation
  const handleStudentConfirmation = async () => {
    if (!authenticatedStudent || !credentials) return;
    setConfirmationStatus('confirming');

    try {
      const success = await saveConfirmation({
        studentId: authenticatedStudent.id,
        studentName: authenticatedStudent.first,
        studentLastName: authenticatedStudent.last,
        email: credentials.email,
        institution: authenticatedStudent.institution
      });

      if (success) {
        setConfirmationStatus('confirmed');
        // Download credentials with notification
        downloadCredentialsWithNotification();

        // Tracking unificado (nuevo sistema)
        await trackStudentActivity(
          authenticatedStudent.id,
          'confirmation',
          `Cuenta confirmada: ${credentials.email}${googleVerified ? ' (verificado con Google)' : ''}`
        );

        // También mantener el sistema legacy por compatibilidad
        saveActivityEvent({
          type: 'confirmation',
          studentId: authenticatedStudent.id,
          studentName: `${authenticatedStudent.first} ${authenticatedStudent.last}`,
          institution: authenticatedStudent.institution,
          details: `Cuenta confirmada: ${credentials.email}`
        });
      } else {
        setConfirmationStatus('error');
      }
    } catch (error) {
      console.error('Confirmation error:', error);
      setConfirmationStatus('error');
    }
  };

  // Google Auth verification handler
  const handleGoogleVerification = async () => {
    if (!authenticatedStudent || !credentials) return;

    setIsVerifyingGoogle(true);
    setGoogleVerifyError(null);

    try {
      const result = await verifyWithGoogleAuth(
        authenticatedStudent.id,
        credentials.email
      );

      if (result.success) {
        setGoogleVerified(true);
        setGoogleVerifyError(null);
      } else {
        setGoogleVerifyError(result.message);
      }
    } catch (error) {
      console.error('Google verification error:', error);
      setGoogleVerifyError('Error al conectar con Google. Intenta de nuevo.');
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  // 🚀 Handler para abrir modal de verificación EXPRESS
  const handleOpenExpressModal = async () => {
    if (!authenticatedStudent || !credentials) return;

    setExpressError(null);
    setExpressSuccess(false);
    setExpressRedirectCountdown(5);

    // Verificar elegibilidad antes de mostrar el modal
    const eligibility = await canAttemptExpressVerification(authenticatedStudent.id);

    if (!eligibility.allowed) {
      setExpressError(eligibility.reason || 'No puedes usar verificación express en este momento.');
      setExpressRemainingAttempts(0);
    } else {
      setExpressRemainingAttempts(eligibility.remainingAttempts || 3);
    }

    setShowExpressModal(true);
  };

  // 🚀 Handler para ejecutar verificación EXPRESS
  const handleExpressVerification = async () => {
    if (!authenticatedStudent || !credentials) return;

    setExpressVerifying(true);
    setExpressError(null);

    try {
      const result = await executeExpressVerification(
        authenticatedStudent.id,
        credentials.email
      );

      if (result.verified) {
        // ✅ ÉXITO - Cuenta verificada
        setExpressSuccess(true);
        setGoogleVerified(true);

        // Esperar 2 segundos y llevar a confirmación final
        setTimeout(() => {
          setShowExpressModal(false);
          setStudentStep('confirmation-final');
          setConfirmationStatus('confirmed');

          // Guardar confirmación
          saveConfirmation({
            studentId: authenticatedStudent.id,
            studentName: authenticatedStudent.first,
            studentLastName: authenticatedStudent.last,
            email: credentials.email,
            institution: authenticatedStudent.institution
          });
        }, 2000);

      } else if (result.shouldRedirectToLogin) {
        // ❌ MISMATCH - Iniciar countdown y redirigir
        setExpressError(result.message);
        setExpressRedirectCountdown(5);

        const timer = setInterval(() => {
          setExpressRedirectCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              // Cerrar sesión y redirigir
              handleLogout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

      } else {
        // Error o cancelación
        setExpressError(result.message);
        // Actualizar intentos restantes
        const newEligibility = await canAttemptExpressVerification(authenticatedStudent.id);
        setExpressRemainingAttempts(newEligibility.remainingAttempts || 0);
      }
    } catch (error) {
      console.error('Express verification error:', error);
      setExpressError('Error inesperado. Intenta de nuevo.');
    } finally {
      setExpressVerifying(false);
    }
  };

  // 🧠 HANDLER INTELIGENTE V2 - Sin modales, solo toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isVerifyingIntelligent, setIsVerifyingIntelligent] = useState(false);

  const showTemporaryToast = (message: string, type: 'success' | 'error' | 'info', duration = 4000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  };

  const handleIntelligentVerification = async () => {
    if (isVerifyingIntelligent) return;

    setIsVerifyingIntelligent(true);

    try {
      // Pasar los datos del estudiante autenticado para registro de actividad
      // Incluyendo el email asignado para comparación
      const result = await intelligentGoogleVerification(
        authenticatedStudent?.id,
        authenticatedStudent ? `${authenticatedStudent.first} ${authenticatedStudent.last}` : undefined,
        authenticatedStudent?.institution,
        credentials?.email // Email asignado para comparación
      );

      switch (result.type) {
        case 'INTRUSO':
          // 🔴 Modal profesional de intruso (requiere clic para cerrar)
          setIntruderMessage(result.message);
          setIntruderEmail(result.detectedEmail || 'Desconocido');
          setShowIntruderModal(true);
          break;

        case 'PRIMERA_VEZ':
          // 🟢 Toast de éxito + Directo a confirmación final
          showTemporaryToast(result.message, 'success');
          setGoogleVerified(true);
          setStudentStep('confirmation-final');
          // Guardar confirmación automáticamente
          if (authenticatedStudent && credentials) {
            await saveConfirmation({
              studentId: authenticatedStudent.id,
              studentName: authenticatedStudent.first,
              studentLastName: authenticatedStudent.last,
              email: credentials.email,
              institution: authenticatedStudent.institution
            });
          }
          break;

        case 'VETERANO':
          // 🚀 Toast minimal + Fast-track directo
          showTemporaryToast(result.message, 'info', 2000);
          setGoogleVerified(true);
          setStudentStep('confirmation-final');
          // Ya está confirmado, no necesita guardar de nuevo
          break;

        case 'CANCELLED':
          // Usuario canceló, no hacer nada especial
          break;

        case 'ERROR':
          showTemporaryToast(result.message, 'error');
          break;
      }
    } catch (error) {
      console.error('Intelligent verification error:', error);
      showTemporaryToast('Error inesperado. Intenta de nuevo.', 'error');
    } finally {
      setIsVerifyingIntelligent(false);
    }
  };

  // Copiar credenciales al portapapeles
  const copyCredentialsToClipboard = async () => {
    if (!credentials || !authenticatedStudent) return;

    const content = `
CREDENCIALES INSTITUCIONALES
============================
Estudiante: ${authenticatedStudent.first} ${authenticatedStudent.last}
ID: ${authenticatedStudent.id}
Institución: ${authenticatedStudent.institution || 'IETAC'}
----------------------------
📧 CORREO:
${credentials.email}

🔐 CONTRASEÑA:
${credentials.suggestedPassword}
----------------------------
⚠️ Instrucciones:
1. Ve a gmail.com
2. Inicia sesión con estos datos
3. Cambia tu contraseña si se te solicita
`.trim();

    try {
      await navigator.clipboard.writeText(content);

      setToastData({
        emoji: '📋',
        message: '¡Credenciales Copiadas!',
        instruction: 'Pégalas en un lugar seguro (WhatsApp/Notas)'
      });

      // Simular delay visual para que el usuario crea que pasó algo importante
      setDownloadModal({ show: true, downloading: true });

      setTimeout(() => {
        setDownloadModal(null);
      }, 1500);

    } catch (err) {
      console.error('Error al copiar:', err);
      showTemporaryToast('No se pudo copiar automáticamente. Por favor toma captura de pantalla.', 'error');
    }
  };

  // Función wrapper para mantener compatibilidad con el botón existente
  const downloadCredentialsWithNotification = () => {
    setDownloadModal({ show: true, downloading: false });

    // Esperar un momento (lectura de modal) y luego copiar
    setTimeout(() => {
      copyCredentialsToClipboard();
    }, 2000);
  };

  // Admin filtered data
  const filteredData = useMemo(() => {
    let data = studentData;

    if (institutionFilter !== 'ALL') {
      data = data.filter(student => {
        if (institutionFilter === 'IETAC') return student.first.startsWith('IETAC');
        if (institutionFilter === 'SG') return student.first.startsWith('SG');
        return true;
      });
    }

    if (nameFilter !== 'ALL') {
      data = data.filter(student => {
        const firstName = student.first.replace(/^(IETAC|SG) - /, '').trim();
        return firstName.toUpperCase().startsWith(nameFilter);
      });
    }

    if (lastnameFilter !== 'ALL') {
      data = data.filter(student => student.last.toUpperCase().startsWith(lastnameFilter));
    }

    if (searchTerm) {
      const searchPartials = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      data = data.filter(student => {
        const fullText = `${student.first} ${student.last} ${student.id} ${student.email}`.toLowerCase();
        return searchPartials.every(part => fullText.includes(part));
      });
    }

    return Array.from(new Map(data.map(s => [s.id, s])).values());
  }, [searchTerm, institutionFilter, nameFilter, lastnameFilter]);

  const handleToggleConfirm = async (studentId: string) => {
    const currentStatus = confirmations[studentId] || false;
    setConfirmations(prev => ({ ...prev, [studentId]: !currentStatus }));
    await updateConfirmation(studentId, !currentStatus);
  };

  // ============================================
  // RENDER: MANTENIMIENTO
  // ============================================
  if (MAINTENANCE_MODE) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Maintenance Card */}
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-amber-500/30 shadow-2xl text-center">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
              <span className="text-5xl">🔧</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-white mb-3">
              En Mantenimiento
            </h1>

            {/* Message */}
            <p className="text-amber-200 text-lg mb-6">
              {MAINTENANCE_MESSAGE}
            </p>

            {/* Status indicator */}
            <div className="bg-amber-500/20 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                <p className="text-amber-300 text-sm font-medium">
                  Trabajando en mejoras...
                </p>
              </div>
            </div>

            {/* Time estimate */}
            <p className="text-slate-400 text-xs mt-6">
              Agradecemos tu paciencia. El sistema estará disponible pronto.
            </p>

            {/* Logo */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-purple-300 font-bold text-lg">Seamos Genios</p>
              <p className="text-slate-500 text-xs">Portal Institucional</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: LOGIN
  // ============================================
  if (view === 'login') {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Main Content - Scrollable */}
        <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="min-h-full flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
              {/* Logo & Title */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-2xl">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">SeamosGenios</h1>
                <p className="text-purple-300 text-sm sm:text-base">PreICFES Intensivo</p>
              </div>

              {/* Login Form */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="relative">
                  <label className="block text-purple-200 text-sm mb-2">Número de Identificación</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Tu número de documento"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 text-base"
                    autoComplete="off"
                  />

                  {/* Suggestions Dropdown */}
                  {showSuggestions && loginSuggestions.length > 0 && !loginId && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-xl overflow-hidden shadow-2xl z-50">
                      <div className="px-3 py-2 border-b border-white/10">
                        <p className="text-purple-300/70 text-xs font-medium">💡 Sesiones anteriores</p>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {loginSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setLoginId(suggestion.id);
                              setLoginBirth(suggestion.birth);
                              setShowSuggestions(false);
                            }}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-500/20 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-white font-mono text-sm">{suggestion.id}</p>
                                <p className="text-slate-500 text-xs">{suggestion.birth}</p>
                              </div>
                            </div>
                            <span className="text-purple-400/50 text-xs">Usar</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-purple-200 text-sm mb-2">Fecha de Nacimiento</label>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-left flex items-center justify-between hover:border-purple-500/50"
                  >
                    <span className={loginBirth ? 'text-white' : 'text-purple-300/50'}>
                      {loginBirth || 'Selecciona tu fecha'}
                    </span>
                    <span className="text-purple-400">📅</span>
                  </button>

                  {showCalendar && (
                    <div
                      ref={calendarRef}
                      className="fixed inset-x-4 sm:absolute sm:inset-x-0 sm:left-0 sm:right-0 top-1/2 sm:top-full -translate-y-1/2 sm:translate-y-0 sm:mt-2 z-50 bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl"
                    >
                      {/* Header con navegación */}
                      <div className="flex items-center justify-between p-3 border-b border-purple-500/20">
                        <button
                          onClick={() => setCalendarMonth(m => m === 0 ? 11 : m - 1)}
                          className="w-10 h-10 flex items-center justify-center text-white hover:bg-purple-500/20 rounded-lg text-lg"
                        >
                          ‹
                        </button>
                        <div className="flex gap-2">
                          <select
                            title="Mes"
                            value={calendarMonth}
                            onChange={(e) => setCalendarMonth(Number(e.target.value))}
                            className="bg-slate-800 text-white rounded-lg px-3 py-2 text-sm font-medium border border-slate-700 focus:outline-none focus:border-purple-500"
                          >
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                          </select>
                          <select
                            title="Año"
                            value={calendarYear}
                            onChange={(e) => setCalendarYear(Number(e.target.value))}
                            className="bg-slate-800 text-white rounded-lg px-3 py-2 text-sm font-medium border border-slate-700 focus:outline-none focus:border-purple-500"
                          >
                            {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => setCalendarMonth(m => m === 11 ? 0 : m + 1)}
                          className="w-10 h-10 flex items-center justify-center text-white hover:bg-purple-500/20 rounded-lg text-lg"
                        >
                          ›
                        </button>
                      </div>

                      {/* Grid de días */}
                      <div className="p-3">
                        {/* Encabezados de días */}
                        <div className="grid grid-cols-7 mb-2">
                          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => (
                            <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-purple-400">
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Días del mes */}
                        <div className="grid grid-cols-7">
                          {Array.from({ length: getFirstDayOfMonth(calendarMonth, calendarYear) }).map((_, i) => (
                            <div key={`e-${i}`} className="h-10"></div>
                          ))}
                          {Array.from({ length: getDaysInMonth(calendarMonth, calendarYear) }, (_, i) => i + 1).map(day => (
                            <button
                              key={day}
                              onClick={() => handleDateSelect(day)}
                              className={`h-10 rounded-lg text-sm font-medium transition-all ${selectedDay === day
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'text-white hover:bg-purple-500/30'
                                }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Botón cerrar en móvil */}
                      <div className="p-3 pt-0 sm:hidden">
                        <button
                          onClick={() => setShowCalendar(false)}
                          className="w-full py-2.5 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {loginError && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
                    <p className="text-red-300 text-sm">{loginError}</p>
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-xl active:scale-[0.98]"
                >
                  Ingresar
                </button>
              </div>

              {/* Footer Links */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button onClick={() => { localStorage.removeItem('sg_unified_session'); window.location.reload(); }} className="text-purple-400/60 text-xs underline hover:text-white">
                  Limpiar sesión
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 text-center py-3 text-purple-400/40 text-xs shrink-0">
          SeamosGenios © 2025 • PreICFES Intensivo
        </footer>
      </div>
    );
  }

  // ============================================
  // RENDER: ADMIN DASHBOARD
  // ============================================
  if (view === 'admin-dashboard') {
    // Calcular estadísticas avanzadas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayEvents = activityEvents.filter(e => new Date(e.timestamp) >= today);
    const yesterdayEvents = activityEvents.filter(e => {
      const d = new Date(e.timestamp);
      return d >= yesterday && d < today;
    });
    const weekEvents = activityEvents.filter(e => new Date(e.timestamp) >= weekAgo);

    const todayLoginCount = todayEvents.filter(e => e.type === 'login').length;
    const todayConfirmCount = todayEvents.filter(e => e.type === 'confirmation').length;
    const yesterdayLoginCount = yesterdayEvents.filter(e => e.type === 'login').length;
    const yesterdayConfirmCount = yesterdayEvents.filter(e => e.type === 'confirmation').length;

    const activeNow = new Set(
      activityEvents
        .filter(e => new Date(e.timestamp) >= new Date(Date.now() - 5 * 60 * 1000))
        .map(e => e.studentId)
    ).size;

    const totalConfirmed = studentData.filter(s => confirmations[s.id]).length;
    const totalPending = studentData.length - totalConfirmed;
    const confirmationRate = studentData.length > 0 ? Math.round((totalConfirmed / studentData.length) * 100) : 0;

    // Estadísticas por institución
    const ietacStudents = studentData.filter(s => s.institution === 'IETAC');
    const sgStudents = studentData.filter(s => s.institution === 'SG');
    const ietacConfirmed = ietacStudents.filter(s => confirmations[s.id]).length;
    const sgConfirmed = sgStudents.filter(s => confirmations[s.id]).length;
    const ietacRate = ietacStudents.length > 0 ? Math.round((ietacConfirmed / ietacStudents.length) * 100) : 0;
    const sgRate = sgStudents.length > 0 ? Math.round((sgConfirmed / sgStudents.length) * 100) : 0;

    // Tasa de conversión (login → confirmación)
    const uniqueLogins = new Set(activityEvents.filter(e => e.type === 'login').map(e => e.studentId)).size;
    const uniqueConfirmations = new Set(activityEvents.filter(e => e.type === 'confirmation').map(e => e.studentId)).size;
    const conversionRate = uniqueLogins > 0 ? Math.round((uniqueConfirmations / uniqueLogins) * 100) : 0;

    // Estudiantes que ingresaron pero no confirmaron (requieren atención)
    const loggedInIds = new Set(activityEvents.filter(e => e.type === 'login').map(e => e.studentId));
    const confirmedIds = new Set(activityEvents.filter(e => e.type === 'confirmation').map(e => e.studentId));
    const needsAttentionCount = [...loggedInIds].filter(id => !confirmedIds.has(id) && !confirmations[id]).length;

    // Hora pico de actividad (última semana)
    const hourCounts: Record<number, number> = {};
    weekEvents.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const peakHourFormatted = peakHour ? `${peakHour[0].padStart(2, '0')}:00` : 'N/A';

    // Promedio diario de actividad (última semana)
    const avgDailyActivity = Math.round(weekEvents.length / 7);

    return (
      <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-sans">
        <Sidebar
          activeView={adminView}
          onViewChange={(v) => setAdminView(v as 'data' | 'statistics')}
        />
        <MobileNav
          activeView={adminView}
          onViewChange={(v) => setAdminView(v as 'data' | 'statistics')}
          onLogout={handleLogout}
        />
        <main className="flex-1 flex flex-col min-w-0 max-h-[100dvh] overflow-hidden relative">

          {/* Vista de DATOS */}
          {adminView === 'data' && (
            <>
              <Header
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                institutionFilter={institutionFilter}
                onInstitutionChange={setInstitutionFilter}
                nameFilter={nameFilter}
                onNameFilterChange={setNameFilter}
                lastnameFilter={lastnameFilter}
                onLastnameFilterChange={setLastnameFilter}
                onExportExcel={() => exportToExcel(studentData)}
                onLogout={handleLogout}
                activityEvents={activityEvents}
                todayLogins={todayLogins}
                todayConfirmations={todayConfirmations}
              />

              {/* Barra de herramientas CRUD */}
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAdminCRUD(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <span>🛠️</span>
                    Gestión CRUD
                  </button>
                  <button
                    onClick={() => setShowGoogleReport(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                  >
                    <span>📧</span>
                    Reporte Google
                  </button>
                  <button
                    onClick={() => setShowActivityLog(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <span>📊</span>
                    Actividad
                  </button>
                  <button
                    onClick={() => setShowBroadcast(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    Notificar
                  </button>
                  <button
                    onClick={() => setShowNotificationSettings(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    title="Configurar notificaciones"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowAlertsPanel(true)}
                    className="relative flex items-center gap-1 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors"
                    title="Ver alertas"
                  >
                    🔔
                  </button>
                  <button
                    onClick={() => setShowBroadcastHistory(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    title="Historial de mensajes"
                  >
                    📜
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <NotificationPermissionButton userId="admin" role="admin" variant="compact" />
                  <div className="text-sm text-slate-500">
                    Total: <span className="font-bold text-slate-700">{filteredData.length}</span> estudiantes
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                    <p>Sincronizando...</p>
                  </div>
                ) : (
                  <StudentTable
                    data={filteredData}
                    confirmations={confirmations}
                    onToggleConfirm={handleToggleConfirm}
                  />
                )}
              </div>
            </>
          )}

          {/* Vista de ESTADÍSTICAS */}
          {adminView === 'statistics' && (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">Centro de Estadísticas</h1>
                    <p className="text-slate-500 text-sm">Monitoreo detallado de actividad de usuarios</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </div>

                {/* TARJETA DE SEGURIDAD - PROMINENTE */}
                <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 rounded-2xl p-5 shadow-lg text-white mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-red-100 text-sm font-medium">Seguridad</p>
                        <div className="flex items-baseline gap-3">
                          <p className="text-4xl font-bold">{securityStatuses.filter(s => s.disabled).length}</p>
                          <span className="text-red-200 text-lg">bloqueados</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-red-100 text-sm">Infracciones totales</p>
                      <p className="text-3xl font-bold">{securityStatuses.reduce((acc, s) => acc + (s.infractions?.length || 0), 0)}</p>
                    </div>
                  </div>
                </div>

                {/* 🔐 TARJETA DE GOOGLE AUTH VERIFICATION - NUEVA */}
                <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl p-5 shadow-lg text-white mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-blue-100 text-sm font-medium">Verificación Google Auth</p>
                        <div className="flex items-baseline gap-3">
                          <p className="text-4xl font-bold">{verificationStats.verified}</p>
                          <span className="text-blue-200 text-lg">verificados</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-amber-300">⏳</span>
                        <span className="text-blue-100 text-sm">Pendientes: <strong>{verificationStats.pending}</strong></span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-red-300">❌</span>
                        <span className="text-blue-100 text-sm">Mismatch: <strong>{verificationStats.mismatch}</strong></span>
                      </div>
                      <div className="bg-white/20 rounded-full px-3 py-1 mt-2">
                        <span className="font-bold">{verificationStats.rate}%</span>
                        <span className="text-blue-200 text-xs ml-1">completado</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tarjetas de resumen */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">Logins Hoy</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{todayLoginCount}</p>
                    <p className="text-xs text-slate-400 mt-1">Total histórico: {activityEvents.filter(e => e.type === 'login').length}</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">Confirmaciones</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{todayConfirmCount}</p>
                    <p className="text-xs text-slate-400 mt-1">Total: {totalConfirmed}/{studentData.length} ({confirmationRate}%)</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">En Línea</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{activeNow}</p>
                    <p className="text-xs text-slate-400 mt-1">Últimos 5 minutos</p>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-slate-500 text-sm font-medium">Pendientes</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalPending}</p>
                    <p className="text-xs text-slate-400 mt-1">Sin confirmar cuenta</p>
                  </div>
                </div>

                {/* Segunda fila - Estadísticas Avanzadas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Tasa de Conversión */}
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <span className="text-purple-100 text-sm font-medium">Conversión</span>
                    </div>
                    <p className="text-3xl font-bold">{conversionRate}%</p>
                    <p className="text-xs text-purple-200 mt-1">Login → Confirmación</p>
                  </div>

                  {/* Requieren Atención */}
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="text-amber-100 text-sm font-medium">Atención</span>
                    </div>
                    <p className="text-3xl font-bold">{needsAttentionCount}</p>
                    <p className="text-xs text-amber-200 mt-1">Ingresaron sin confirmar</p>
                  </div>

                  {/* Hora Pico */}
                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-4 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-cyan-100 text-sm font-medium">Hora Pico</span>
                    </div>
                    <p className="text-3xl font-bold">{peakHourFormatted}</p>
                    <p className="text-xs text-cyan-200 mt-1">Mayor actividad semanal</p>
                  </div>

                  {/* Promedio Diario */}
                  <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 shadow-lg text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <span className="text-rose-100 text-sm font-medium">Prom. Diario</span>
                    </div>
                    <p className="text-3xl font-bold">{avgDailyActivity}</p>
                    <p className="text-xs text-rose-200 mt-1">Eventos esta semana</p>
                  </div>
                </div>

                {/* Progreso por Institución */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {/* IETAC */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                        IETAC
                      </h3>
                      <span className="text-2xl font-bold text-indigo-600">{ietacRate}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${ietacRate}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Confirmados: <span className="font-bold text-slate-700">{ietacConfirmed}</span></span>
                      <span className="text-slate-500">Total: <span className="font-bold text-slate-700">{ietacStudents.length}</span></span>
                    </div>
                  </div>

                  {/* SG */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                        Seamos Genios
                      </h3>
                      <span className="text-2xl font-bold text-emerald-600">{sgRate}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                        style={{ width: `${sgRate}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Confirmados: <span className="font-bold text-slate-700">{sgConfirmed}</span></span>
                      <span className="text-slate-500">Total: <span className="font-bold text-slate-700">{sgStudents.length}</span></span>
                    </div>
                  </div>
                </div>

                {/* Comparativa Hoy vs Ayer */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Comparativa: Hoy vs Ayer
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium mb-1">Logins Hoy</p>
                      <p className="text-2xl font-bold text-blue-700">{todayLoginCount}</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 font-medium mb-1">Logins Ayer</p>
                      <p className="text-2xl font-bold text-slate-600">{yesterdayLoginCount}</p>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600 font-medium mb-1">Confirm. Hoy</p>
                      <p className="text-2xl font-bold text-emerald-700">{todayConfirmCount}</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 font-medium mb-1">Confirm. Ayer</p>
                      <p className="text-2xl font-bold text-slate-600">{yesterdayConfirmCount}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Eventos por Tipo
                    </h3>
                    <div className="space-y-3">
                      {[
                        { type: 'login', label: 'Inicios de sesión', color: 'bg-blue-500', icon: '🔑' },
                        { type: 'confirmation', label: 'Confirmaciones', color: 'bg-emerald-500', icon: '✓' },
                        { type: 'view_credentials', label: 'Vistas de credenciales', color: 'bg-purple-500', icon: '👁' },
                        { type: 'copy_email', label: 'Copias de email', color: 'bg-cyan-500', icon: '📧' },
                        { type: 'copy_password', label: 'Copias de contraseña', color: 'bg-amber-500', icon: '🔐' },
                      ].map(({ type, label, color, icon }) => {
                        const count = activityEvents.filter(e => e.type === type).length;
                        const maxCount = Math.max(...['login', 'confirmation', 'view_credentials', 'copy_email', 'copy_password'].map(t => activityEvents.filter(e => e.type === t).length), 1);
                        const percentage = Math.round((count / maxCount) * 100);
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="text-lg">{icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-slate-600">{label}</span>
                                <span className="text-sm font-bold text-slate-800">{count}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actividad reciente */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Actividad Reciente
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activityEvents.slice(0, 15).map((event, idx) => {
                        const student = studentData.find(s => s.id === event.studentId);
                        const timeAgo = getTimeAgo(event.timestamp);
                        let eventEmoji = '👤';
                        if (event.type === 'confirmation') eventEmoji = '✅';
                        if (event.type === 'view_credentials') eventEmoji = '👁';
                        if (event.type === 'copy_email') eventEmoji = '📧';
                        if (event.type === 'copy_password') eventEmoji = '🔐';

                        return (
                          <div key={`${event.timestamp}-${idx}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                            <span>{eventEmoji}</span>
                            <span className="text-slate-700 font-medium truncate flex-1">
                              {student ? `${student.first} ${student.last}` : event.studentId}
                            </span>
                            <span className="text-slate-400 text-xs shrink-0">{timeAgo}</span>
                          </div>
                        );
                      })}
                      {activityEvents.length === 0 && (
                        <p className="text-slate-400 text-center py-8">No hay actividad registrada</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estudiantes que REALMENTE ingresaron pero no confirmaron */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-10">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Requieren Atención (Ingresaron pero NO confirmaron)
                  </h3>
                  {(() => {
                    // Obtener IDs de estudiantes que han hecho login
                    const loggedInStudentIds = new Set(
                      activityEvents.filter(e => e.type === 'login').map(e => e.studentId)
                    );
                    // Obtener IDs de estudiantes que han confirmado
                    const confirmedStudentIds = new Set(
                      activityEvents.filter(e => e.type === 'confirmation').map(e => e.studentId)
                    );
                    // Filtrar: ingresaron pero NO confirmaron
                    const needAttention = studentData.filter(s =>
                      loggedInStudentIds.has(s.id) && !confirmedStudentIds.has(s.id) && !confirmations[s.id]
                    );

                    if (needAttention.length === 0) {
                      return (
                        <p className="text-emerald-600 font-medium text-center py-4">
                          ✅ No hay estudiantes que hayan ingresado sin confirmar
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                        {needAttention.slice(0, 12).map(student => (
                          <div key={student.id} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xs">
                              {student.first.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-800 font-medium text-sm truncate">{student.first}</p>
                              <p className="text-slate-400 text-xs">{student.institution}</p>
                            </div>
                            <a
                              href={`https://wa.me/57${student.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => trackWhatsAppContact(student.id)}
                              className="w-7 h-7 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shrink-0"
                              title="WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                            </a>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* PANEL DE SEGURIDAD Y USUARIOS INHABILITADOS - MEJORADO */}
                {/* PANEL DE SEGURIDAD - Diseño Limpio */}
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/50 mb-8">
                  {/* Header y Estadísticas */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                    {/* Título e Icono */}
                    <div className="flex gap-5">
                      <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center shadow-red-500/30 shadow-lg shrink-0">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Panel de Seguridad</h3>
                        <p className="text-slate-500 mt-1 text-sm max-w-xs leading-relaxed">
                          Monitoreo en tiempo real de infracciones y cuentas bloqueadas
                        </p>
                      </div>
                    </div>

                    {/* Estadísticas Grandes Alineadas */}
                    <div className="flex gap-4">
                      <div className="bg-white rounded-2xl px-6 py-4 border border-slate-100 shadow-sm min-w-[140px] text-center transition-transform hover:scale-105">
                        <p className="text-4xl font-extrabold text-red-600 mb-1">{securityStatuses.filter(s => s.disabled).length}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bloqueados</p>
                      </div>
                      <div className="bg-amber-50 rounded-2xl px-6 py-4 border border-amber-100 shadow-sm min-w-[140px] text-center transition-transform hover:scale-105">
                        <p className="text-4xl font-extrabold text-amber-600 mb-1">
                          {securityStatuses.reduce((acc, s) => acc + (s.infractions?.length || 0), 0)}
                        </p>
                        <p className="text-xs font-bold text-amber-700/60 uppercase tracking-wider">Infracciones</p>
                      </div>
                    </div>
                  </div>

                  {/* Leyenda y Reglas - Estilo Suave */}
                  <div className="bg-slate-50/50 rounded-2xl p-6 mb-8 border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📖</span>
                        <p className="text-sm font-semibold text-slate-600">Tipos de infracciones</p>
                      </div>
                      <div className="bg-red-50 px-3 py-1.5 rounded-full border border-red-100 inline-flex items-center gap-2">
                        <span className="text-xs font-bold text-red-600">⚠️ Regla:</span>
                        <span className="text-xs text-red-500">2 infracciones de velocidad = bloqueo automático</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">⚡ Velocidad</span>
                        <span className="text-xs text-slate-500 leading-snug">Avance muy rápido entre pasos</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold shrink-0">👥 Sesión</span>
                        <span className="text-xs text-slate-500 leading-snug">Intento desde otro dispositivo</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold shrink-0">🚫 Manual</span>
                        <span className="text-xs text-slate-500 leading-snug">Bloqueo administrativo</span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de usuarios con diseño limpio */}
                  {(() => {
                    const disabledUsers = securityStatuses.filter(s => s.disabled);

                    if (disabledUsers.length === 0) {
                      return (
                        <div className="bg-emerald-50 rounded-2xl p-8 text-center border-2 border-dashed border-emerald-100">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-3xl">
                            ✅
                          </div>
                          <h4 className="text-emerald-800 font-bold text-lg mb-1">Todo en orden</h4>
                          <p className="text-emerald-600 text-sm">No hay cuentas inhabilitadas actualmente</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-red-700 bg-red-100 px-3 py-2 rounded-lg inline-block">
                          🚨 {disabledUsers.length} cuenta{disabledUsers.length > 1 ? 's' : ''} requiere{disabledUsers.length > 1 ? 'n' : ''} atención
                        </p>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                          {disabledUsers.map(status => {
                            const student = studentData.find(s => s.id === status.studentId);
                            const speedViolations = status.infractions?.filter(i => i.type === 'speed_violation').length || 0;
                            const sessionViolations = status.infractions?.filter(i => i.type === 'duplicate_session').length || 0;

                            return (
                              <div key={status.studentId} className="bg-white border-2 border-red-300 rounded-2xl shadow-md overflow-hidden">
                                {/* Header con gradiente */}
                                <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-4 text-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold backdrop-blur-sm">
                                        {student?.first?.charAt(0) || '?'}
                                      </div>
                                      <div>
                                        <p className="font-bold text-lg">
                                          {student ? `${student.first} ${student.last}` : status.studentId}
                                        </p>
                                        <p className="text-red-100 text-sm">
                                          {student?.institution} • ID: {status.studentId}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`¿Habilitar cuenta de ${student?.first || status.studentId}?\n\nEl estudiante podrá volver a intentar el proceso.`)) {
                                          await enableStudent(status.studentId);
                                        }
                                      }}
                                      className="bg-white text-emerald-600 font-bold px-5 py-2 rounded-xl hover:bg-emerald-50 transition-colors shadow-lg"
                                    >
                                      ✓ Rehabilitar
                                    </button>
                                  </div>
                                </div>

                                {/* Contenido */}
                                <div className="p-5">
                                  {/* Resumen de infracciones */}
                                  <div className="flex gap-3 mb-4">
                                    <div className="flex-1 bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
                                      <p className="text-2xl font-bold text-amber-600">{speedViolations}</p>
                                      <p className="text-xs text-amber-700">⚡ Velocidad</p>
                                    </div>
                                    <div className="flex-1 bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
                                      <p className="text-2xl font-bold text-purple-600">{sessionViolations}</p>
                                      <p className="text-xs text-purple-700">👥 Sesión</p>
                                    </div>
                                    <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-200 text-center">
                                      <p className="text-2xl font-bold text-slate-600">{status.infractions?.length || 0}</p>
                                      <p className="text-xs text-slate-500">📊 Total</p>
                                    </div>
                                  </div>

                                  {/* Razón del bloqueo - MÁS PROMINENTE */}
                                  <div className="bg-red-50 rounded-xl p-4 mb-4 border-l-4 border-red-500">
                                    <p className="text-xs text-red-600 font-bold mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                      </svg>
                                      RAZÓN DEL BLOQUEO:
                                    </p>
                                    <p className="text-sm text-slate-800 leading-relaxed">{status.disabledReason || 'Sin razón especificada'}</p>
                                  </div>

                                  {/* Fecha y hora */}
                                  <div className="bg-slate-100 rounded-lg px-4 py-2 mb-4 inline-block">
                                    <span className="text-xs text-slate-600">
                                      🕐 Bloqueado el: <strong>{status.disabledAt ? new Date(status.disabledAt).toLocaleString('es-CO') : 'N/A'}</strong>
                                    </span>
                                  </div>

                                  {/* Historial de infracciones - SIEMPRE VISIBLE */}
                                  {status.infractions && status.infractions.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                      <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        📜 Historial completo de infracciones
                                      </p>
                                      <div className="space-y-3">
                                        {status.infractions.map((inf, idx) => (
                                          <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`px-2 py-1 rounded-full text-white text-xs font-medium ${inf.type === 'speed_violation' ? 'bg-amber-500' :
                                                inf.type === 'duplicate_session' ? 'bg-purple-500' : 'bg-red-500'
                                                }`}>
                                                {inf.type === 'speed_violation' ? '⚡ Infracción de Velocidad' :
                                                  inf.type === 'duplicate_session' ? '👥 Sesión Duplicada' : '🚫 Bloqueo Manual'}
                                              </span>
                                              <span className="text-xs text-slate-400">
                                                #{idx + 1}
                                              </span>
                                            </div>
                                            <p className="text-sm text-slate-700 mb-2">{inf.details}</p>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                              <span>📅 {new Date(inf.timestamp).toLocaleString('es-CO')}</span>
                                              {inf.timeTaken && (
                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                                  ⏱️ {inf.timeTaken.toFixed(1)}s
                                                </span>
                                              )}
                                              {inf.stepFrom && inf.stepTo && (
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                  {inf.stepFrom} → {inf.stepTo}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Footer fijo */}
          <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-400">EduManager • {filteredData.length} estudiantes</p>
            <button
              onClick={handleLogout}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Salir
            </button>
          </div>
        </main>

        {/* Modal CRUD de Administración */}
        {showAdminCRUD && (
          <AdminCRUD
            adminId={ADMIN_ID}
            onClose={() => setShowAdminCRUD(false)}
          />
        )}

        {/* Modal Reporte de Verificación */}
        {showVerificationReport && (
          <VerificationReport
            onClose={() => setShowVerificationReport(false)}
          />
        )}

        {/* Modal Centro de Monitoreo */}
        {showActivityLog && (
          <ActivityDashboard
            onClose={() => setShowActivityLog(false)}
          />
        )}

        {/* Modal Reporte Google */}
        {showGoogleReport && (
          <GoogleVerificationReport
            onClose={() => setShowGoogleReport(false)}
          />
        )}

        {/* Modal Broadcast Notificaciones */}
        {showBroadcast && (
          <AdminBroadcast
            adminId="admin"
            onClose={() => setShowBroadcast(false)}
          />
        )}

        {/* Modal Configuración Notificaciones */}
        {showNotificationSettings && (
          <NotificationSettingsManager
            onClose={() => setShowNotificationSettings(false)}
          />
        )}

        {/* Panel de Alertas */}
        {showAlertsPanel && (
          <AdminAlertsPanel
            onClose={() => setShowAlertsPanel(false)}
          />
        )}

        {/* Historial de Broadcasts */}
        {showBroadcastHistory && (
          <BroadcastHistory
            onClose={() => setShowBroadcastHistory(false)}
          />
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: IETAC ADMIN DASHBOARD (Mejorado)
  // ============================================
  if (view === 'ietac-dashboard') {
    // Filter only IETAC students
    const ietacStudents = studentData.filter(s => s.first.toUpperCase().startsWith('IETAC'));

    // Apply search filter (with debounce)
    let ietacFiltered = ietacStudents.filter(student => {
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        return student.first.toLowerCase().includes(search) ||
          student.last.toLowerCase().includes(search) ||
          student.id.includes(search) ||
          student.phone.includes(search);
      }
      return true;
    });

    // Apply status filter
    if (ietacStatusFilter === 'confirmed') {
      ietacFiltered = ietacFiltered.filter(s => confirmations[s.id]);
    } else if (ietacStatusFilter === 'pending') {
      ietacFiltered = ietacFiltered.filter(s => !confirmations[s.id]);
    }

    const totalStudents = ietacStudents.length;
    const ietacConfirmed = ietacStudents.filter(s => confirmations[s.id]).length;
    const ietacPending = totalStudents - ietacConfirmed;

    // ===== ESTADÍSTICAS AVANZADAS IETAC =====
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Filtrar eventos solo de estudiantes IETAC
    const ietacEvents = activityEvents.filter(e =>
      e.studentId && studentData.find(s => s.id === e.studentId && s.first.toUpperCase().startsWith('IETAC'))
    );

    const ietacTodayEvents = ietacEvents.filter(e => new Date(e.timestamp) >= today);
    const ietacWeekEvents = ietacEvents.filter(e => new Date(e.timestamp) >= weekAgo);

    // Logins y confirmaciones de hoy (IETAC)
    const ietacTodayLogins = ietacTodayEvents.filter(e => e.type === 'login').length;
    const ietacTodayConfirms = ietacTodayEvents.filter(e => e.type === 'confirmation').length;

    // Activos ahora (últimos 5 minutos, solo IETAC)
    const ietacActiveNow = new Set(
      ietacEvents
        .filter(e => new Date(e.timestamp) >= new Date(Date.now() - 5 * 60 * 1000))
        .map(e => e.studentId)
    ).size;

    // Tasa de conversión IETAC (login → confirmación)
    const ietacUniqueLogins = new Set(ietacEvents.filter(e => e.type === 'login').map(e => e.studentId)).size;
    const ietacUniqueConfirmations = new Set(ietacEvents.filter(e => e.type === 'confirmation').map(e => e.studentId)).size;
    const ietacConversionRate = ietacUniqueLogins > 0 ? Math.round((ietacUniqueConfirmations / ietacUniqueLogins) * 100) : 0;

    // Estudiantes que ingresaron pero no confirmaron (requieren atención)
    const ietacLoggedInIds = new Set(ietacEvents.filter(e => e.type === 'login').map(e => e.studentId));
    const ietacConfirmedIds = new Set(ietacEvents.filter(e => e.type === 'confirmation').map(e => e.studentId));
    const ietacNeedsAttention = [...ietacLoggedInIds].filter(id => !ietacConfirmedIds.has(id) && !confirmations[id]).length;

    // Hora pico de actividad IETAC (última semana)
    const ietacHourCounts: Record<number, number> = {};
    ietacWeekEvents.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      ietacHourCounts[hour] = (ietacHourCounts[hour] || 0) + 1;
    });
    const ietacPeakHour = Object.entries(ietacHourCounts).sort((a, b) => b[1] - a[1])[0];
    const ietacPeakHourFormatted = ietacPeakHour ? `${ietacPeakHour[0].padStart(2, '0')}:00` : 'N/A';

    // Promedio diario de actividad IETAC
    const ietacAvgDailyActivity = Math.round(ietacWeekEvents.length / 7);

    // Seguridad: estudiantes IETAC bloqueados
    const ietacSecurityStatuses = securityStatuses.filter(s =>
      studentData.find(st => st.id === s.studentId && st.first.toUpperCase().startsWith('IETAC'))
    );
    const ietacBlockedCount = ietacSecurityStatuses.filter(s => s.disabled).length;
    const ietacInfractionsCount = ietacSecurityStatuses.reduce((acc, s) => acc + (s.infractions?.length || 0), 0);

    // Usamos el estado en lugar de leer localStorage directo en render
    const showTutorial = showIetacTutorial;

    return (
      <div className="h-[100dvh] relative overflow-hidden font-sans bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        {/* Fondo tech con grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl"></div>

        <div className="relative h-full flex flex-col">
          {/* Tutorial Modal */}
          {showTutorial && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
                  <h2 className="text-white text-xl font-bold">¡Bienvenido, {IETAC_ADMIN_NAME}! 👋</h2>
                  <p className="text-blue-100 text-sm mt-2">{IETAC_ADMIN_ROLE} de {IETAC_INSTITUTION} • Panel de Gestión</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">1</div>
                    <div>
                      <h3 className="font-bold text-slate-800">Ver tus estudiantes</h3>
                      <p className="text-sm text-slate-600">Solo verás los estudiantes de IETAC.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">2</div>
                    <div>
                      <h3 className="font-bold text-slate-800">Filtrar por estado</h3>
                      <p className="text-sm text-slate-600">Toca las tarjetas de arriba para filtrar: Total, Confirmados o Pendientes.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">3</div>
                    <div>
                      <h3 className="font-bold text-slate-800">Contactar estudiantes</h3>
                      <p className="text-sm text-slate-600">Usa los botones 💬 (WhatsApp) o 📞 (Llamar) para contactarlos.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold shrink-0">4</div>
                    <div>
                      <h3 className="font-bold text-slate-800">Ver credenciales</h3>
                      <p className="text-sm text-slate-600">Cada tarjeta muestra el correo y contraseña del estudiante.</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0">
                  <button
                    onClick={() => {
                      localStorage.removeItem('ietac_show_tutorial');
                      localStorage.setItem('ietac_tutorial_completed', 'true');
                      // Actualizar estado para que React re-renderice y oculte el modal
                      setShowIetacTutorial(false);

                      // No recargar la página para mantener la sesión
                      window.location.hash = 'tutorial-completed';
                      window.location.hash = '';
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg"
                  >
                    ¡Entendido, empezar! ✓
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header Compacto */}
          <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm px-4 py-3 shrink-0 z-20 sticky top-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* IZQUIERDA: Identidad */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-lg">I</span>
                </div>
                <div className="leading-tight">
                  <h1 className="text-slate-800 font-bold text-base">Panel IETAC</h1>
                  <p className="text-slate-500 text-xs">{IETAC_ADMIN_NAME}</p>
                </div>
              </div>

              {/* CENTRO: Barra de Búsqueda Global */}
              <div className="w-full md:flex-1 md:max-w-md relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm shadow-sm"
                  placeholder="Buscar estudiante por nombre, ID..."
                />
              </div>
              {/* DERECHA: Acciones */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">

                {/* Botón Gestión CRUD (Nuevo) */}
                <button
                  onClick={() => setShowAdminCRUD(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg active:scale-95"
                  title="Gestionar estudiantes"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  <span className="hidden sm:inline">Gestión</span>
                </button>

                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                {/* Notificaciones / Actividad */}
                <button
                  onClick={() => setShowActivityPanel(!showActivityPanel)}
                  className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Ver actividad reciente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activityEvents.filter(e => e.studentId && studentData.find(s => s.id === e.studentId && s.first.toUpperCase().startsWith('IETAC'))).length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                  )}
                </button>

                {/* Exportar */}
                <button
                  onClick={() => exportIETACToExcel(ietacStudents, confirmations)}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Exportar a Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {/* Salir */}
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cerrar sesión"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* Dashboard Cards - Estático, fluye con scroll */}
          <div className="bg-white border-b border-slate-200 shadow-sm">
            {/* Header del Panel - Siempre visible, actúa como acordeón en móvil y desktop */}
            <button
              onClick={() => setIetacPanelExpanded(!ietacPanelExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ietacPending === 0 ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                  {ietacPending === 0 ? (
                    <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-slate-800 font-bold text-sm">Panel de Control IETAC</p>
                  <p className="text-slate-500 text-xs">
                    {ietacPending === 0 ? '✅ Todo al día' : `${ietacConfirmed}/${totalStudents} completados`} (Clic para ver detalles)
                  </p>
                </div>
              </div>
              <svg className={`w-5 h-5 text-slate-400 transition-transform ${ietacPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Contenido del Panel - Colapsable */}
            <div className={`${ietacPanelExpanded ? 'block' : 'hidden'} border-t border-slate-100`}>

              {/* TARJETA DE SEGURIDAD IETAC - Prominente si hay alertas */}
              {(ietacBlockedCount > 0 || ietacInfractionsCount > 0) && (
                <div className="mx-4 mt-4 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 rounded-xl p-4 shadow-lg text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-red-100 text-xs font-medium">Seguridad IETAC</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold">{ietacBlockedCount}</p>
                          <span className="text-red-200 text-sm">bloqueados</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-red-100 text-xs">Infracciones</p>
                      <p className="text-2xl font-bold">{ietacInfractionsCount}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Primera Fila: Métricas Principales */}
              <div className="px-4 py-4 overflow-x-auto">
                <div className="flex gap-3 md:grid md:grid-cols-4 min-w-max md:min-w-0">
                  {/* Card 1: Progreso General */}
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg min-w-[160px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      </div>
                      <span className="text-blue-100 text-xs font-medium">Progreso</span>
                    </div>
                    <p className="text-3xl font-black">{Math.round((ietacConfirmed / (totalStudents || 1)) * 100)}%</p>
                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-white h-full rounded-full" style={{ width: `${(ietacConfirmed / (totalStudents || 1)) * 100}%` }}></div>
                    </div>
                    <p className="text-blue-100 text-[10px] mt-1">{ietacConfirmed}/{totalStudents} completados</p>
                  </div>

                  {/* Card 2: Logins Hoy */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-[140px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      </div>
                      <span className="text-slate-500 text-xs font-medium">Logins Hoy</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{ietacTodayLogins}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Confirmaciones: {ietacTodayConfirms}</p>
                  </div>

                  {/* Card 3: En Línea Ahora */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-[140px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                      </div>
                      <span className="text-slate-500 text-xs font-medium">En Línea</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{ietacActiveNow}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Últimos 5 minutos</p>
                  </div>

                  {/* Card 4: Pendientes */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-[140px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-slate-500 text-xs font-medium">Pendientes</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{ietacPending}</p>
                    <button
                      onClick={() => { setIetacStatusFilter('pending'); setIetacPanelExpanded(false); }}
                      className="text-[10px] text-amber-600 font-medium hover:underline"
                    >
                      Ver lista →
                    </button>
                  </div>
                </div>
              </div>

              {/* Segunda Fila: Estadísticas Avanzadas */}
              <div className="px-4 pb-3 overflow-x-auto">
                <div className="flex gap-3 md:grid md:grid-cols-4 min-w-max md:min-w-0">
                  {/* Tasa de Conversión */}
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 shadow-lg text-white min-w-[120px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      <span className="text-purple-100 text-[10px] font-medium">Conversión</span>
                    </div>
                    <p className="text-2xl font-bold">{ietacConversionRate}%</p>
                    <p className="text-[9px] text-purple-200">Login → Confirm</p>
                  </div>

                  {/* Requieren Atención */}
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 shadow-lg text-white min-w-[120px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span className="text-amber-100 text-[10px] font-medium">Atención</span>
                    </div>
                    <p className="text-2xl font-bold">{ietacNeedsAttention}</p>
                    <p className="text-[9px] text-amber-200">Sin confirmar</p>
                  </div>

                  {/* Hora Pico */}
                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-3 shadow-lg text-white min-w-[120px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-cyan-100 text-[10px] font-medium">Hora Pico</span>
                    </div>
                    <p className="text-2xl font-bold">{ietacPeakHourFormatted}</p>
                    <p className="text-[9px] text-cyan-200">Mayor actividad</p>
                  </div>

                  {/* Promedio Diario */}
                  <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3 shadow-lg text-white min-w-[120px] md:min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      <span className="text-rose-100 text-[10px] font-medium">Prom/Día</span>
                    </div>
                    <p className="text-2xl font-bold">{ietacAvgDailyActivity}</p>
                    <p className="text-[9px] text-rose-200">Eventos/semana</p>
                  </div>
                </div>
              </div>

              {/* Acciones Rápidas */}
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => exportIETACToExcel(ietacStudents, confirmations)}
                  className="flex-1 min-w-[100px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-emerald-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Excel
                </button>
                <button
                  onClick={() => setShowActivityPanel(true)}
                  className="flex-1 min-w-[100px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-blue-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  Actividad
                </button>
                <button
                  onClick={() => { setIetacStatusFilter('confirmed'); setIetacPanelExpanded(false); }}
                  className="flex-1 min-w-[100px] bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  ✓ Listos ({ietacConfirmed})
                </button>
                <button
                  onClick={() => { setIetacStatusFilter('all'); setIetacPanelExpanded(false); }}
                  className="flex-1 min-w-[100px] bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  Todos ({totalStudents})
                </button>
              </div>
            </div>
          </div>

          {/* Sub-header: Filtros y Vista */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs sticky top-[73px] z-10 shadow-sm">
            <div className="text-slate-500">
              Mostrando <span className="font-bold text-slate-700">{ietacFiltered.length}</span> resultados de <span className="font-semibold text-slate-600">{totalStudents}</span>
            </div>
            <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg shadow-sm">
              <button
                onClick={() => setIetacViewMode('cards')}
                className={`px-3 py-1 flex items-center gap-1 rounded transition-all ${ietacViewMode === 'cards' ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                title="Vista de Tarjetas"
              >
                <span className="text-lg leading-none">🎴</span>
              </button>
              <div className="w-px bg-slate-100 mx-0.5"></div>
              <button
                onClick={() => setIetacViewMode('table')}
                className={`px-3 py-1 flex items-center gap-1 rounded transition-all ${ietacViewMode === 'table' ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                title="Vista de Tabla"
              >
                <span className="text-lg leading-none">📋</span>
              </button>
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {ietacFiltered.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl grayscale opacity-50">🔍</span>
                <p className="text-slate-500 mt-3">No se encontraron estudiantes</p>
                <button
                  onClick={() => { setSearchTerm(''); setIetacStatusFilter('all'); }}
                  className="mt-4 text-blue-600 text-sm underline hover:text-blue-500 font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : ietacViewMode === 'table' ? (
              /* Vista de Tabla */
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase text-xs tracking-wider">Estado</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase text-xs tracking-wider">Nombre</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase text-xs tracking-wider">ID</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase text-xs tracking-wider">Email</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase text-xs tracking-wider">Contraseña</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-bold uppercase text-xs tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ietacFiltered.map((student) => {
                        const isConfirmed = confirmations[student.id];
                        const cleanName = student.first.replace(/^IETAC\s*-\s*/i, '').trim();
                        const whatsappMessage = isConfirmed
                          ? `Hola ${cleanName}, soy ${IETAC_ADMIN_NAME}, ${IETAC_ADMIN_ROLE} de la institución. Ya vimos que creaste tu correo correctamente. ¡Excelente trabajo!`
                          : `Hola ${cleanName}, soy ${IETAC_ADMIN_NAME}, ${IETAC_ADMIN_ROLE} de la institución. Aún no has creado tu correo institucional. ¿Necesitas ayuda? Ingresa a seamosgenios-portal.web.app`;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-3">
                              {isConfirmed ? (
                                <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                  Listo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-900 font-semibold">{cleanName} {student.last}</td>
                            <td className="px-3 py-3 text-slate-500 font-mono text-xs">{student.id}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 font-mono text-xs truncate max-w-[200px]">{student.email}@gmail.com</span>
                                <button
                                  onClick={() => copyToClipboard(`${student.email}@gmail.com`, `email-${student.id}`)}
                                  className="text-blue-600 hover:text-blue-700 text-xs bg-blue-50 p-1 rounded hover:bg-blue-100 transition-colors"
                                >
                                  {copiedField === `email-${student.id}` ? '✓' : '📋'}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600 font-mono text-xs font-semibold">{student.password}</span>
                                <button
                                  onClick={() => copyToClipboard(student.password, `pass-${student.id}`)}
                                  className="text-blue-600 hover:text-blue-700 text-xs bg-blue-50 p-1 rounded hover:bg-blue-100 transition-colors"
                                >
                                  {copiedField === `pass-${student.id}` ? '✓' : '📋'}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <a
                                  href={`https://wa.me/57${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                                  title="WhatsApp"
                                >
                                  <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                  </svg>
                                </a>
                                <a
                                  href={`tel:+57${student.phone.replace(/\D/g, '')}`}
                                  className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                                  title="Llamar"
                                >
                                  <svg className="w-5 h-5" fill="#1e293b" viewBox="0 0 24 24">
                                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                                  </svg>
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Vista de Tarjetas */
              <div className="space-y-3">
                {ietacFiltered.map((student) => {
                  const isConfirmed = confirmations[student.id];
                  const cleanName = student.first.replace(/^IETAC\s*-\s*/i, '').trim();
                  const whatsappMessage = isConfirmed
                    ? `Hola ${cleanName}, soy ${IETAC_ADMIN_NAME}, ${IETAC_ADMIN_ROLE} de la institución. Ya vimos que creaste tu correo correctamente. ¡Excelente trabajo!`
                    : `Hola ${cleanName}, soy ${IETAC_ADMIN_NAME}, ${IETAC_ADMIN_ROLE} de la institución. Aún no has creado tu correo institucional. ¿Necesitas ayuda? Ingresa a seamosgenios-portal.web.app`;

                  return (
                    <div
                      key={student.id}
                      className={`relative bg-white rounded-xl p-4 border-2 transition-all shadow-md hover:shadow-lg ${isConfirmed
                        ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30'
                        : 'border-amber-200 bg-gradient-to-br from-white to-amber-50/30'
                        }`}
                    >
                      {/* Badge de Estado + En línea */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        {/* Indicador EN LÍNEA */}
                        {isStudentActive(activityEvents, student.id, 5) && (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-300">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            EN LÍNEA
                          </span>
                        )}
                        {/* Badge de confirmación */}
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            CONFIRMADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full border border-amber-300 animate-pulse">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            PENDIENTE
                          </span>
                        )}
                      </div>

                      {/* Header: Info del estudiante */}
                      <div className="flex items-start gap-3 mb-3 pr-32">
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${isConfirmed ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'
                            }`}>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          {/* Punto verde de actividad en el avatar */}
                          {isStudentActive(activityEvents, student.id, 5) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Usuario activo"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-slate-900 font-bold text-base truncate">
                            {cleanName} {student.last}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                              </svg>
                              ID: <span className="font-mono font-semibold">{student.id}</span>
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 text-xs">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {student.phone}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Credenciales */}
                      <div className="space-y-2 mb-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-slate-500 text-xs font-medium flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Correo Institucional
                            </span>
                            <button
                              onClick={() => copyToClipboard(`${student.email}@gmail.com`, `email-${student.id}`)}
                              className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                              {copiedField === `email-${student.id}` ? (
                                <>✓ Copiado</>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copiar
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-slate-900 font-mono text-sm font-semibold break-all">
                            {student.email}@gmail.com
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-slate-500 text-xs font-medium flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              Contraseña
                            </span>
                            <div className="flex items-center gap-1">
                              {/* Botón ojito para mostrar/ocultar */}
                              <button
                                onClick={() => togglePasswordVisibility(student.id)}
                                className="text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
                                title={visiblePasswords.has(student.id) ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              >
                                {visiblePasswords.has(student.id) ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                              </button>
                              {/* Botón copiar */}
                              <button
                                onClick={() => copyToClipboard(student.password, `pass-${student.id}`)}
                                className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                              >
                                {copiedField === `pass-${student.id}` ? (
                                  <>✓ Copiado</>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copiar
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-slate-900 font-mono text-sm font-semibold">
                            {visiblePasswords.has(student.id) ? student.password : '••••••••••'}
                          </p>
                        </div>
                      </div>

                      {/* Botones de contacto */}
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/57${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackWhatsAppContact(student.id)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-all active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          <span className="text-sm">WhatsApp</span>
                        </a>
                        <a
                          href={`tel:+57${student.phone.replace(/\D/g, '')}`}
                          onClick={() => trackPhoneCall(student.id)}
                          className="flex-1 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-700 font-semibold py-2.5 px-4 rounded-lg transition-all active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                          </svg>
                          <span className="text-sm">Llamar</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer con ayuda */}
          <div className="bg-black/20 border-t border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
            <p className="text-slate-400 text-xs">
              {ietacFiltered.length} de {totalStudents} estudiantes
            </p>
            <button
              onClick={() => {
                localStorage.setItem('ietac_show_tutorial', 'true');
                window.location.reload();
              }}
              className="text-blue-400 text-xs flex items-center gap-1 hover:text-white transition-colors"
            >
              ❓ Ayuda
            </button>
          </div>

          {/* Panel de Actividad Deslizable */}
          {showActivityPanel && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
                onClick={() => setShowActivityPanel(false)}
              />

              {/* Panel - Responsive para móvil */}
              <div className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:w-96 bg-slate-900 z-50 shadow-2xl transform transition-transform duration-300 overflow-hidden flex flex-col">
                {/* Header del panel */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-white font-bold text-lg">Centro de Actividad</h3>
                    <p className="text-blue-100 text-xs">Monitoreo en tiempo real</p>
                  </div>
                  <button
                    onClick={() => setShowActivityPanel(false)}
                    className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Estadísticas Rápidas */}
                <div className="bg-slate-800 p-3 border-b border-slate-700 shrink-0">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Logins de hoy */}
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-blue-400 text-[10px] font-medium">Logins</span>
                      </div>
                      <p className="text-white text-xl font-bold">
                        {activityEvents.filter(e => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return e.type === 'login' && new Date(e.timestamp) >= today &&
                            studentData.find(s => s.id === e.studentId && s.first.toUpperCase().startsWith('IETAC'));
                        }).length}
                      </p>
                      <p className="text-slate-500 text-[10px]">hoy</p>
                    </div>

                    {/* Confirmaciones de hoy */}
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-emerald-400 text-[10px] font-medium">Confirmados</span>
                      </div>
                      <p className="text-white text-xl font-bold">
                        {activityEvents.filter(e => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return e.type === 'confirmation' && new Date(e.timestamp) >= today &&
                            studentData.find(s => s.id === e.studentId && s.first.toUpperCase().startsWith('IETAC'));
                        }).length}
                      </p>
                      <p className="text-slate-500 text-[10px]">hoy</p>
                    </div>

                    {/* Usuarios activos ahora */}
                    <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-green-400 text-[10px] font-medium">En línea</span>
                      </div>
                      <p className="text-white text-xl font-bold">
                        {new Set(
                          activityEvents
                            .filter(e => {
                              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                              return new Date(e.timestamp) >= fiveMinutesAgo &&
                                studentData.find(s => s.id === e.studentId && s.first.toUpperCase().startsWith('IETAC'));
                            })
                            .map(e => e.studentId)
                        ).size}
                      </p>
                      <p className="text-slate-500 text-[10px]">ahora</p>
                    </div>
                  </div>
                </div>

                {/* Contenido scrolleable - Lista de eventos */}
                <div className="flex-1 overflow-y-auto p-4">
                  <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Actividad Reciente</h4>

                  {activityEvents
                    .filter(event => {
                      const student = studentData.find(s => s.id === event.studentId);
                      return student && student.first.toUpperCase().startsWith('IETAC');
                    })
                    .slice(0, 50)
                    .map((event, idx) => {
                      const student = studentData.find(s => s.id === event.studentId);
                      if (!student) return null;

                      const cleanName = student.first.replace(/^IETAC\s*-\s*/i, '').trim();
                      const timeAgo = getTimeAgo(event.timestamp);
                      const isActive = isStudentActive(activityEvents, student.id, 5);

                      // Determinar icono y color según tipo de evento
                      let eventIcon = '👤';
                      let eventColor = 'bg-blue-500';
                      let eventText = 'Ingresó al sistema';

                      if (event.type === 'confirmation') {
                        eventIcon = '✓';
                        eventColor = 'bg-emerald-500';
                        eventText = 'Confirmó su cuenta';
                      } else if (event.type === 'view_credentials') {
                        eventIcon = '👁';
                        eventColor = 'bg-purple-500';
                        eventText = 'Vio sus credenciales';
                      } else if (event.type === 'copy_email') {
                        eventIcon = '📧';
                        eventColor = 'bg-cyan-500';
                        eventText = 'Copió su email';
                      } else if (event.type === 'copy_password') {
                        eventIcon = '🔑';
                        eventColor = 'bg-amber-500';
                        eventText = 'Copió su contraseña';
                      }

                      return (
                        <div
                          key={`${event.timestamp}-${idx}`}
                          className="bg-slate-800/50 rounded-lg p-3 mb-2 border border-slate-700/50 hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${eventColor}`}>
                                {eventIcon}
                              </div>
                              {isActive && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium text-sm truncate">
                                  {cleanName} {student.last}
                                </p>
                                {isActive && (
                                  <span className="text-[10px] text-green-400 font-medium">● EN LÍNEA</span>
                                )}
                              </div>
                              <p className="text-slate-400 text-xs">ID: {student.id}</p>
                              <p className="text-blue-300 text-xs mt-1">
                                {eventText}
                              </p>
                              <p className="text-slate-500 text-xs mt-1">{timeAgo}</p>
                            </div>
                            {/* Botones de acción rápida */}
                            <div className="flex flex-col gap-1">
                              <a
                                href={`https://wa.me/57${student.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors"
                                title="WhatsApp"
                              >
                                <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                              </a>
                              <a
                                href={`tel:+57${student.phone.replace(/\D/g, '')}`}
                                className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded-full flex items-center justify-center transition-colors"
                                title="Llamar"
                              >
                                <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {activityEvents.filter(e => {
                    const student = studentData.find(s => s.id === e.studentId);
                    return student && student.first.toUpperCase().startsWith('IETAC');
                  }).length === 0 && (
                      <div className="text-center py-12">
                        <span className="text-4xl">📊</span>
                        <p className="text-slate-400 mt-3">No hay actividad reciente de IETAC</p>
                        <p className="text-slate-500 text-xs mt-1">Los eventos aparecerán aquí cuando los estudiantes usen la plataforma</p>
                      </div>
                    )}
                </div>
              </div>
            </>
          )}

          {/* Modal CRUD Admin IETAC */}
          {showAdminCRUD && (
            <AdminCRUD
              adminId={IETAC_ADMIN_ID}
              onClose={() => setShowAdminCRUD(false)}
              fixedInstitution="IETAC"
            />
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: STUDENT FLOW
  // ============================================
  return (
    <div className="h-[100dvh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* 🔔 TOAST GLOBAL - Notificaciones temporales sin modales */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl animate-slideDown max-w-[90%] ${toast.type === 'success' ? 'bg-green-500/90 text-white border border-green-400' :
          toast.type === 'error' ? 'bg-red-500/90 text-white border border-red-400' :
            'bg-blue-500/90 text-white border border-blue-400'
          }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '⛔' : '👋'}
            </span>
            <p className="text-sm font-medium leading-relaxed">{toast.message}</p>
          </div>
        </div>
      )}

      {/* 🔐 MODAL: Consultar credenciales rápidas */}
      {showCredentialsModal && authenticatedStudent && credentials && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Mis Credenciales</h3>
              <button onClick={() => setShowCredentialsModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Tu nuevo correo</p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-mono text-sm">{credentials.email}</p>
                  <button onClick={() => copyToClipboard(credentials.email, 'email_modal')} className="text-blue-400 text-xs">Copiar</button>
                </div>
              </div>

              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Contraseña</p>
                <div className="flex items-center justify-between">
                  {visiblePasswords.has(authenticatedStudent.id) ? (
                    <p className="text-white font-mono text-sm">{credentials.suggestedPassword}</p>
                  ) : (
                    <p className="text-slate-500 font-mono text-sm">••••••••••</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => togglePasswordVisibility(authenticatedStudent.id)} className="text-slate-400 text-xs">
                      {visiblePasswords.has(authenticatedStudent.id) ? '🙈' : '👁️'}
                    </button>
                    <button onClick={() => copyToClipboard(credentials.suggestedPassword, 'pass_modal')} className="text-blue-400 text-xs">Copiar</button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCredentialsModal(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 🚫 MODAL: Acceso Denegado (Intruso) - PROFESIONAL */}
      {showIntruderModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-[#1a0a0a] via-[#2d1010] to-[#1a0a0a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-red-500/30 animate-scaleIn">

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-red-900/20 flex items-center justify-center border-2 border-red-500/40 shadow-lg shadow-red-500/20">
                <svg className="w-14 h-14 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-400 mb-2">Acceso Denegado</h2>
              <p className="text-red-200/70 text-sm">Este correo no está autorizado</p>
            </div>

            {/* Email usado */}
            <div className="bg-red-950/50 rounded-2xl p-4 mb-6 border border-red-500/20">
              <p className="text-red-300/70 text-xs font-medium uppercase tracking-wider mb-2">Correo detectado:</p>
              <p className="text-white font-mono text-sm break-all bg-black/30 p-3 rounded-xl">{intruderEmail}</p>
            </div>

            {/* Mensaje */}
            <div className="bg-slate-900/50 rounded-2xl p-4 mb-6 border border-slate-700/30">
              <p className="text-slate-300 text-sm leading-relaxed">{intruderMessage}</p>
            </div>

            {/* Instrucción */}
            <div className="bg-blue-950/30 rounded-2xl p-4 mb-6 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 text-xl">💡</span>
                <div>
                  <p className="text-blue-200 text-sm font-medium">¿Qué debes hacer?</p>
                  <p className="text-blue-200/70 text-xs mt-1">
                    Inicia sesión <strong className="text-white">únicamente</strong> con el correo institucional que te fue asignado.
                    Si no lo recuerdas, revisa tus credenciales en el paso anterior.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón Leído */}
            <button
              onClick={() => {
                setShowIntruderModal(false);
                handleLogout();
              }}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-4 rounded-2xl text-base transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Entendido, volver al inicio
            </button>

            <p className="text-center text-red-300/50 text-xs mt-4">
              Si crees que es un error, contacta al administrador
            </p>
          </div>
        </div>
      )}

      {/* 🚨 MODAL: Advertencia por no copiar (15 segundos) */}
      {showNoCopyWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-500/30 animate-scaleIn">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-block bg-red-500/20 rounded-full p-4 mb-3">
                <span className="text-5xl">⛔</span>
              </div>
              <h3 className="text-xl font-bold text-white">¡ATENCIÓN!</h3>
              <p className="text-red-300 text-sm font-medium mt-1">No has copiado el campo: <strong className="text-white">{noCopyWarningField}</strong></p>
            </div>

            {/* Warning Content */}
            <div className="bg-red-500/10 rounded-2xl p-4 mb-4 border border-red-500/30">
              <p className="text-center text-red-200 text-sm leading-relaxed">
                <strong className="text-white">Escribir manualmente aumenta el riesgo de error.</strong>
                <br /><br />
                Si los datos no coinciden exactamente con los proporcionados, tu cuenta será <strong className="text-red-400">INHABILITADA</strong> y perderás acceso a todos los recursos.
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-sm text-slate-300 mb-4">
              <p className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Usa el botón &quot;Copiar&quot; para cada campo
              </p>
              <p className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Pega los datos exactamente como se muestran
              </p>
              <p className="flex items-center gap-2">
                <span className="text-red-400">✗</span>
                NO escribas manualmente los datos
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-1000"
                style={{ width: `${((15 - noCopyWarningCountdown) / 15) * 100}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-red-300 font-medium">
              {noCopyWarningCountdown > 0
                ? `Debes esperar ${noCopyWarningCountdown} segundos...`
                : '¡Ahora puedes cerrar!'
              }
            </p>

            {/* Button */}
            <button
              onClick={() => {
                if (noCopyWarningCountdown === 0) {
                  setShowNoCopyWarningModal(false);
                }
              }}
              disabled={noCopyWarningCountdown > 0}
              className={`w-full mt-4 font-medium py-3 rounded-xl transition-all ${noCopyWarningCountdown > 0
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                }`}
            >
              {noCopyWarningCountdown > 0
                ? `Espera ${noCopyWarningCountdown}s...`
                : '✓ Entendido, usaré el botón Copiar'
              }
            </button>
          </div>
        </div>
      )}

      {/* 🚨 MODAL: Ultimátum antes del paso 4 */}
      {showUltimatumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-br from-slate-900 via-amber-900 to-red-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-amber-500/40 animate-scaleIn">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-block bg-amber-500/30 rounded-full p-4 mb-3">
                <span className="text-5xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-bold text-white">ADVERTENCIA CRÍTICA</h3>
              <p className="text-amber-300 text-sm font-medium mt-1">Lee esto antes de continuar</p>
            </div>

            {/* Critical Warning */}
            <div className="bg-red-500/20 rounded-2xl p-4 mb-4 border-2 border-red-500/50">
              <p className="text-center text-white text-base font-bold leading-relaxed">
                Si la información no coincide EXACTAMENTE con la que se te proporcionó:
              </p>
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 text-red-200 text-sm">
                  <span className="text-red-400">❌</span>
                  Perderás acceso a las <strong className="text-white">Clases en Vivo</strong>
                </p>
                <p className="flex items-center gap-2 text-red-200 text-sm">
                  <span className="text-red-400">❌</span>
                  Perderás acceso a las <strong className="text-white">Grabaciones</strong>
                </p>
                <p className="flex items-center gap-2 text-red-200 text-sm">
                  <span className="text-red-400">❌</span>
                  Perderás acceso a la <strong className="text-white">Nube de 1000GB</strong>
                </p>
              </div>
            </div>

            {/* Confirmation */}
            <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
              <p className="text-center text-slate-300 text-sm">
                Al continuar, confirmas que has <strong className="text-green-400">copiado y pegado</strong> todos los datos exactamente como se mostraron.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full transition-all duration-1000"
                style={{ width: `${((10 - ultimatumCountdown) / 10) * 100}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-amber-300 font-medium mb-4">
              {ultimatumCountdown > 0
                ? `Lee la advertencia... ${ultimatumCountdown}s`
                : '¿Estás seguro de continuar?'
              }
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUltimatumModal(false);
                  setUltimatumCountdown(10);
                }}
                className="flex-1 font-medium py-3 rounded-xl transition-all bg-slate-600 hover:bg-slate-700 text-white"
              >
                ← Revisar datos
              </button>
              <button
                onClick={() => {
                  if (ultimatumCountdown === 0) {
                    setUltimatumAccepted(true);
                    setShowUltimatumModal(false);
                    // Ahora que aceptó, intentar avanzar de nuevo
                    handleStepAdvance('guide-3-email', 'guide-4-password');
                  }
                }}
                disabled={ultimatumCountdown > 0}
                className={`flex-1 font-medium py-3 rounded-xl transition-all ${ultimatumCountdown > 0
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                  }`}
              >
                {ultimatumCountdown > 0
                  ? `${ultimatumCountdown}s...`
                  : '✓ Continuar'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 MODAL: Paso 1 - Seguimiento de Asistencias */}
      {showStep1InfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 animate-scaleIn">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-block bg-blue-500/20 rounded-full p-4 mb-3">
                <span className="text-4xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-white">¡Bienvenido al PreICFES!</h3>
              <p className="text-blue-300 text-sm font-medium mt-1">Información importante</p>
            </div>

            {/* Content */}
            <div className="bg-white/10 rounded-2xl p-4 mb-4 border border-blue-400/30">
              <p className="text-center text-white text-sm leading-relaxed">
                Este correo institucional será usado para:
              </p>
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 text-blue-200 text-sm">
                  <span className="text-green-400">📅</span>
                  <strong className="text-white">Seguimiento de asistencias</strong> a clases
                </p>
                <p className="flex items-center gap-2 text-blue-200 text-sm">
                  <span className="text-green-400">📈</span>
                  Registro de tu <strong className="text-white">participación</strong> en el PreICFES
                </p>
                <p className="flex items-center gap-2 text-blue-200 text-sm">
                  <span className="text-green-400">☁️</span>
                  Acceso a la <strong className="text-white">Nube de 1000GB</strong>
                </p>
                <p className="flex items-center gap-2 text-blue-200 text-sm">
                  <span className="text-green-400">🎥</span>
                  Acceso a <strong className="text-white">Clases en Vivo y Grabaciones</strong>
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-500/10 rounded-xl p-3 mb-4 border border-amber-500/30">
              <p className="text-center text-amber-200 text-xs">
                ⚠️ <strong>Es obligatorio</strong> completar este proceso correctamente para acceder a todos los recursos del programa.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-1000"
                style={{ width: `${((8 - step1InfoCountdown) / 8) * 100}%` }}
              ></div>
            </div>
            <p className="text-center text-sm text-blue-300 font-medium">
              {step1InfoCountdown > 0
                ? `Lee esta información... ${step1InfoCountdown}s`
                : '¡Listo para continuar!'
              }
            </p>

            {/* Button */}
            <button
              onClick={() => {
                if (step1InfoCountdown === 0) {
                  setShowStep1InfoModal(false);
                }
              }}
              disabled={step1InfoCountdown > 0}
              className={`w-full mt-4 font-medium py-3 rounded-xl transition-all ${step1InfoCountdown > 0
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                }`}
            >
              {step1InfoCountdown > 0
                ? `Espera ${step1InfoCountdown}s...`
                : '✓ Entendido, ¡comencemos!'
              }
            </button>
          </div>
        </div>
      )}

      {/* Header - Fixed */}
      <header className="relative z-10 bg-black/20 backdrop-blur-xl border-b border-white/10 p-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold">SeamosGenios</h1>
              <p className="text-purple-300 text-xs">PreICFES Intensivo</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-purple-300 hover:text-white text-sm">
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Content - Scrollable */}
      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="w-full max-w-lg">

            {/* 1. Credentials Display - BIENVENIDA PREMIUM V3 - Diseño Profesional */}
            {studentStep === 'credentials' && credentials && authenticatedStudent && (
              <div className="space-y-5 animate-fadeIn">

                {/* 🎯 MODAL DE BIENVENIDA - Opción Google o Crear Cuenta */}
                {showWelcomeModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
                    <div className="relative bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl shadow-purple-500/20">
                      {/* Efecto decorativo */}
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
                      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>

                      {/* Contenido */}
                      <div className="relative z-10 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/40">
                          <span className="text-3xl font-bold text-white">
                            {credentials.firstName.charAt(0)}{credentials.lastName.charAt(0)}
                          </span>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-1">¡Hola, {credentials.firstName}!</h2>
                        <p className="text-purple-200/70 text-sm mb-4">{authenticatedStudent.institution}</p>

                        {/* Tarjeta de credenciales */}
                        <div className="bg-white/10 rounded-2xl p-4 mb-6 border border-white/10 text-left">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                              <span className="text-lg">👤</span>
                            </div>
                            <div>
                              <p className="text-white/50 text-xs">Nombre completo</p>
                              <p className="text-white font-medium text-sm">{credentials.firstName} {credentials.lastName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                              <span className="text-lg">📧</span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-white/50 text-xs">Tu correo asignado</p>
                              <p className="text-white font-medium text-sm truncate">{credentials.email}</p>
                            </div>
                          </div>
                        </div>

                        <p className="text-purple-200/80 mb-6">¿Ya creaste esta cuenta de Google?</p>

                        {/* Opción 1: Conectar Google */}
                        <button
                          onClick={async () => {
                            setShowWelcomeModal(false);
                            // Ir directo a verificación de Google
                            if (authenticatedStudent && credentials) {
                              setStudentStep('confirmation-final');
                              // Trigger Google verification
                              setTimeout(() => {
                                const verifyBtn = document.querySelector('[data-verify-google]') as HTMLButtonElement;
                                if (verifyBtn) verifyBtn.click();
                              }, 500);
                            }
                          }}
                          className="w-full mb-4 py-4 px-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                          <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Ya tengo cuenta - Conectar Google
                        </button>

                        {/* Opción 2: Crear cuenta */}
                        <button
                          onClick={() => setShowWelcomeModal(false)}
                          className="w-full py-4 px-6 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl border border-white/20 transition-all flex items-center justify-center gap-3"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          No tengo cuenta - Crear ahora
                        </button>

                        <p className="text-purple-300/50 text-xs mt-6">
                          Si ya creaste tu cuenta de Google, conéctala para verificar
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== TARJETA DE BIENVENIDA PROFESIONAL ========== */}
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden">
                  {/* Efecto de brillo superior */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <div className="p-6 space-y-4">
                    {/* Avatar con iniciales y estado activo */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/30">
                          <span className="text-white text-xl font-bold">
                            {credentials.firstName.charAt(0)}{credentials.lastName.charAt(0)}
                          </span>
                        </div>
                        {/* Indicador de estado activo */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-slate-900"></div>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white leading-tight">
                          ¡Hola, {credentials.firstName.split(' ')[0]}!
                        </h2>
                        <p className="text-purple-300/80 text-sm flex items-center gap-1.5 mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {authenticatedStudent.institution}
                        </p>
                      </div>
                    </div>

                    {/* Mensaje personalizado con destacado */}
                    <p className="text-white/70 text-sm leading-relaxed">
                      Te guiaremos paso a paso para crear tu <span className="text-white font-semibold">cuenta institucional de Google</span>.
                      Solo toma <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        5 minutos
                      </span>.
                    </p>
                  </div>
                </div>

                {/* ========== PASOS DEL PROCESO - Timeline Profesional ========== */}
                <div className="bg-white/5 rounded-2xl border border-white/10 p-5">
                  <h3 className="text-white font-bold text-sm mb-5 flex items-center gap-2">
                    <span className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg w-7 h-7 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </span>
                    ¿Qué haremos?
                  </h3>

                  {/* Timeline con línea conectora */}
                  <div className="relative space-y-4 pl-2">
                    {/* Línea vertical conectora */}
                    <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-purple-500 via-purple-500/50 to-slate-700"></div>

                    {/* Paso 1 - Activo */}
                    <div className="relative flex gap-4 items-start">
                      <div className="relative z-10 w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/40 ring-4 ring-slate-900">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="pt-1.5">
                        <p className="text-white text-sm font-semibold">Crear tu cuenta Gmail</p>
                        <p className="text-purple-300/70 text-xs mt-0.5">Una cuenta institucional exclusiva para ti</p>
                      </div>
                    </div>

                    {/* Paso 2 - Pendiente */}
                    <div className="relative flex gap-4 items-start opacity-60">
                      <div className="relative z-10 w-10 h-10 bg-slate-800 border border-slate-600 rounded-xl flex items-center justify-center shrink-0 ring-4 ring-slate-900">
                        <span className="text-slate-400 text-sm font-bold">2</span>
                      </div>
                      <div className="pt-1.5">
                        <p className="text-white/80 text-sm font-medium">Seguir la guía interactiva</p>
                        <p className="text-purple-300/50 text-xs mt-0.5">Te decimos exactamente qué escribir</p>
                      </div>
                    </div>

                    {/* Paso 3 - Pendiente */}
                    <div className="relative flex gap-4 items-start opacity-60">
                      <div className="relative z-10 w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center shrink-0 ring-4 ring-slate-900">
                        <span className="text-slate-500 text-sm font-bold">3</span>
                      </div>
                      <div className="pt-1.5">
                        <p className="text-white/60 text-sm font-medium">Verificar con Google</p>
                        <p className="text-purple-300/40 text-xs mt-0.5">Confirmar que todo está bien</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ========== REQUISITO IMPORTANTE - Diseño destacado ========== */}
                <div className="relative bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 overflow-hidden">
                  {/* Borde brillante superior */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"></div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-amber-200 text-[13px] font-semibold mb-1">Importante</p>
                      <p className="text-amber-100/80 text-xs leading-relaxed">
                        Mantén esta pestaña abierta junto con <strong className="text-white">Chrome</strong> o <strong className="text-white">Safari</strong> para seguir las instrucciones paso a paso.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ========== BOTONES DE ACCIÓN MEJORADOS ========== */}
                <div className="space-y-4 pt-4">
                  {/* Botón Principal - Comenzar (Gradiente vibrante) */}
                  <button
                    onClick={() => setStudentStep('guide-intro')}
                    className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-bold py-4 px-6 rounded-2xl shadow-2xl shadow-purple-500/30 transition-all duration-300 active:scale-[0.97] hover:shadow-purple-500/50 hover:scale-[1.02] flex items-center justify-center gap-3 text-base relative overflow-hidden group"
                  >
                    {/* Efecto de brillo */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Comenzar ahora</span>
                    <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>

                  {/* Separador mejorado */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-purple-400/20"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-5 text-purple-200/60 text-xs font-medium tracking-wider uppercase bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-full py-1">
                        o si ya la tienes
                      </span>
                    </div>
                  </div>

                  {/* Botón Secundario - Ya tengo cuenta (Glassmorphism) */}
                  <button
                    onClick={handleIntelligentVerification}
                    disabled={isVerifyingIntelligent}
                    className={`w-full border-2 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group ${isVerifyingIntelligent
                      ? 'border-purple-500/50 bg-purple-500/20 text-purple-200 cursor-wait'
                      : 'border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/50 hover:shadow-lg hover:shadow-white/10'
                      }`}
                  >
                    {isVerifyingIntelligent ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Verificando...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-md">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-white/90">Ya tengo mi cuenta</span>
                          <span className="text-purple-300/70 text-xs">Verificar con Google</span>
                        </div>
                        <svg className="w-4 h-4 text-purple-300/50 ml-auto group-hover:text-white/80 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 🚀 MODAL EXPRESS - Verificación rápida con Google */}
            {showExpressModal && credentials && authenticatedStudent && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
                <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-purple-500/30 animate-scaleIn">

                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="inline-block bg-purple-500/20 rounded-full p-4 mb-4">
                      <span className="text-5xl">{expressSuccess ? '✅' : expressError?.includes('no coincide') ? '❌' : '🚀'}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white">
                      {expressSuccess ? '¡Cuenta Verificada!' : expressError?.includes('no coincide') ? 'Email No Coincide' : 'Verificación Express'}
                    </h3>
                    <p className="text-purple-300 text-sm mt-2">
                      {expressSuccess
                        ? 'Tu cuenta ha sido confirmada correctamente'
                        : expressError?.includes('no coincide')
                          ? 'Serás redirigido al login'
                          : 'Verifica tu cuenta con Google'}
                    </p>
                  </div>

                  {/* Éxito */}
                  {expressSuccess && (
                    <div className="bg-green-500/20 rounded-2xl p-4 mb-6 border border-green-500/30">
                      <p className="text-center text-green-200 text-sm">
                        ¡Excelente! Tu cuenta <strong className="text-white">{credentials.email}</strong> ha sido verificada.
                      </p>
                    </div>
                  )}

                  {/* Error de mismatch con countdown */}
                  {expressError?.includes('no coincide') && (
                    <div className="bg-red-500/20 rounded-2xl p-4 mb-6 border border-red-500/30">
                      <p className="text-center text-red-200 text-sm mb-4">{expressError}</p>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full h-2 bg-red-900/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all duration-1000"
                            style={{ width: `${((5 - expressRedirectCountdown) / 5) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-red-300 font-bold text-lg">{expressRedirectCountdown}s</span>
                      </div>
                    </div>
                  )}

                  {/* Estado normal (no éxito ni error de mismatch) */}
                  {!expressSuccess && !expressError?.includes('no coincide') && (
                    <>
                      {/* Info */}
                      <div className="bg-white/5 rounded-2xl p-4 mb-4 border border-white/10">
                        <p className="text-slate-300 text-sm text-center leading-relaxed">
                          Si ya creaste tu cuenta Gmail con los datos proporcionados, puedes <strong className="text-white">verificarla directamente</strong> con Google.
                        </p>
                      </div>

                      {/* Requisitos */}
                      <div className="bg-blue-500/10 rounded-xl p-4 mb-4 border border-blue-500/20">
                        <p className="text-blue-300 text-xs font-medium mb-2">📋 Requisitos:</p>
                        <ul className="text-blue-200/80 text-xs space-y-1">
                          <li>• Tu cuenta Gmail debe estar creada</li>
                          <li>• Debe coincidir con: <strong className="text-white">{credentials.email}</strong></li>
                        </ul>
                      </div>

                      {/* Intentos restantes */}
                      {expressRemainingAttempts !== null && expressRemainingAttempts > 0 && (
                        <div className="text-center mb-4">
                          <span className="text-xs text-slate-400">
                            Intentos disponibles hoy: <strong className="text-purple-300">{expressRemainingAttempts}</strong>
                          </span>
                        </div>
                      )}

                      {/* Error general */}
                      {expressError && !expressError.includes('no coincide') && (
                        <div className="bg-amber-500/10 rounded-xl p-3 mb-4 border border-amber-500/30">
                          <p className="text-amber-200 text-xs text-center">{expressError}</p>
                        </div>
                      )}

                      {/* Botones */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowExpressModal(false)}
                          disabled={expressVerifying}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleExpressVerification}
                          disabled={expressVerifying || expressRemainingAttempts === 0}
                          className="flex-[2] bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {expressVerifying ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Verificando...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" opacity="0.7" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" opacity="0.8" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" opacity="0.6" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                              </svg>
                              Verificar con Google
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Warning de seguridad */}
                  {!expressSuccess && !expressError?.includes('no coincide') && (
                    <div className="mt-4 text-center">
                      <p className="text-xs text-slate-500">
                        🔒 Si el email no coincide, serás redirigido al inicio
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Guide Intro - Detailed Steps */}
            {studentStep === 'guide-intro' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Cómo crear tu cuenta Gmail</h2>
                  <p className="text-purple-300 text-sm mt-1">Sigue estos pasos en tu celular</p>
                </div>

                {/* Step by step instructions */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
                  {/* Step 1 */}
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">Abre Ajustes de tu celular</p>
                        <p className="text-purple-300/80 text-xs mt-1">El ícono de engranaje ⚙️</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">Ve a &quot;Cuentas&quot; o &quot;Usuarios y cuentas&quot;</p>
                        <p className="text-purple-300/80 text-xs mt-1">Depende de tu celular, busca algo similar</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">Toca &quot;Añadir cuenta&quot;</p>
                        <p className="text-purple-300/80 text-xs mt-1">Luego selecciona &quot;Google&quot;</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-4 bg-green-500/10">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">4</div>
                      <div className="flex-1">
                        <p className="text-white font-bold text-sm">Toca &quot;Crear cuenta&quot;</p>
                        <p className="text-green-300 text-xs mt-1 font-medium">→ Selecciona &quot;Para uso personal&quot;</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alternative method */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-2">💡 Opción alternativa:</p>
                  <p className="text-slate-300 text-xs">
                    También puedes abrir <strong className="text-white">Chrome</strong> → ir a <strong className="text-white">gmail.com</strong> → &quot;Crear cuenta&quot;
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStudentStep('credentials')}
                    className="flex-1 bg-white/10 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98]"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={() => setStudentStep('guide-1-name')}
                    className="flex-[2] bg-[#1a73e8] hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98]"
                  >
                    Ya estoy ahí ✓
                  </button>
                </div>
              </div>
            )}

            {/* 3. GOOGLE SIMULATOR - More Faithful Design */}
            {(studentStep.startsWith('guide-') && studentStep !== 'guide-intro') && credentials && authenticatedStudent && (
              <div className="fixed inset-0 z-50 bg-white flex flex-col font-sans text-slate-900 animate-fadeIn">

                {/* Google Header */}
                <div className="bg-white px-4 py-6 flex flex-col items-center border-b border-slate-100">
                  <img
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbvb3Bz8eE4mRJ3DGD-hK-kSpRGL5pIRQ4TNG2dXbn8cFNfYtz3VFfiBOC-gkJ4d_RqyHqvnn5pWNt23_1iTOrWndk-zy76jdre4zHsYEuxw&s=10"
                    alt="Google"
                    className="h-8 mb-4 object-contain"
                  />
                  <h1 className="text-xl font-normal text-slate-800">
                    {studentStep === 'guide-1-name' && 'Crear una cuenta de Google'}
                    {studentStep === 'guide-2-basic' && 'Información básica'}
                    {studentStep === 'guide-3-email' && 'Elige tu dirección de Gmail'}
                    {studentStep === 'guide-4-password' && 'Crea una contraseña segura'}
                  </h1>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-6">
                  <div className="px-4 py-6 max-w-md mx-auto w-full">

                    {/* Progress Bar */}
                    <div className="flex items-center justify-center gap-1 mb-6">
                      {['guide-1-name', 'guide-2-basic', 'guide-3-email', 'guide-4-password'].map((step, idx) => {
                        const currentIdx = ['guide-1-name', 'guide-2-basic', 'guide-3-email', 'guide-4-password'].indexOf(studentStep);
                        const isComplete = idx < currentIdx;
                        const isCurrent = step === studentStep;
                        return (
                          <div key={step} className="flex items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${isCurrent ? 'bg-[#1a73e8] text-white scale-110 animate-pulse' :
                              isComplete ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                              }`}>
                              {isComplete ? '✓' : idx + 1}
                            </div>
                            {idx < 3 && <div className={`w-4 h-0.5 transition-colors ${isComplete ? 'bg-green-500' : 'bg-slate-200'}`}></div>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Helper Banner */}
                    {/* Dynamic Step Tutorial */}
                    <StepTutorial step={studentStep} />

                    {/* Spotlight Modal Tutorial */}
                    <SpotlightModal
                      step={studentStep}
                      isVisible={showStepIntro}
                      onClose={() => {
                        setShowStepIntro(false);
                        setTourStep('active');
                      }}
                    />

                    {/* STEP 1: Name */}
                    {studentStep === 'guide-1-name' && (
                      <div className="space-y-4 animate-fadeIn">
                        <p className="text-sm text-slate-600 text-center mb-6">Ingresa tu nombre para tu nueva cuenta</p>

                        <div className="relative animate-pulse-border">
                          <GoogleField
                            label="Nombre"
                            value={authenticatedStudent.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim()}
                            onCopy={() => {
                              const tag = authenticatedStudent.first.match(/^(IETAC|SG)/i)?.[0]?.toUpperCase() || 'SG';
                              const cleanName = authenticatedStudent.first.replace(/^(IETAC|SG)\s*-\s*/i, '').trim();
                              copyToClipboard(`${tag} - ${cleanName}`, 'first');
                            }}
                            institutionTag={authenticatedStudent.first.match(/^(IETAC|SG)/i)?.[0]?.toUpperCase() || 'SG'}
                          />
                          {copiedFields.firstName && <div className="absolute -right-2 -top-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fadeIn z-20 shadow-sm">✓ Copiado</div>}
                        </div>

                        <div className="relative">
                          <GoogleField
                            label="Apellidos"
                            value={authenticatedStudent.last}
                            onCopy={() => copyToClipboard(authenticatedStudent.last, 'last')}
                          />
                          {copiedFields.lastName && <div className="absolute -right-2 -top-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fadeIn">✓ Copiado</div>}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => setStudentStep('guide-intro')}
                            className="text-[#1a73e8] font-medium text-sm px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors active:scale-[0.98]"
                          >
                            Atrás
                          </button>
                          <button
                            onClick={async () => {
                              await handleStepAdvance('guide-1-name', 'guide-2-basic');
                            }}
                            className="bg-[#1a73e8] text-white font-medium text-sm px-8 py-2.5 rounded-full shadow-sm hover:bg-[#1557b0] hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Basic Info */}
                    {studentStep === 'guide-2-basic' && (
                      <div className="space-y-6 animate-fadeIn">
                        <p className="text-sm text-slate-600 text-center mb-2">
                          <span className="text-purple-600 font-bold">ESCRIBE</span> esta información en Google
                        </p>

                        {/* Tarjeta de Referencia Visual Grande */}
                        {(() => {
                          const rawBirth = authenticatedStudent.birth ? authenticatedStudent.birth.trim() : '';
                          const cleanBirth = rawBirth.replace(/[\/-]/g, ' ').replace(/\s+/g, ' ');
                          const parts = cleanBirth.split(' ');

                          let day = '', month = '', year = '';

                          if (parts.length >= 3) {
                            day = parts[0].replace(/\D/g, '');
                            month = parts[1];
                            year = parts[2].replace(/\D/g, '');
                            if (!isNaN(parseInt(month))) {
                              month = months[parseInt(month) - 1] || month;
                            }
                          } else {
                            const match = rawBirth.match(/^(\d+)/);
                            day = match ? match[1] : rawBirth;
                          }

                          return (
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border-2 border-purple-200 shadow-sm">
                              {/* Encabezado */}
                              <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">✍️</span>
                                <h3 className="text-purple-700 font-bold">Tu Fecha de Nacimiento</h3>
                              </div>

                              {/* Fecha en formato grande */}
                              <div className="flex items-center justify-center gap-3 text-center mb-4">
                                <div className="bg-white rounded-xl px-5 py-3 shadow-sm border border-purple-100">
                                  <p className="text-xs text-purple-500 font-medium mb-1">DÍA</p>
                                  <p className="text-3xl font-bold text-slate-800">{day}</p>
                                </div>
                                <span className="text-slate-300 text-2xl">/</span>
                                <div className="bg-white rounded-xl px-5 py-3 shadow-sm border border-purple-100">
                                  <p className="text-xs text-purple-500 font-medium mb-1">MES</p>
                                  <p className="text-xl font-bold text-slate-800">{month}</p>
                                </div>
                                <span className="text-slate-300 text-2xl">/</span>
                                <div className="bg-white rounded-xl px-5 py-3 shadow-sm border border-purple-100">
                                  <p className="text-xs text-purple-500 font-medium mb-1">AÑO</p>
                                  <p className="text-2xl font-bold text-slate-800">{year}</p>
                                </div>
                              </div>

                              {/* Género */}
                              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-purple-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">👤</span>
                                  <span className="text-sm text-purple-500 font-medium">Tu Género:</span>
                                </div>
                                <span className="text-lg font-bold text-slate-800">{authenticatedStudent.gender}</span>
                              </div>

                              {/* Instrucción */}
                              <div className="mt-4 bg-purple-100 rounded-lg p-3 text-center">
                                <p className="text-xs text-purple-700 font-medium">
                                  📱 Abre Google y <strong>ESCRIBE</strong> estos datos en los campos correspondientes
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Info Card - Resumen Inferior Refinado */}
                        <div className="bg-[#f8f9fa] rounded-lg p-4 mt-8 border border-slate-100">
                          <p className="text-xs text-slate-500 mb-3 font-medium">Datos del estudiante:</p>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex gap-2">
                              <span className="text-slate-500">ID:</span>
                              <span className="font-medium text-[#202124]">{authenticatedStudent.id}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-slate-500">Institución:</span>
                              <span className="font-bold text-[#202124]">
                                {authenticatedStudent.institution.includes('IETAC') ? 'IETAC' : 'SG'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => setStudentStep('guide-1-name')}
                            className="text-[#1a73e8] font-medium text-sm px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors active:scale-[0.98]"
                          >
                            Atrás
                          </button>
                          <button
                            onClick={async () => {
                              await handleStepAdvance('guide-2-basic', 'guide-3-email');
                            }}
                            className="bg-[#1a73e8] text-white font-medium text-sm px-8 py-2.5 rounded-full shadow-sm hover:bg-[#1557b0] hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Email */}
                    {studentStep === 'guide-3-email' && (
                      <div className="space-y-6 animate-fadeIn">

                        {/* 🚀 MODAL PROFESIONAL - ESTILO ELEGANTE */}
                        {showEmailWarningModal && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 animate-scaleIn">
                              {/* Header */}
                              <div className="text-center mb-4">
                                <div className="inline-block bg-amber-500/20 rounded-full p-4 mb-3">
                                  <span className="text-4xl">⚠️</span>
                                </div>
                                <h3 className="text-xl font-bold text-white">¡IMPORTANTE!</h3>
                                <p className="text-amber-300 text-sm font-medium mt-1">Tu correo debe ser EXACTAMENTE así:</p>
                              </div>

                              {/* Email Display */}
                              <div className="bg-white/10 rounded-2xl p-4 mb-4 border-2 border-blue-400/50">
                                <p className="text-center break-all">
                                  <span className="text-white text-lg font-bold tracking-wide">{credentials.email}</span>
                                </p>
                                <p className="text-center text-blue-200 text-xs mt-3 font-medium">
                                  Copia o escribe este correo sin cambiar NADA
                                </p>
                              </div>

                              {/* Instructions */}
                              <div className="space-y-2 text-sm text-purple-200 mb-4">
                                <p className="flex items-center gap-2">
                                  <span className="text-green-400">✓</span>
                                  Cada letra y punto debe ser exacto
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-green-400">✓</span>
                                  No agregues ni quites caracteres
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-red-400">✗</span>
                                  Si hay errores, tu cuenta NO funcionará
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-blue-400">📱</span>
                                  Enviarás captura de pantalla por WhatsApp
                                </p>
                              </div>

                              {/* Progress Bar */}
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                                  style={{ width: `${((8 - emailWarningCountdown) / 8) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-center text-sm text-amber-300 font-medium">
                                {emailWarningCountdown > 0
                                  ? `Espera ${emailWarningCountdown} segundos para continuar...`
                                  : '¡Listo! Puedes continuar'
                                }
                              </p>

                              {/* Button */}
                              <button
                                onClick={() => {
                                  if (emailWarningCountdown === 0) {
                                    setShowEmailWarningModal(false);
                                  }
                                }}
                                disabled={emailWarningCountdown > 0}
                                className={`w-full mt-4 font-medium py-3 rounded-xl transition-all ${emailWarningCountdown > 0
                                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                                  }`}
                              >
                                {emailWarningCountdown > 0
                                  ? `Espera ${emailWarningCountdown}s...`
                                  : '✓ Entendido, escribiré el correo exacto'
                                }
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-base text-[#202124] font-medium px-1">Elige una dirección de Gmail</p>
                          <p className="text-sm text-[#5f6368] px-1 mb-4">Usa una dirección sugerida o crea una propia</p>


                          {/* Radio Options Container */}
                          <div className="flex flex-col gap-1">
                            {/* Fake Option 1 */}
                            <div className="flex items-center gap-4 px-2 py-3 rounded hover:bg-slate-50 select-none opacity-60">
                              <div className="w-5 h-5 rounded-full border-2 border-[#5f6368]"></div>
                              <span className="text-[#202124] font-medium text-base">
                                {authenticatedStudent.first.toLowerCase().split(' ')[0]}{authenticatedStudent.last.toLowerCase().split(' ')[0]}88@gmail.com
                              </span>
                            </div>

                            {/* Fake Option 2 */}
                            <div className="flex items-center gap-4 px-2 py-3 rounded hover:bg-slate-50 select-none opacity-60">
                              <div className="w-5 h-5 rounded-full border-2 border-[#5f6368]"></div>
                              <span className="text-[#202124] font-medium text-base">
                                {authenticatedStudent.last.toLowerCase().split(' ')[0]}.{authenticatedStudent.first.toLowerCase().split(' ')[0]}12@gmail.com
                              </span>
                            </div>

                            {/* Real Option 3 (Selected) */}
                            <div className="flex flex-col">
                              <div className="flex items-center gap-4 px-2 py-3 rounded bg-blue-50/50">
                                <div className="w-5 h-5 rounded-full border-2 border-[#1a73e8] flex items-center justify-center">
                                  <div className="w-2.5 h-2.5 bg-[#1a73e8] rounded-full"></div>
                                </div>
                                <span className="text-[#202124] font-medium text-base">Crear tu propia dirección de Gmail</span>
                              </div>

                              {/* Input Container - Indented */}
                              <div className="pl-11 mt-2 pr-2">
                                <div className="relative animate-pulse-border">
                                  <GoogleField
                                    label="Crear dirección de Gmail"
                                    value={credentials.username}
                                    suffix="@gmail.com"
                                    onCopy={() => copyToClipboard(credentials.username, 'user')}
                                  />
                                  {copiedField === 'user' && <div className="absolute -right-2 -top-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fadeIn">✓ Copiado</div>}
                                </div>
                                <p className="text-xs text-[#5f6368] mt-2 ml-1">
                                  Puedes usar letras, números y puntos
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Feedback Panel */}
                        <div className="bg-blue-50/80 rounded-lg p-4 mt-4 border border-blue-100/50">
                          <p className="text-xs text-[#1a73e8] font-medium mb-1">
                            Tu correo completo será:
                          </p>
                          <p className="text-base font-bold text-[#1f1f1f] break-all tracking-wide">
                            {credentials.email}
                          </p>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => setStudentStep('guide-2-basic')}
                            className="text-[#1a73e8] font-medium text-sm px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors active:scale-[0.98]"
                          >
                            Atrás
                          </button>
                          <button
                            onClick={async () => {
                              await handleStepAdvance('guide-3-email', 'guide-4-password');
                            }}
                            className="bg-[#1a73e8] text-white font-medium text-sm px-8 py-2.5 rounded-full shadow-sm hover:bg-[#1557b0] hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: Password */}
                    {studentStep === 'guide-4-password' && (
                      <div className="space-y-4 animate-fadeIn">

                        {/* 🚀 MODAL PROFESIONAL - CONTRASEÑA */}
                        {showPasswordWarningModal && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 animate-scaleIn">
                              {/* Header */}
                              <div className="text-center mb-4">
                                <div className="inline-block bg-amber-500/20 rounded-full p-4 mb-3">
                                  <span className="text-4xl">🔐</span>
                                </div>
                                <h3 className="text-xl font-bold text-white">¡CONTRASEÑA EXACTA!</h3>
                                <p className="text-amber-300 text-sm font-medium mt-1">Debes escribir esta contraseña:</p>
                              </div>

                              {/* Password Display */}
                              <div className="bg-white/10 rounded-2xl p-4 mb-4 border-2 border-emerald-400/50">
                                <p className="text-center">
                                  <span className="text-white text-2xl font-mono font-bold tracking-widest">{credentials.suggestedPassword}</span>
                                </p>
                                <p className="text-center text-emerald-200 text-xs mt-3 font-medium">
                                  Copia o escribe esta contraseña sin cambiar NADA
                                </p>
                              </div>

                              {/* Instructions */}
                              <div className="space-y-2 text-sm text-purple-200 mb-4">
                                <p className="flex items-center gap-2">
                                  <span className="text-green-400">✓</span>
                                  Mayúsculas y minúsculas importan
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-green-400">✓</span>
                                  Los números y puntos son exactos
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-red-400">✗</span>
                                  Si cambias algo, la cuenta NO funcionará
                                </p>
                                <p className="flex items-center gap-2">
                                  <span className="text-blue-400">💾</span>
                                  Guarda esta contraseña en lugar seguro
                                </p>
                              </div>

                              {/* Progress Bar */}
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                                  style={{ width: `${((6 - passwordWarningCountdown) / 6) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-center text-sm text-amber-300 font-medium">
                                {passwordWarningCountdown > 0
                                  ? `Espera ${passwordWarningCountdown} segundos para continuar...`
                                  : '¡Listo! Puedes continuar'
                                }
                              </p>

                              {/* Button */}
                              <button
                                onClick={() => {
                                  if (passwordWarningCountdown === 0) {
                                    setShowPasswordWarningModal(false);
                                  }
                                }}
                                disabled={passwordWarningCountdown > 0}
                                className={`w-full mt-4 font-medium py-3 rounded-xl transition-all ${passwordWarningCountdown > 0
                                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                                  }`}
                              >
                                {passwordWarningCountdown > 0
                                  ? `Espera ${passwordWarningCountdown}s...`
                                  : '✓ Entendido, usaré la contraseña exacta'
                                }
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-sm text-slate-600 text-center mb-4">Usa esta contraseña segura que generamos para ti</p>


                        <div className="relative">
                          <GoogleField
                            label="Contraseña"
                            value={credentials.suggestedPassword}
                            onCopy={() => copyToClipboard(credentials.suggestedPassword, 'pass')}
                          />
                          {copiedField === 'pass' && <div className="absolute -right-2 -top-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-fadeIn">✓ Copiado</div>}
                        </div>

                        <GoogleField
                          label="Confirmar"
                          value={credentials.suggestedPassword}
                          onCopy={() => copyToClipboard(credentials.suggestedPassword, 'pass2')}
                        />

                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                          <p className="text-xs text-green-800 flex items-center gap-2">
                            <span className="text-lg">🔐</span>
                            <span><strong>Importante:</strong> Guarda esta contraseña en un lugar seguro</span>
                          </p>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-slate-100 rounded-xl p-4 mt-4">
                          <p className="text-xs font-bold text-slate-700 mb-3">📋 Resumen de tu cuenta:</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Correo:</span>
                              <span className="font-medium text-slate-800">{credentials.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Contraseña:</span>
                              <span className="font-mono font-medium text-slate-800">{credentials.suggestedPassword}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Nombre:</span>
                              <span className="font-medium text-slate-800">{authenticatedStudent.first} {authenticatedStudent.last}</span>
                            </div>
                          </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => setStudentStep('guide-3-email')}
                            className="text-[#1a73e8] font-medium text-sm px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors active:scale-[0.98]"
                          >
                            Atrás
                          </button>
                          <button
                            onClick={async () => {
                              await handleStepAdvance('guide-4-password', 'confirmation-final');
                            }}
                            className="bg-[#1a73e8] text-white font-medium text-sm px-8 py-2.5 rounded-full shadow-sm hover:bg-[#1557b0] hover:shadow-md transition-all active:scale-[0.98]"
                          >
                            Finalizar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Security Warning Banner - Integrado (no fixed) */}
                {securityWarning && (
                  <div className="absolute top-20 left-0 right-0 px-4 z-[60] animate-slideUp">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-md flex items-center gap-3 max-w-md mx-auto">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <p className="font-medium text-sm">¡Advertencia!</p>
                        <p className="text-xs opacity-80">{securityWarning}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODAL DE CUENTA BLOQUEADA */}
                {blockedModal && (
                  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-red-900 via-red-800 to-red-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-red-500/50 animate-scaleIn">
                      {/* Header */}
                      <div className="text-center mb-5">
                        <div className="inline-block bg-red-500/30 rounded-full p-5 mb-4">
                          <svg className="w-12 h-12 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">🚫 CUENTA INHABILITADA</h2>
                        <p className="text-red-200 text-sm">{blockedModal.studentName}</p>
                      </div>

                      {/* Razón */}
                      <div className="bg-black/30 rounded-xl p-4 mb-5 border border-red-500/30">
                        <p className="text-red-300 text-xs font-medium mb-2">📋 Razón del bloqueo:</p>
                        <p className="text-white text-sm leading-relaxed">{blockedModal.reason}</p>
                      </div>

                      {/* Qué hacer */}
                      <div className="bg-white/10 rounded-xl p-4 mb-5">
                        <p className="text-white font-medium text-sm mb-3">¿Qué debo hacer?</p>
                        <ul className="space-y-2 text-sm text-red-100">
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400">1.</span>
                            Contacta al administrador de tu institución
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400">2.</span>
                            Explica tu situación y solicita la rehabilitación
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400">3.</span>
                            Una vez habilitado, podrás volver a intentar el proceso
                          </li>
                        </ul>
                      </div>

                      {/* Aviso */}
                      <div className="bg-amber-500/20 rounded-lg p-3 mb-5 border border-amber-500/30">
                        <p className="text-amber-200 text-xs text-center">
                          ⚠️ Esta infracción ha sido registrada y el administrador puede ver los detalles.
                        </p>
                      </div>

                      {/* Botón cerrar */}
                      <button
                        onClick={() => {
                          setBlockedModal(null);
                          handleLogout(); // Force immediate logout
                        }}
                        className="w-full bg-white text-red-600 font-bold py-4 rounded-xl hover:bg-red-100 transition-colors"
                      >
                        Entendido, cerrar sesión
                      </button>
                    </div>
                  </div>
                )}

                {/* MODAL DE DESCARGA DE CREDENCIALES */}
                {downloadModal && (
                  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-500/50 animate-scaleIn">
                      {/* Header */}
                      <div className="text-center mb-5">
                        <div className="inline-block bg-emerald-500/30 rounded-full p-5 mb-4">
                          {downloadModal.downloading ? (
                            <svg className="w-12 h-12 text-emerald-300 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          ) : (
                            <svg className="w-12 h-12 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1">
                          {downloadModal.downloading ? '¡Copiado!' : '📋 Copia tus datos'}
                        </h2>
                        <p className="text-emerald-200 text-sm">
                          {downloadModal.downloading
                            ? 'Credenciales en portapapeles'
                            : 'Guarda esta información muy bien'}
                        </p>
                      </div>

                      {/* Explicación */}
                      {!downloadModal.downloading && (
                        <div className="bg-white/10 rounded-xl p-4 mb-5 border border-emerald-500/30">
                          <p className="text-white text-sm leading-relaxed">
                            Vamos a copiar tus credenciales al portapapeles para que las uses ahora mismo:
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-emerald-100">
                            <li className="flex items-center gap-2">
                              <span className="text-emerald-400">📧</span>
                              Tu correo institucional
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-emerald-400">🔐</span>
                              Tu contraseña temporal
                            </li>
                          </ul>
                        </div>
                      )}

                      {/* Success indicator */}
                      {downloadModal.downloading && (
                        <div className="bg-emerald-500/20 rounded-xl p-4 mb-5 border border-emerald-500/30">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-lg">✓</span>
                            </div>
                            <p className="text-white font-bold">¡Listo para pegar!</p>
                          </div>
                        </div>
                      )}

                      {/* Aviso */}
                      <div className="bg-amber-500/20 rounded-lg p-3 border border-amber-500/30 text-center">
                        <p className="text-amber-200 text-xs">
                          ⚠️ Pega esto en Notas o envíatelo por WhatsApp para no perderlo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Toast Modal Flotante */}
                {toastData && (
                  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] animate-slideUp">
                    <div className="bg-slate-900/95 backdrop-blur-sm text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 max-w-sm">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <span className="text-2xl">{toastData.emoji}</span>
                      </div>
                      <div>
                        <p className="font-bold text-green-400 text-sm">{toastData.message}</p>
                        <p className="text-xs text-slate-300 mt-0.5">{toastData.instruction}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de Confirmación de Nombre - 10 segundos */}
                {nameConfirmModal && (
                  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/20 animate-scaleIn">
                      {/* Header con icono */}
                      <div className="text-center mb-4">
                        <div className="inline-block bg-amber-500/20 rounded-full p-4 mb-3">
                          <span className="text-4xl">⚠️</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">¡IMPORTANTE!</h3>
                        <p className="text-amber-300 text-sm font-medium mt-1">Pega el nombre EXACTAMENTE así:</p>
                      </div>

                      {/* Nombre con formato */}
                      <div className="bg-white/10 rounded-2xl p-4 mb-4 border-2 border-amber-400/50">
                        <p className="text-center">
                          <span className={`text-lg font-bold px-3 py-1 rounded-full ${nameConfirmModal.institution === 'IETAC'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-emerald-500 text-white'
                            }`}>
                            {nameConfirmModal.institution}
                          </span>
                          <span className="text-white text-2xl font-bold mx-2">-</span>
                          <span className="text-white text-2xl font-bold">
                            {nameConfirmModal.fullName.split(' - ')[1]}
                          </span>
                        </p>
                        <p className="text-center text-amber-200 text-sm mt-3 font-medium">
                          &quot;{nameConfirmModal.fullName}&quot;
                        </p>
                      </div>

                      {/* Instrucciones */}
                      <div className="space-y-2 text-sm text-purple-200 mb-4">
                        <p className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          Incluye la etiqueta de institución
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          El guión ( - ) debe estar incluido
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          Todo en MAYÚSCULAS
                        </p>
                      </div>

                      {/* Barra de progreso con countdown */}
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                          style={{ width: `${(nameModalCountdown / 10) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-center text-sm text-amber-300 font-medium">
                        {nameModalCountdown > 0
                          ? `Espera ${nameModalCountdown} segundos para continuar...`
                          : '¡Ahora puedes continuar!'}
                      </p>

                      {/* Botón para cerrar - bloqueado hasta countdown = 0 */}
                      <button
                        onClick={() => {
                          if (nameModalCountdown === 0) {
                            setNameConfirmModal(null);
                          }
                        }}
                        disabled={nameModalCountdown > 0}
                        className={`w-full mt-4 font-medium py-3 rounded-xl transition-all ${nameModalCountdown > 0
                          ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                          }`}
                      >
                        {nameModalCountdown > 0
                          ? `Espera ${nameModalCountdown}s...`
                          : '✓ Entendido, ya lo pegué'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. Final Confirmation - DISEÑO LIMPIO V3 */}
            {studentStep === 'confirmation-final' && (
              <div className="animate-slideUp">

                {/* ============================================ */}
                {/* ESTADO: PENDIENTE DE VERIFICACIÓN */}
                {/* ============================================ */}
                {!googleVerified && (
                  <div className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-3xl border border-white/10 p-6 space-y-6">

                    {/* Header con ícono grande */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl mb-5 border border-white/20 shadow-2xl">
                        <svg className="w-14 h-14" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">Último Paso</h2>
                      <p className="text-purple-200/70 text-sm max-w-xs mx-auto">
                        Confirma que creaste tu cuenta correctamente iniciando sesión con Google
                      </p>
                    </div>

                    {/* Tarjeta de Email a verificar */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-purple-300/70 text-xs mb-1">Tu correo institucional:</p>
                      <p className="text-white font-mono font-bold text-lg break-all">{credentials?.email}</p>
                    </div>

                    {/* Instrucción simple */}
                    <div className="flex items-start gap-3 bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                      <span className="text-2xl mt-0.5">💡</span>
                      <div>
                        <p className="text-blue-100 text-sm">
                          <strong className="text-blue-300">Al hacer clic</strong>, se abrirá Google.
                          Ingresa con el correo de arriba para verificar que lo creaste bien.
                        </p>
                      </div>
                    </div>

                    {/* Botón Principal GRANDE */}
                    <button
                      onClick={handleIntelligentVerification}
                      disabled={isVerifyingIntelligent}
                      className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-4 transition-all ${isVerifyingIntelligent
                        ? 'bg-slate-700 text-slate-400 cursor-wait'
                        : 'bg-white text-slate-800 hover:bg-slate-100 shadow-xl hover:shadow-2xl active:scale-[0.98]'
                        }`}
                    >
                      {isVerifyingIntelligent ? (
                        <>
                          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span>Abriendo Google...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-7 h-7" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          <span>Verificar con Google</span>
                        </>
                      )}
                    </button>

                    {/* Links de ayuda */}
                    <div className="flex items-center justify-center gap-6 pt-2">
                      <button
                        onClick={() => setShowCredentialsModal(true)}
                        className="text-purple-300/70 hover:text-white text-xs transition-colors flex items-center gap-1.5"
                      >
                        🔑 Ver credenciales
                      </button>
                      <button
                        onClick={() => setStudentStep('guide-4-password')}
                        className="text-purple-300/70 hover:text-white text-xs transition-colors flex items-center gap-1.5"
                      >
                        ← Volver atrás
                      </button>
                    </div>
                  </div>
                )}

                {/* ============================================ */}
                {/* ESTADO: VERIFICADO CON ÉXITO */}
                {/* ============================================ */}
                {googleVerified && (
                  <div className="space-y-6 animate-fadeIn">

                    {/* Banner de Éxito */}
                    <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-3xl border border-green-500/30 p-6 text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4 border-2 border-green-400/50">
                        <Check className="w-10 h-10 text-green-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-green-400 mb-1">¡Verificación Exitosa!</h2>
                      <p className="text-green-200/80 text-sm">Tu cuenta ha sido confirmada</p>

                      {/* Email verificado */}
                      <div className="mt-5 bg-green-500/10 rounded-xl p-4 border border-green-500/20 inline-block">
                        <p className="text-green-300/70 text-xs mb-1">Correo verificado:</p>
                        <p className="text-white font-mono font-medium">{credentials?.email}</p>
                      </div>
                    </div>

                    {/* Próximos pasos - Cards */}
                    <div className="space-y-3">
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wider px-1">Próximos pasos</p>

                      {/* 1. WhatsApp */}
                      <a
                        href={`https://wa.me/573008871908?text=✅ Cuenta verificada%0A%0A👤 ${encodeURIComponent((authenticatedStudent?.first || '') + ' ' + (authenticatedStudent?.last || ''))}%0A📧 ${encodeURIComponent(credentials?.email || '')}%0A🆔 ${authenticatedStudent?.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 bg-gradient-to-r from-green-600 to-green-500 text-white p-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-green-600/30"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">Confirmar por WhatsApp</p>
                          <p className="text-green-100/70 text-xs">Envía tu confirmación ahora</p>
                        </div>
                        <span className="text-2xl">→</span>
                      </a>

                      {/* 2. Descargar */}
                      <button
                        onClick={downloadCredentialsWithNotification}
                        className="flex items-center gap-4 bg-purple-600/80 hover:bg-purple-600 text-white p-4 rounded-2xl transition-all active:scale-[0.98] w-full"
                      >
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                          <span className="text-2xl">📥</span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-bold">Guardar Credenciales</p>
                          <p className="text-purple-100/70 text-xs">Descarga tu tarjeta de acceso</p>
                        </div>
                        <span className="text-2xl">→</span>
                      </button>
                    </div>

                    {/* Botón salir */}
                    <button
                      onClick={handleLogout}
                      className="w-full py-3.5 text-purple-300 hover:text-white text-sm transition-colors border border-white/10 hover:border-white/20 rounded-xl"
                    >
                      ✓ Finalizar y cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Minimalista */}
      <footer className="relative z-10 py-3 shrink-0">
        <p className="text-center text-slate-500 text-[11px]">
          SeamosGenios © 2025
        </p>
      </footer>

      {/* 🔔 Modal de Solicitud de Notificaciones */}
      {showNotificationPrompt && authenticatedStudent && (
        <NotificationPromptModal
          userId={authenticatedStudent.id}
          userName={authenticatedStudent.first.split(' ')[0]}
          role="student"
          onClose={() => setShowNotificationPrompt(false)}
        />
      )}
    </div>
  );
}

// Spotlight Tutorial Modal - Modales de introducción por paso
function SpotlightModal({
  step,
  isVisible,
  onClose
}: {
  step: StudentStep;
  isVisible: boolean;
  onClose: () => void;
}) {
  if (!isVisible) return null;

  const stepData: Record<string, { title: string; description: string; emoji: string; tips: string[]; color: string }> = {
    'guide-1-name': {
      title: 'Paso 1: Tu Nombre',
      description: 'Aquí copiarás tu nombre y apellidos para pegarlos en Google.',
      emoji: '👤',
      tips: [
        'Toca el campo de Nombre - se copiará automáticamente',
        'Ve a la app de Google y pégalo (mantén presionado)',
        'Regresa y haz lo mismo con Apellidos',
      ],
      color: 'blue'
    },
    'guide-2-basic': {
      title: 'Paso 2: Tu Información',
      description: 'ESCRIBE tu fecha de nacimiento y género directamente en Google.',
      emoji: '✍️',
      tips: [
        'Mira tu fecha aquí abajo y ESCRÍBELA en Google',
        'Selecciona tu día, mes y año en los dropdowns',
        'NO copies - es más fácil escribirlo tú mismo',
        'Finalmente, selecciona tu género',
      ],
      color: 'purple'
    },
    'guide-3-email': {
      title: 'Paso 3: Tu Correo Gmail',
      description: '¡Este es el paso más importante! Debes crear TU correo.',
      emoji: '✉️',
      tips: [
        'Google te sugerirá correos raros - IGNÓRALOS',
        'Selecciona "Crear tu propia dirección"',
        'Copia el usuario que te damos y pégalo',
      ],
      color: 'amber'
    },
    'guide-4-password': {
      title: 'Paso 4: Contraseña Segura',
      description: 'Usa la contraseña que generamos para ti.',
      emoji: '🔒',
      tips: [
        'Copia la contraseña',
        'Pégala en AMBOS campos de Google',
        'Guarda esta contraseña - ¡la necesitarás!',
      ],
      color: 'red'
    }
  };

  const data = stepData[step];
  if (!data) return null;

  const colorClasses = {
    blue: { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-500' },
    purple: { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-500' },
    amber: { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-500' },
    red: { bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-600', border: 'border-red-500' },
  };
  const colors = colorClasses[data.color as keyof typeof colorClasses];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-slideUp">
        {/* Header con color */}
        <div className={`${colors.bg} p-6 text-white text-center`}>
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3 animate-bounce">
            <span className="text-4xl">{data.emoji}</span>
          </div>
          <h2 className="text-xl font-bold">{data.title}</h2>
          <p className="text-sm text-white/80 mt-1">{data.description}</p>
        </div>

        {/* Tips */}
        <div className="p-5">
          <h3 className={`text-sm font-bold ${colors.text} mb-3 flex items-center gap-2`}>
            <span>💡</span> Cómo hacerlo:
          </h3>
          <ul className="space-y-2">
            {data.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                <span className={`w-6 h-6 ${colors.light} ${colors.text} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
                  {idx + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Botón de acción */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className={`w-full ${colors.bg} text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-[0.98]`}
          >
            ¡Entendido, empezar! →
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Component for Step Tutorials - ACUMULATIVO
function StepTutorial({ step }: { step: StudentStep }) {
  const steps = [
    { id: 'guide-1-name', label: 'Nombre', emoji: '📋', hint: 'Copia nombre y apellidos' },
    { id: 'guide-2-basic', label: 'Fecha', emoji: '✍️', hint: 'ESCRIBE tu fecha y género' },
    { id: 'guide-3-email', label: 'Correo', emoji: '✉️', hint: 'Crea tu dirección Gmail' },
    { id: 'guide-4-password', label: 'Contraseña', emoji: '🔒', hint: 'Copia la contraseña segura' },
  ];

  const currentIdx = steps.findIndex(s => s.id === step);
  const currentStep = steps[currentIdx];

  if (currentIdx === -1) return null;

  return (
    <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-slate-100 animate-fadeIn">
      {/* Progress Bar Compacto */}
      <div className="flex items-center justify-between mb-4">
        {steps.map((s, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div key={s.id} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${isComplete ? 'bg-green-500 text-white scale-90' : ''}
                ${isCurrent ? 'bg-[#1a73e8] text-white scale-110 ring-4 ring-blue-100 animate-pulse' : ''}
                ${isPending ? 'bg-slate-100 text-slate-400' : ''}
              `}>
                {isComplete ? '✓' : s.emoji}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-6 sm:w-10 h-1 mx-1 rounded transition-colors ${isComplete ? 'bg-green-500' : 'bg-slate-200'
                  }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Instrucción Actual Destacada */}
      <div className="bg-blue-50/80 rounded-lg p-3 border-l-4 border-[#1a73e8]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentStep?.emoji}</span>
          <div>
            <h3 className="font-bold text-[#1a73e8] text-sm">
              Paso {currentIdx + 1}: {currentStep?.label}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentStep?.hint}
            </p>
          </div>
        </div>
      </div>

      {/* Lista Resumen Acumulativo */}
      <div className="mt-3 space-y-1.5">
        {steps.map((s, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          if (idx > currentIdx) return null;

          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${isCurrent ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'
                }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isComplete ? 'bg-green-500 text-white' : 'bg-[#1a73e8] text-white'
                }`}>
                {isComplete ? '✓' : idx + 1}
              </span>
              <span className={isComplete ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>
                {s.label}
              </span>
              {isComplete && <span className="text-green-600 ml-auto text-[10px]">Completado</span>}
              {isCurrent && <span className="text-blue-600 ml-auto font-bold animate-pulse">← Ahora</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper Component for Select Fields - Google Material Design Style
function GoogleSelect({
  label,
  value,
  onCopy
}: {
  label: string,
  value: string,
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setShowHint(false);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative group cursor-pointer font-['Roboto',sans-serif] w-full"
      onClick={handleCopy}
      style={{ fontFamily: "'Roboto', 'Arial', sans-serif" }}
    >
      {/* Burbuja Flotante - "Toca para copiar" (visible en móviles) */}
      {showHint && !copied && (
        <div className="absolute -right-1 -top-3 z-20 animate-bounce">
          <div className="bg-[#1a73e8] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
            Toca aquí
          </div>
        </div>
      )}

      {/* Floating Label */}
      <div className="absolute -top-2.5 left-3 bg-white px-1 z-10">
        <span className={`text-xs font-medium transition-colors ${copied ? 'text-green-600' : 'text-[#1a73e8]'
          }`}>
          {label}
        </span>
      </div>

      {/* Outlined Select Field */}
      <div className={`w-full border rounded h-[56px] flex items-center justify-between px-3 transition-all ${copied
        ? 'border-green-500 bg-green-50'
        : 'border-[#dadce0] hover:border-[#202124]'
        }`}>

        {/* Value */}
        <div className={`text-base font-normal truncate ${copied ? 'text-green-700' : 'text-[#202124]'
          }`}>
          {value}
        </div>

        {/* Chevron Icon & Copy Feedback */}
        <div className="flex items-center gap-2">
          {copied ? (
            <span className="text-xs font-bold text-green-600 uppercase tracking-wide">✓</span>
          ) : (
            <span className="text-xs font-medium text-[#1a73e8] uppercase opacity-50 md:opacity-0 md:group-hover:opacity-100">Copiar</span>
          )}
        </div>
      </div>

      {/* Click Ripple */}
      <div className={`absolute inset-0 rounded pointer-events-none transition-opacity ${copied ? 'bg-green-500/10 opacity-100' : 'bg-black/5 opacity-0 group-active:opacity-100'
        }`}></div>
    </div>
  );
}

// Helper Components with Material Design - Google Style
function GoogleField({
  label,
  value,
  suffix,
  onCopy,
  institutionTag
}: {
  label: string,
  value: string,
  suffix?: string,
  onCopy: () => void,
  institutionTag?: string
}) {
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setShowHint(false); // Ocultar hint después del primer clic
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative group cursor-pointer font-['Roboto',sans-serif]"
      onClick={handleCopy}
      style={{ fontFamily: "'Roboto', 'Arial', sans-serif" }}
    >
      {/* Burbuja Flotante - "Toca para copiar" (visible en móviles) */}
      {showHint && !copied && (
        <div className="absolute -right-1 -top-3 z-20 animate-bounce md:hidden">
          <div className="bg-[#1a73e8] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
            Toca aquí
          </div>
        </div>
      )}

      {/* Floating Label - Material Design Style */}
      <div className="absolute -top-2.5 left-3 bg-white px-1 z-10">
        <span className={`text-xs font-medium transition-colors ${copied ? 'text-green-600' : 'text-[#1a73e8]'
          }`}>
          {label}
        </span>
      </div>

      {/* Outlined Text Field - Material Design */}
      <div className={`w-full border rounded transition-all flex items-center ${copied
        ? 'border-green-500 bg-green-50'
        : 'border-[#dadce0] hover:border-[#1a73e8] focus-within:border-[#1a73e8] focus-within:border-2'
        }`}>

        {/* Start Adornment - Etiqueta Institucional */}
        {institutionTag && (
          <div className="flex items-center pl-3 pr-2 border-r border-[#dadce0] bg-slate-50 self-stretch">
            <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">
              {institutionTag}
            </span>
          </div>
        )}

        {/* Field Value */}
        <div className={`flex-1 px-3 py-3.5 text-[#202124] text-base font-normal truncate ${copied ? 'text-green-700' : ''
          }`}>
          {value}
          {suffix && <span className="text-[#5f6368]">{suffix}</span>}
        </div>

        {/* Copy Indicator */}
        <div className={`pr-3 transition-all ${copied ? 'opacity-100' : 'opacity-50 md:opacity-0 md:group-hover:opacity-100'
          }`}>
          <span className={`text-xs font-medium uppercase tracking-wide ${copied ? 'text-green-600' : 'text-[#1a73e8]'
            }`}>
            {copied ? '✓' : 'Copiar'}
          </span>
        </div>
      </div>

      {/* Click Ripple Effect */}
      <div className={`absolute inset-0 rounded pointer-events-none transition-opacity ${copied ? 'bg-green-500/10 opacity-100' : 'bg-[#1a73e8]/5 opacity-0 group-active:opacity-100'
        }`}></div>
    </div>
  );
}
