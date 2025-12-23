"use client";

import { useState, useEffect } from 'react';
import {
    collection,
    getDocs,
    query,
    where,
    addDoc
} from 'firebase/firestore';
import { db, dbSecondary } from '@/lib/firebase';

interface BroadcastMessage {
    id?: string;
    title: string;
    body: string;
    type: 'info' | 'warning' | 'urgent';
    targetAudience: 'all' | 'pending' | 'verified' | 'ietac' | 'sg';
    sentBy: string;
    sentAt: string;
    recipientCount: number;
}

interface AdminBroadcastProps {
    adminId: string;
    onClose: () => void;
}

// Plantillas predefinidas por tipo
const messageTemplates = {
    info: {
        titles: [
            { id: 'info1', text: 'ℹ️ Información importante' },
            { id: 'info2', text: '📢 Aviso general' },
            { id: 'info3', text: '💡 Recordatorio' },
            { id: 'info4', text: '📣 Comunicado oficial' },
            { id: 'info5', text: '🔔 Notificación del sistema' }
        ],
        bodies: [
            { id: 'infob1', text: 'Queremos informarte sobre una actualización importante en la plataforma.' },
            { id: 'infob2', text: 'Por favor revisa tu panel de estudiante para ver las últimas novedades.' },
            { id: 'infob3', text: 'Te recordamos que debes completar tu proceso de verificación.' },
            { id: 'infob4', text: 'Hay nuevas funciones disponibles en la plataforma. ¡Descúbrelas!' },
            { id: 'infob5', text: 'Este es un mensaje informativo del equipo de SeamosGenios.' }
        ]
    },
    warning: {
        titles: [
            { id: 'warn1', text: '⚠️ Atención requerida' },
            { id: 'warn2', text: '🔶 Aviso importante' },
            { id: 'warn3', text: '⏰ Fecha límite próxima' },
            { id: 'warn4', text: '📌 Acción pendiente' },
            { id: 'warn5', text: '🔔 No olvides...' }
        ],
        bodies: [
            { id: 'warnb1', text: 'Tu cuenta aún no ha sido verificada. Por favor completa el proceso.' },
            { id: 'warnb2', text: 'Se acerca la fecha límite para completar tu registro. ¡No lo dejes para después!' },
            { id: 'warnb3', text: 'Tienes acciones pendientes en tu cuenta que requieren tu atención.' },
            { id: 'warnb4', text: 'Es importante que revises tu información de perfil lo antes posible.' },
            { id: 'warnb5', text: 'Recuerda verificar tu correo institucional para acceder a todos los beneficios.' }
        ]
    },
    urgent: {
        titles: [
            { id: 'urg1', text: '🚨 URGENTE: Acción inmediata requerida' },
            { id: 'urg2', text: '🔴 Alerta crítica' },
            { id: 'urg3', text: '⚡ Mensaje prioritario' },
            { id: 'urg4', text: '🆘 Atención inmediata' },
            { id: 'urg5', text: '❗ Importante: Lee ahora' }
        ],
        bodies: [
            { id: 'urgb1', text: 'Tu cuenta será desactivada si no completas la verificación en las próximas 24 horas.' },
            { id: 'urgb2', text: 'Se ha detectado actividad inusual en tu cuenta. Revisa tu acceso inmediatamente.' },
            { id: 'urgb3', text: 'Hay un problema con tu cuenta que requiere atención inmediata.' },
            { id: 'urgb4', text: 'Este es un mensaje urgente del administrador. Por favor responde a la brevedad.' },
            { id: 'urgb5', text: 'Se requiere tu atención inmediata para un asunto crítico de tu cuenta.' }
        ]
    }
};

