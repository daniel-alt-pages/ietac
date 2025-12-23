"use client";

import { useState, useEffect } from 'react';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { dbSecondary } from '@/lib/firebase';

// Plantillas predefinidas para cada tipo de notificación
const notificationTemplates = {
    verification_error: [
        {
            name: 'Formal',
            title: '🔴 ERROR: {studentName} ({institution})',
            message: 'Verificó con email incorrecto.\n✓ Asignado: {assignedEmail}\n✗ Usado: {usedEmail}'
        },
        {
            name: 'Corto',
            title: '❌ Error verificación',
            message: '{studentName} usó {usedEmail} en vez de {assignedEmail}'
        },
        {
            name: 'Detallado',
            title: '🚨 ALERTA: Verificación incorrecta',
            message: 'El estudiante {studentName} [ID: {studentId}] de {institution} intentó verificar su cuenta usando el correo incorrecto.\n\n📧 Correo asignado: {assignedEmail}\n❌ Correo usado: {usedEmail}\n⏰ Hora: {time}\n\nAcción requerida: Contactar al estudiante.'
        }
    ],
    duplicate_session: [
        {
            name: 'Alerta',
            title: '🟠 SESIÓN DUPLICADA: {studentName}',
            message: 'Intentó iniciar sesión mientras ya tiene una sesión activa.\n⚠️ Posible cuenta compartida.'
        },
        {
            name: 'Urgente',
            title: '⚠️ ¡ATENCIÓN! Sesión duplicada detectada',
            message: '{studentName} [ID: {studentId}] de {institution} está intentando acceder desde múltiples dispositivos simultáneamente.\n\n🔐 Posible violación de políticas de uso.\n⏰ Hora: {time}'
        },
        {
            name: 'Simple',
            title: '🔐 Sesión duplicada',
            message: '{studentName} intentó acceder desde otro dispositivo'
        }
    ],
    crud_action: [
        {
            name: 'Estándar',
            title: '{emoji} {action}: {studentName}',
            message: '{adminLabel} {actionText} al estudiante:\n👤 {studentName} [ID: {studentId}]'
        },
        {
            name: 'Detallado',
            title: '📝 Modificación en Base de Datos',
            message: 'Acción: {action}\nEstudiante: {studentName} [ID: {studentId}]\nRealizado por: {adminLabel}\nCambios: {changes}\n⏰ {time}'
        },
        {
            name: 'Mínimo',
            title: '{emoji} CRUD: {studentName}',
            message: '{adminLabel} → {action}'
        }
    ],
    student_verified: [
        {
            name: 'Celebración',
            title: '✅ VERIFICADO: {studentName} ({institution})',
            message: '¡Estudiante verificó su cuenta correctamente!\n📧 {email}'
        },
        {
            name: 'Simple',
            title: '✓ Verificación exitosa',
            message: '{studentName} verificó con {email}'
        },
        {
            name: 'Detallado',
            title: '🎉 ¡Nueva verificación completada!',
            message: 'El estudiante {studentName} de {institution} ha completado exitosamente el proceso de verificación.\n\nID: {studentId}\n📧 Email: {email}\n⏰ {time}'
        }
    ],
    login_failed: [
        {
            name: 'Alerta',
            title: '🔵 LOGIN FALLIDO x{attemptCount}',
            message: 'Se detectaron {attemptCount} intentos fallidos.\n🆔 ID: {attemptedId}'
        },
        {
            name: 'Seguridad',
            title: '🚨 Intentos de acceso fallidos',
            message: 'Se han registrado {attemptCount} intentos fallidos de inicio de sesión.\n\n🆔 ID intentado: {attemptedId}\n🌐 IP: {ipAddress}\n⏰ {time}\n\n¿Posible ataque de fuerza bruta?'
        },
        {
            name: 'Simple',
            title: '❌ Login fallido',
            message: 'ID {attemptedId}: {attemptCount} intentos'
        }
    ],
    account_disabled: [
        {
            name: 'Formal',
            title: '⛔ CUENTA BLOQUEADA: {studentName}',
            message: 'Se deshabilitó la cuenta.\n📝 Razón: {reason}'
        },
        {
            name: 'Detallado',
            title: '🚫 Cuenta deshabilitada',
            message: 'La cuenta del estudiante {studentName} [ID: {studentId}] ha sido deshabilitada.\n\n📝 Razón: {reason}\n👨‍💼 Por: {disabledBy}\n⏰ {time}'
        },
        {
            name: 'Corto',
            title: '⛔ Bloqueado: {studentName}',
            message: 'Razón: {reason}'
        }
    ],
    reminder_pending: [
        {
            name: 'Amigable',
            title: '⏰ Recordatorio de Verificación',
            message: 'Hola {studentName}, aún no has verificado tu cuenta. Tu correo asignado es: {email}'
        },
        {
            name: 'Formal',
            title: '📋 Recordatorio: Verificación pendiente',
            message: 'Estimado(a) {studentName},\n\nLe recordamos que su cuenta institucional aún no ha sido verificada.\n\nCorreo asignado: {email}\n\nPor favor, ingrese a la plataforma para completar el proceso.'
        },
        {
            name: 'Urgente',
            title: '⚠️ ¡Verifica tu cuenta ahora!',
            message: '¡Hola {studentName}! Tu cuenta aún no está verificada. Sin verificar no podrás acceder a todos los recursos.\n\n📧 Tu correo: {email}\n🔗 Entra ya a la plataforma'
        },
        {
            name: 'Casual',
            title: '👋 Hey {studentName}!',
            message: 'Notamos que aún no verificas tu cuenta. ¡Es súper fácil! Solo necesitas tu correo: {email}'
        }
    ]
};

