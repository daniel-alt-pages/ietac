"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
    ActivityEvent, 
    StudentDocument,
    getStudentTimeline,
    subscribeToActivityEvents,
    getStudentById
} from '@/lib/firebase';

interface StudentActivityProfileProps {
    student: StudentDocument;
    onClose: () => void;
    onVerifyManually?: (studentId: string) => void;
}

const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    'login': { icon: '🔐', label: 'Inicio de Sesión', color: 'text-blue-600', bg: 'bg-blue-100' },
    'login_failed': { icon: '❌', label: 'Login Fallido', color: 'text-red-600', bg: 'bg-red-100' },
    'confirmation': { icon: '✅', label: 'Confirmación', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    'view_credentials': { icon: '👁️', label: 'Ver Credenciales', color: 'text-purple-600', bg: 'bg-purple-100' },
    'copy_email': { icon: '📧', label: 'Copió Email', color: 'text-cyan-600', bg: 'bg-cyan-100' },
    'copy_password': { icon: '🔑', label: 'Copió Contraseña', color: 'text-amber-600', bg: 'bg-amber-100' },
    'google_verify': { icon: '✓', label: 'Verificación OK', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    'google_intruso': { icon: '⛔', label: 'INTRUSO', color: 'text-red-600', bg: 'bg-red-100' },
    'google_error': { icon: '⚠️', label: 'Error Google', color: 'text-orange-600', bg: 'bg-orange-100' },
    'page_view': { icon: '📄', label: 'Vista Página', color: 'text-slate-600', bg: 'bg-slate-100' }
};

export default function StudentActivityProfile({ student, onClose, onVerifyManually }: StudentActivityProfileProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resumen' | 'timeline' | 'sesiones'>('resumen');
    const [studentData, setStudentData] = useState<StudentDocument>(student);

    // Load fresh student data and events
    useEffect(() => {
        const loadData = async () => {
            // Get fresh student data from Firestore
            const freshData = await getStudentById(student.studentId);
            if (freshData) setStudentData(freshData);
        };
        loadData();

        const unsubscribe = subscribeToActivityEvents((allEvents) => {
            const studentEvents = getStudentTimeline(allEvents, student.studentId);
            setEvents(studentEvents);
            setLoading(false);
        }, 500);

        return () => unsubscribe();
    }, [student.studentId]);

    // Analytics computed from events
    const analytics = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Login analysis
        const logins = events.filter(e => e.type === 'login');
        const loginsToday = logins.filter(e => new Date(e.timestamp) >= today).length;
        const loginsThisWeek = logins.filter(e => new Date(e.timestamp) >= weekAgo).length;
        const firstLogin = logins.length > 0 ? logins[logins.length - 1].timestamp : null;
        const lastLogin = logins.length > 0 ? logins[0].timestamp : null;
        
        // Unique days active
        const uniqueDays = new Set(events.map(e => 
            new Date(e.timestamp).toDateString()
        )).size;

        // Action counts
        const copyEmail = events.filter(e => e.type === 'copy_email').length;
        const copyPassword = events.filter(e => e.type === 'copy_password').length;
        const viewCredentials = events.filter(e => e.type === 'view_credentials').length;
        const confirmations = events.filter(e => e.type === 'confirmation').length;
        const intrusoAttempts = events.filter(e => e.type === 'google_intruso').length;
        const googleVerify = events.filter(e => e.type === 'google_verify').length;

        // Sessions analysis (group logins by day)
        const sessionsByDay: Record<string, number> = {};
        logins.forEach(e => {
            const day = new Date(e.timestamp).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
            sessionsByDay[day] = (sessionsByDay[day] || 0) + 1;
        });

        // Activity by hour
        const activityByHour: number[] = new Array(24).fill(0);
        events.forEach(e => {
            const hour = new Date(e.timestamp).getHours();
            activityByHour[hour]++;
        });
        const peakHour = activityByHour.indexOf(Math.max(...activityByHour));

        // Event type breakdown
        const eventBreakdown: Record<string, number> = {};
        events.forEach(e => {
            eventBreakdown[e.type] = (eventBreakdown[e.type] || 0) + 1;
        });

        return {
            totalEvents: events.length,
            totalLogins: logins.length,
            loginsToday,
            loginsThisWeek,
            firstLogin,
            lastLogin,
            uniqueDays,
            copyEmail,
            copyPassword,
            viewCredentials,
            confirmations,
            intrusoAttempts,
            googleVerify,
            sessionsByDay,
            activityByHour,
            peakHour,
            eventBreakdown
        };
    }, [events]);

    // Get assigned and verified emails
    const assignedEmail = useMemo(() => {
        const email = studentData.email || studentData.emailNormalized || studentData.assignedEmail || '';
        return email ? (email.includes('@') ? email : `${email}@gmail.com`) : 'Sin asignar';
    }, [studentData]);

    const verifiedEmail = studentData.verifiedWithEmail || studentData.googleEmail || null;
    const isVerified = studentData.verificationStatus === 'VERIFIED';
    const emailsMatch = verifiedEmail ? assignedEmail.toLowerCase() === verifiedEmail.toLowerCase() : null;

    // Format helpers
    function formatDate(dateStr: string | null): string {
        if (!dateStr) return 'Nunca';
        try {
            return new Date(dateStr).toLocaleString('es-CO', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return dateStr; }
    }

    function formatRelative(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Ahora';
            if (diffMins < 60) return `${diffMins}m`;
            if (diffHours < 24) return `${diffHours}h`;
            if (diffDays < 7) return `${diffDays}d`;
            return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        } catch { return '---'; }
    }

    // Student name and initials
    const fullName = `${studentData.first || studentData.firstName || ''} ${studentData.last || studentData.lastName || ''}`.trim() || studentData.studentId;
    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    // Send WhatsApp reminder
    const sendWhatsAppReminder = () => {
        if (studentData.phone) {
            const phone = studentData.phone.replace(/\D/g, '');
            const message = encodeURIComponent(
                `Hola ${studentData.first || 'estudiante'}, te recordamos completar tu verificación de cuenta en SeamosGenios. Ingresa a la plataforma y verifica con el correo asignado: ${assignedEmail}`
            );
            window.open(`https://wa.me/57${phone}?text=${message}`, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
                
                {/* Header with Student Info */}
                <div className="shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${
                                analytics.intrusoAttempts > 0 
                                    ? 'bg-gradient-to-br from-red-500 to-red-700' 
                                    : isVerified 
                                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                        : 'bg-gradient-to-br from-amber-500 to-orange-600'
                            }`}>
                                {initials}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">{fullName}</h1>
                                <p className="text-slate-300 text-sm">
                                    {studentData.institution} • ID: {studentData.studentId}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        analytics.intrusoAttempts > 0 
                                            ? 'bg-red-500/30 text-red-200' 
                                            : isVerified 
                                                ? 'bg-emerald-500/30 text-emerald-200'
                                                : 'bg-amber-500/30 text-amber-200'
                                    }`}>
                                        {analytics.intrusoAttempts > 0 ? '⚠️ Alerta' : isVerified ? '✓ Verificado' : '⏳ Pendiente'}
                                    </span>
                                    {studentData.phone && (
                                        <span className="text-slate-400 text-xs">📱 {studentData.phone}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Email Verification Status */}
                <div className="shrink-0 px-6 py-4 bg-slate-50 border-b grid md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 border">
                        <p className="text-xs text-slate-500 mb-1">📧 Email Asignado</p>
                        <p className="font-mono text-sm text-slate-800 break-all">{assignedEmail}</p>
                    </div>
                    <div className={`rounded-xl p-4 border ${verifiedEmail ? (emailsMatch ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200') : 'bg-white'}`}>
                        <p className="text-xs text-slate-500 mb-1">🔐 Email Usado (Google)</p>
                        {verifiedEmail ? (
                            <p className={`font-mono text-sm break-all ${emailsMatch ? 'text-emerald-700' : 'text-red-700 font-bold'}`}>
                                {verifiedEmail}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Sin verificar aún</p>
                        )}
                    </div>
                    <div className={`rounded-xl p-4 border text-center ${
                        verifiedEmail 
                            ? (emailsMatch ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')
                            : 'bg-amber-100 border-amber-200'
                    }`}>
                        <p className="text-xs opacity-80 mb-1">Estado</p>
                        <p className="font-bold text-lg">
                            {verifiedEmail 
                                ? (emailsMatch ? '✓ COINCIDE' : '✕ NO COINCIDE')
                                : '⏳ PENDIENTE'
                            }
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="shrink-0 px-6 border-b flex gap-1">
                    {(['resumen', 'timeline', 'sesiones'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                                activeTab === tab 
                                    ? 'border-blue-500 text-blue-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab === 'resumen' && '📊 Resumen'}
                            {tab === 'timeline' && '📋 Timeline'}
                            {tab === 'sesiones' && '📈 Análisis'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : activeTab === 'resumen' ? (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Quick Stats */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-sm">📊</span>
                                    Estadísticas de Actividad
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-blue-600">{analytics.totalLogins}</p>
                                        <p className="text-xs text-blue-800">Inicios de sesión</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-purple-600">{analytics.uniqueDays}</p>
                                        <p className="text-xs text-purple-800">Días activos</p>
                                    </div>
                                    <div className="bg-cyan-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-cyan-600">{analytics.copyEmail}</p>
                                        <p className="text-xs text-cyan-800">Copias de email</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-amber-600">{analytics.copyPassword}</p>
                                        <p className="text-xs text-amber-800">Copias de contraseña</p>
                                    </div>
                                </div>

                                {analytics.intrusoAttempts > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-2xl text-white">⛔</div>
                                            <div>
                                                <p className="font-bold text-red-700">{analytics.intrusoAttempts} Intento(s) de Intruso</p>
                                                <p className="text-xs text-red-600">Usó un correo NO autorizado</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Timeline Preview */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-emerald-100 rounded flex items-center justify-center text-sm">🕐</span>
                                    Actividad Reciente
                                </h3>
                                {events.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <p className="text-4xl mb-2">📭</p>
                                        <p>Sin actividad registrada</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                        {events.slice(0, 8).map((event, i) => {
                                            const config = EVENT_CONFIG[event.type] || { icon: '📝', label: event.type, color: 'text-slate-600', bg: 'bg-slate-100' };
                                            return (
                                                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${config.bg}`}>
                                                    <span className="text-lg">{config.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                                                    </div>
                                                    <span className="text-xs text-slate-500">{formatRelative(event.timestamp)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* First/Last Activity */}
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div className="bg-slate-100 rounded-xl p-4">
                                    <p className="text-xs text-slate-500 mb-1">📅 Primer Acceso</p>
                                    <p className="font-medium text-slate-800">{formatDate(analytics.firstLogin)}</p>
                                </div>
                                <div className="bg-slate-100 rounded-xl p-4">
                                    <p className="text-xs text-slate-500 mb-1">🕐 Último Acceso</p>
                                    <p className="font-medium text-slate-800">{formatDate(analytics.lastLogin)}</p>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'timeline' ? (
                        <div className="space-y-3">
                            {events.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <p className="text-5xl mb-3">📭</p>
                                    <p className="text-lg">Sin actividad registrada</p>
                                </div>
                            ) : (
                                events.map((event, i) => {
                                    const config = EVENT_CONFIG[event.type] || { icon: '📝', label: event.type, color: 'text-slate-600', bg: 'bg-slate-100' };
                                    return (
                                        <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${
                                            event.type === 'google_intruso' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'
                                        }`}>
                                            <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center text-lg shrink-0`}>
                                                {config.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-medium ${config.color}`}>{config.label}</p>
                                                    <span className="text-xs text-slate-400">•</span>
                                                    <span className="text-xs text-slate-500">{formatDate(event.timestamp)}</span>
                                                </div>
                                                {event.details && (
                                                    <p className="text-sm text-slate-600 mt-1 break-all">{event.details}</p>
                                                )}
                                                {(event.deviceType || event.browser) && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {event.deviceType} • {event.os} • {event.browser}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Activity by Hour */}
                            <div>
                                <h3 className="font-semibold text-slate-700 mb-3">📊 Actividad por Hora del Día</h3>
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-end gap-1 h-24">
                                        {analytics.activityByHour.map((count, hour) => (
                                            <div 
                                                key={hour} 
                                                className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                                style={{ height: `${count > 0 ? Math.max(10, (count / Math.max(...analytics.activityByHour)) * 100) : 3}%` }}
                                                title={`${hour}:00 - ${count} eventos`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                                        <span>0:00</span>
                                        <span>6:00</span>
                                        <span>12:00</span>
                                        <span>18:00</span>
                                        <span>23:00</span>
                                    </div>
                                    <p className="text-center text-sm text-slate-600 mt-2">
                                        Hora pico: <span className="font-bold">{analytics.peakHour}:00</span>
                                    </p>
                                </div>
                            </div>

                            {/* Event Breakdown */}
                            <div>
                                <h3 className="font-semibold text-slate-700 mb-3">📈 Desglose de Eventos</h3>
                                <div className="space-y-2">
                                    {Object.entries(analytics.eventBreakdown)
                                        .sort(([,a], [,b]) => b - a)
                                        .map(([type, count]) => {
                                            const config = EVENT_CONFIG[type] || { icon: '📝', label: type, bg: 'bg-slate-100' };
                                            const pct = (count / analytics.totalEvents) * 100;
                                            return (
                                                <div key={type} className="flex items-center gap-3">
                                                    <span className="text-lg">{config.icon}</span>
                                                    <span className="text-sm text-slate-700 w-32">{config.label}</span>
                                                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 w-12 text-right">{count}</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Sessions by Day */}
                            {Object.keys(analytics.sessionsByDay).length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-slate-700 mb-3">📅 Sesiones por Día</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {Object.entries(analytics.sessionsByDay).slice(0, 8).map(([day, count]) => (
                                            <div key={day} className="bg-slate-50 rounded-lg p-3 text-center">
                                                <p className="text-2xl font-bold text-blue-600">{count}</p>
                                                <p className="text-xs text-slate-500">{day}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 px-6 py-4 border-t bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {!isVerified && onVerifyManually && (
                            <button 
                                onClick={() => onVerifyManually(studentData.studentId)}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                ✓ Verificar Manualmente
                            </button>
                        )}
                        {studentData.phone && (
                            <button 
                                onClick={sendWhatsAppReminder}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                💬 WhatsApp
                            </button>
                        )}
                    </div>
                    <div className="text-xs text-slate-400">
                        {analytics.totalEvents} eventos • UID: {studentData.studentId}
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