export default function AdminBroadcast({ adminId, onClose }: AdminBroadcastProps) {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'urgent'>('info');
    const [targetAudience, setTargetAudience] = useState<'all' | 'pending' | 'verified' | 'ietac' | 'sg'>('all');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [stats, setStats] = useState({ total: 0, withNotifications: 0 });
    const [error, setError] = useState('');
    const [selectedTitleTemplate, setSelectedTitleTemplate] = useState<number>(-1);
    const [selectedBodyTemplate, setSelectedBodyTemplate] = useState<number>(-1);
    const [showTitleDropdown, setShowTitleDropdown] = useState(false);
    const [showBodyDropdown, setShowBodyDropdown] = useState(false);

    // Cargar estadísticas de estudiantes con notificaciones
    useEffect(() => {
        loadStats();
    }, []);

    // Actualizar plantillas cuando cambia el tipo
    useEffect(() => {
        setSelectedTitleTemplate(-1);
        setSelectedBodyTemplate(-1);
    }, [type]);

    async function loadStats() {
        try {
            // Contar tokens de notificación de estudiantes
            const tokensQuery = query(
                collection(dbSecondary, 'notification_tokens'),
                where('role', '==', 'student'),
                where('enabled', '==', true)
            );
            const tokensSnap = await getDocs(tokensQuery);

            // Contar total de estudiantes
            const studentsSnap = await getDocs(collection(db, 'students'));

            setStats({
                total: studentsSnap.size,
                withNotifications: tokensSnap.size
            });
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    function selectTitleTemplate(index: number) {
        setSelectedTitleTemplate(index);
        setTitle(messageTemplates[type].titles[index].text);
        setShowTitleDropdown(false);
    }

    function selectBodyTemplate(index: number) {
        setSelectedBodyTemplate(index);
        setBody(messageTemplates[type].bodies[index].text);
        setShowBodyDropdown(false);
    }

    async function sendBroadcast() {
        if (!title.trim() || !body.trim()) {
            setError('Por favor completa el título y mensaje');
            return;
        }

        setSending(true);
        setError('');

        try {
            // Obtener estudiantes según el filtro
            let studentsQuery = query(collection(db, 'students'));

            if (targetAudience === 'pending') {
                studentsQuery = query(collection(db, 'students'), where('verificationStatus', '==', 'PENDING'));
            } else if (targetAudience === 'verified') {
                studentsQuery = query(collection(db, 'students'), where('verificationStatus', '==', 'VERIFIED'));
            } else if (targetAudience === 'ietac') {
                studentsQuery = query(collection(db, 'students'), where('institution', '==', 'IETAC'));
            } else if (targetAudience === 'sg') {
                studentsQuery = query(collection(db, 'students'), where('institution', '==', 'SG'));
            }

            const studentsSnap = await getDocs(studentsQuery);
            const studentIds = studentsSnap.docs.map(d => d.id);

            // Obtener tokens de estos estudiantes
            const tokensQuery = query(
                collection(dbSecondary, 'notification_tokens'),
                where('role', '==', 'student'),
                where('enabled', '==', true)
            );
            const tokensSnap = await getDocs(tokensQuery);

            // Filtrar tokens por estudiantes seleccionados
            const validTokens = tokensSnap.docs.filter(t =>
                studentIds.includes(t.data().userId)
            );

            // Guardar el mensaje de broadcast
            const broadcastData: BroadcastMessage = {
                title,
                body,
                type,
                targetAudience,
                sentBy: adminId,
                sentAt: new Date().toISOString(),
                recipientCount: validTokens.length
            };

            await addDoc(collection(dbSecondary, 'broadcast_messages'), broadcastData);

            // Guardar notificación pendiente para cada estudiante
            for (const tokenDoc of validTokens) {
                await addDoc(collection(dbSecondary, 'pending_notifications'), {
                    token: tokenDoc.data().token,
                    userId: tokenDoc.data().userId,
                    title,
                    body,
                    type,
                    createdAt: new Date().toISOString(),
                    sent: false
                });
            }

            setSent(true);

        } catch (err) {
            console.error('Error sending broadcast:', err);
            setError('Error al enviar el mensaje. Intenta de nuevo.');
        } finally {
            setSending(false);
        }
    }

    const typeConfig = {
        info: { icon: 'ℹ️', color: 'blue', label: 'Informativo', bg: 'bg-blue-50', border: 'border-blue-200' },
        warning: { icon: '⚠️', color: 'amber', label: 'Advertencia', bg: 'bg-amber-50', border: 'border-amber-200' },
        urgent: { icon: '🚨', color: 'red', label: 'Urgente', bg: 'bg-red-50', border: 'border-red-200' }
    };

    const audienceConfig = {
        all: { label: 'Todos los estudiantes', icon: '👥' },
        pending: { label: 'Solo pendientes de verificar', icon: '⏳' },
        verified: { label: 'Solo verificados', icon: '✅' },
        ietac: { label: 'Solo IETAC', icon: '🏫' },
        sg: { label: 'Solo SG', icon: '📚' }
    };

    if (sent) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Mensaje Enviado!</h2>
                    <p className="text-slate-600 mb-6">
                        Tu mensaje se enviará a los estudiantes con notificaciones activas.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-lg">Enviar Notificación</h2>
                                <p className="text-white/70 text-sm">Mensaje masivo a estudiantes</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-6 py-3 bg-slate-50 border-b flex items-center gap-4 text-sm shrink-0">
                    <span className="text-slate-500">
                        📊 <strong>{stats.total}</strong> estudiantes totales
                    </span>
                    <span className="text-slate-500">
                        🔔 <strong>{stats.withNotifications}</strong> con notificaciones activas
                    </span>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Tipo de mensaje */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Tipo de mensaje
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['info', 'warning', 'urgent'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`p-3 rounded-xl border-2 transition-all text-center ${type === t
                                        ? t === 'info' ? 'border-blue-500 bg-blue-50'
                                            : t === 'warning' ? 'border-amber-500 bg-amber-50'
                                                : 'border-red-500 bg-red-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <span className="text-xl">{typeConfig[t].icon}</span>
                                    <p className="text-xs mt-1 font-medium">{typeConfig[t].label}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Audiencia */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Enviar a
                        </label>
                        <select
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value as typeof targetAudience)}
                            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {Object.entries(audienceConfig).map(([key, config]) => (
                                <option key={key} value={key}>
                                    {config.icon} {config.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Título con dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            📌 Título del mensaje
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    setSelectedTitleTemplate(-1);
                                }}
                                placeholder="Escribe o selecciona una plantilla..."
                                className="w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                maxLength={100}
                            />
                            <button
                                type="button"
                                onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${showTitleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                        {showTitleDropdown && (
                            <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {messageTemplates[type].titles.map((template, idx) => (
                                    <button
                                        key={template.id}
                                        onClick={() => selectTitleTemplate(idx)}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-all ${selectedTitleTemplate === idx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                                            } ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === messageTemplates[type].titles.length - 1 ? 'rounded-b-xl' : ''}`}
                                    >
                                        {template.text}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{title.length}/100</p>
                    </div>

                    {/* Mensaje con dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            💬 Mensaje
                        </label>
                        <div className="relative">
                            <textarea
                                value={body}
                                onChange={(e) => {
                                    setBody(e.target.value);
                                    setSelectedBodyTemplate(-1);
                                }}
                                placeholder="Escribe o selecciona una plantilla..."
                                rows={3}
                                className="w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                maxLength={300}
                            />
                            <button
                                type="button"
                                onClick={() => setShowBodyDropdown(!showBodyDropdown)}
                                className="absolute right-3 top-3 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                            >
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${showBodyDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                        {showBodyDropdown && (
                            <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {messageTemplates[type].bodies.map((template, idx) => (
                                    <button
                                        key={template.id}
                                        onClick={() => selectBodyTemplate(idx)}
                                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-all ${selectedBodyTemplate === idx ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                                            } ${idx === 0 ? 'rounded-t-xl' : ''} ${idx === messageTemplates[type].bodies.length - 1 ? 'rounded-b-xl' : ''}`}
                                    >
                                        {template.text}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{body.length}/300</p>
                    </div>

                    {/* Preview */}
                    {(title || body) && (
                        <div className={`p-4 rounded-xl border-2 ${typeConfig[type].bg} ${typeConfig[type].border}`}>
                            <p className="text-xs text-slate-500 mb-2">Vista previa:</p>
                            <p className="font-semibold">{typeConfig[type].icon} {title || 'Título'}</p>
                            <p className="text-sm text-slate-600 mt-1">{body || 'Mensaje...'}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={sendBroadcast}
                        disabled={sending || !title.trim() || !body.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {sending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Enviando...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                Enviar Notificación
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