// Configuración por defecto (usa la primera plantilla de cada tipo)
const defaultNotificationSettings = {
    verification_error: {
        enabled: true,
        title: notificationTemplates.verification_error[0].title,
        message: notificationTemplates.verification_error[0].message,
        priority: 'high' as const,
        selectedTemplate: 0
    },
    duplicate_session: {
        enabled: true,
        title: notificationTemplates.duplicate_session[0].title,
        message: notificationTemplates.duplicate_session[0].message,
        priority: 'high' as const,
        selectedTemplate: 0
    },
    crud_action: {
        enabled: true,
        title: notificationTemplates.crud_action[0].title,
        message: notificationTemplates.crud_action[0].message,
        priority: 'medium' as const,
        selectedTemplate: 0
    },
    student_verified: {
        enabled: true,
        title: notificationTemplates.student_verified[0].title,
        message: notificationTemplates.student_verified[0].message,
        priority: 'low' as const,
        selectedTemplate: 0
    },
    login_failed: {
        enabled: true,
        title: notificationTemplates.login_failed[0].title,
        message: notificationTemplates.login_failed[0].message,
        priority: 'medium' as const,
        selectedTemplate: 0
    },
    account_disabled: {
        enabled: true,
        title: notificationTemplates.account_disabled[0].title,
        message: notificationTemplates.account_disabled[0].message,
        priority: 'high' as const,
        selectedTemplate: 0
    },
    reminder_pending: {
        enabled: true,
        title: notificationTemplates.reminder_pending[0].title,
        message: notificationTemplates.reminder_pending[0].message,
        priority: 'medium' as const,
        selectedTemplate: 0
    }
};

type NotificationType = keyof typeof defaultNotificationSettings;

interface NotificationConfig {
    enabled: boolean;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
}

interface NotificationSettingsManagerProps {
    onClose: () => void;
}

export default function NotificationSettingsManager({ onClose }: NotificationSettingsManagerProps) {
    const [settings, setSettings] = useState<Record<NotificationType, NotificationConfig>>(defaultNotificationSettings);
    const [activeTab, setActiveTab] = useState<NotificationType>('verification_error');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    const notificationLabels: Record<NotificationType, { label: string; icon: string; description: string }> = {
        verification_error: {
            label: 'Error de Verificación',
            icon: '🔴',
            description: 'Cuando un estudiante usa email incorrecto'
        },
        duplicate_session: {
            label: 'Sesión Duplicada',
            icon: '🟠',
            description: 'Cuando detectamos cuenta compartida'
        },
        crud_action: {
            label: 'Modificación CRUD',
            icon: '🟡',
            description: 'Cuando un admin modifica un estudiante'
        },
        student_verified: {
            label: 'Verificación Exitosa',
            icon: '✅',
            description: 'Cuando un estudiante verifica correctamente'
        },
        login_failed: {
            label: 'Login Fallido',
            icon: '🔵',
            description: 'Múltiples intentos de login fallidos'
        },
        account_disabled: {
            label: 'Cuenta Bloqueada',
            icon: '⛔',
            description: 'Cuando se deshabilita una cuenta'
        },
        reminder_pending: {
            label: 'Recordatorio',
            icon: '⏰',
            description: 'Mensaje a estudiantes pendientes'
        }
    };

    const variables: Record<NotificationType, string[]> = {
        verification_error: ['{studentName}', '{studentId}', '{institution}', '{assignedEmail}', '{usedEmail}', '{time}'],
        duplicate_session: ['{studentName}', '{studentId}', '{institution}', '{time}'],
        crud_action: ['{studentName}', '{studentId}', '{action}', '{actionText}', '{adminLabel}', '{emoji}', '{changes}', '{time}'],
        student_verified: ['{studentName}', '{studentId}', '{email}', '{institution}', '{time}'],
        login_failed: ['{attemptedId}', '{attemptCount}', '{ipAddress}', '{time}'],
        account_disabled: ['{studentName}', '{studentId}', '{reason}', '{disabledBy}', '{time}'],
        reminder_pending: ['{studentName}', '{email}', '{institution}']
    };

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const settingsDoc = await getDoc(doc(dbSecondary, 'app_settings', 'notifications'));
            if (settingsDoc.exists()) {
                setSettings({ ...defaultNotificationSettings, ...settingsDoc.data() as Record<NotificationType, NotificationConfig> });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    }

    async function saveSettings() {
        setSaving(true);
        try {
            await setDoc(doc(dbSecondary, 'app_settings', 'notifications'), settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setSaving(false);
        }
    }

    function updateSetting(type: NotificationType, field: keyof NotificationConfig, value: string | boolean) {
        setSettings(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value
            }
        }));
    }

    function resetToDefault(type: NotificationType) {
        setSettings(prev => ({
            ...prev,
            [type]: defaultNotificationSettings[type]
        }));
    }

    const currentConfig = settings[activeTab];
    const currentInfo = notificationLabels[activeTab];

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-lg">Configurar Notificaciones</h2>
                                <p className="text-white/60 text-sm">Personaliza los mensajes de cada tipo de alerta</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar - Tipos de notificación */}
                    <div className="w-64 bg-slate-50 border-r overflow-y-auto shrink-0">
                        <div className="p-3 space-y-1">
                            {(Object.keys(notificationLabels) as NotificationType[]).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setActiveTab(type)}
                                    className={`w-full px-3 py-3 rounded-xl text-left transition-all flex items-center gap-3 ${activeTab === type
                                        ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                                        : 'hover:bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    <span className="text-xl">{notificationLabels[type].icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{notificationLabels[type].label}</p>
                                        <p className={`text-xs truncate ${activeTab === type ? 'text-indigo-500' : 'text-slate-400'}`}>
                                            {settings[type].enabled ? 'Activo' : 'Desactivado'}
                                        </p>
                                    </div>
                                    {!settings[type].enabled && (
                                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content - Editor */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-xl space-y-6">
                            {/* Header del tipo activo */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <span>{currentInfo.icon}</span>
                                        {currentInfo.label}
                                    </h3>
                                    <p className="text-slate-500 text-sm">{currentInfo.description}</p>
                                </div>
                                <button
                                    onClick={() => resetToDefault(activeTab)}
                                    className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border rounded-lg hover:bg-slate-50 transition-all"
                                >
                                    Restaurar
                                </button>
                            </div>

                            {/* Toggle habilitado */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <p className="font-medium text-slate-800">Notificación activa</p>
                                    <p className="text-sm text-slate-500">Recibir alertas de este tipo</p>
                                </div>
                                <button
                                    onClick={() => updateSetting(activeTab, 'enabled', !currentConfig.enabled)}
                                    className={`relative w-14 h-8 rounded-full transition-all ${currentConfig.enabled ? 'bg-green-500' : 'bg-slate-300'
                                        }`}
                                >
                                    <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${currentConfig.enabled ? 'left-7' : 'left-1'
                                        }`}></span>
                                </button>
                            </div>

                            {/* Prioridad */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Prioridad</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['low', 'medium', 'high'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => updateSetting(activeTab, 'priority', p)}
                                            className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${currentConfig.priority === p
                                                ? p === 'low' ? 'border-green-500 bg-green-50 text-green-700'
                                                    : p === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700'
                                                        : 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            {p === 'low' ? '🟢 Baja' : p === 'medium' ? '🟡 Media' : '🔴 Alta'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Plantillas predefinidas */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    📋 Plantillas predefinidas
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {notificationTemplates[activeTab].map((template, index) => (
                                        <button
                                            key={template.name}
                                            onClick={() => {
                                                setSettings(prev => ({
                                                    ...prev,
                                                    [activeTab]: {
                                                        ...prev[activeTab],
                                                        title: template.title,
                                                        message: template.message,
                                                        selectedTemplate: index
                                                    }
                                                }));
                                            }}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${currentConfig.title === template.title && currentConfig.message === template.message
                                                ? 'border-indigo-500 bg-indigo-50'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <p className="font-medium text-sm text-slate-800">{template.name}</p>
                                            <p className="text-xs text-slate-500 mt-1 truncate">{template.title}</p>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            // Custom mode - just clear selection indicator
                                            setSettings(prev => ({
                                                ...prev,
                                                [activeTab]: {
                                                    ...prev[activeTab],
                                                    selectedTemplate: -1
                                                }
                                            }));
                                        }}
                                        className={`p-3 rounded-xl border-2 border-dashed text-left transition-all ${!notificationTemplates[activeTab].some(t =>
                                            t.title === currentConfig.title && t.message === currentConfig.message
                                        )
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                            }`}
                                    >
                                        <p className="font-medium text-sm text-slate-800">✏️ Personalizado</p>
                                        <p className="text-xs text-slate-500 mt-1">Editar manualmente</p>
                                    </button>
                                </div>
                            </div>

                            {/* Título */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Título de la notificación
                                </label>
                                <input
                                    type="text"
                                    value={currentConfig.title}
                                    onChange={(e) => updateSetting(activeTab, 'title', e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                                />
                            </div>

                            {/* Mensaje */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Contenido del mensaje
                                </label>
                                <textarea
                                    value={currentConfig.message}
                                    onChange={(e) => updateSetting(activeTab, 'message', e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm resize-none"
                                />
                            </div>

                            {/* Variables disponibles */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Variables disponibles
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {variables[activeTab].map((v) => (
                                        <button
                                            key={v}
                                            onClick={() => {
                                                navigator.clipboard.writeText(v);
                                            }}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-mono text-slate-600 transition-all"
                                            title="Clic para copiar"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">Clic en una variable para copiarla</p>
                            </div>

                            {/* Preview */}
                            <div className="p-4 bg-slate-800 rounded-xl text-white">
                                <p className="text-xs text-slate-400 mb-2">Vista previa (con datos de ejemplo):</p>
                                <p className="font-semibold">
                                    {currentConfig.title
                                        .replace('{studentName}', 'JUAN PÉREZ')
                                        .replace('{studentId}', '1234567890')
                                        .replace('{institution}', 'SG')
                                        .replace('{email}', 'juanperez.sg.est@gmail.com')
                                        .replace('{assignedEmail}', 'juanperez.sg.est@gmail.com')
                                        .replace('{usedEmail}', 'otro@gmail.com')
                                        .replace('{action}', 'UPDATE')
                                        .replace('{actionText}', 'modificó')
                                        .replace('{adminLabel}', 'Admin IETAC')
                                        .replace('{emoji}', '🟡')
                                        .replace('{attemptCount}', '3')
                                        .replace('{attemptedId}', '1234567890')
                                        .replace('{reason}', 'Sesiones múltiples')
                                        .replace('{disabledBy}', 'Admin')
                                        .replace('{time}', '2:30 PM')
                                    }
                                </p>
                                <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">
                                    {currentConfig.message
                                        .replace('{studentName}', 'JUAN PÉREZ')
                                        .replace('{studentId}', '1234567890')
                                        .replace('{institution}', 'SG')
                                        .replace('{email}', 'juanperez.sg.est@gmail.com')
                                        .replace('{assignedEmail}', 'juanperez.sg.est@gmail.com')
                                        .replace('{usedEmail}', 'otro@gmail.com')
                                        .replace('{action}', 'UPDATE')
                                        .replace('{actionText}', 'modificó')
                                        .replace('{adminLabel}', 'Admin IETAC')
                                        .replace('{emoji}', '🟡')
                                        .replace('{changes}', 'nombre, email')
                                        .replace('{attemptCount}', '3')
                                        .replace('{attemptedId}', '1234567890')
                                        .replace('{ipAddress}', '192.168.1.1')
                                        .replace('{reason}', 'Sesiones múltiples')
                                        .replace('{disabledBy}', 'Admin')
                                        .replace('{time}', '2:30 PM')
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Guardando...
                            </>
                        ) : saved ? (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                ¡Guardado!
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Guardar Cambios
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
