"use client";

import { useState, useEffect } from 'react';
import { requestNotificationPermission, registerNotificationToken } from '@/lib/firebase';

interface NotificationPromptModalProps {
    userId: string;
    userName?: string;
    role: 'admin' | 'ietac_admin' | 'student';
    onClose: () => void;
}

interface TitleOption {
    id: string;
    text: string;
}

interface NotificationCategory {
    id: string;
    icon: string;
    name: string;
    enabled: boolean;
    color: string;
    titles: TitleOption[];
    selectedTitle: number;
    descriptions: TitleOption[];
    selectedDescription: number;
}

export default function NotificationPromptModal({
    userId,
    userName,
    role,
    onClose
}: NotificationPromptModalProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<'success' | 'denied' | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [categories, setCategories] = useState<NotificationCategory[]>([
        {
            id: 'security',
            icon: '🔐',
            name: 'Alertas de Seguridad',
            enabled: true,
            color: 'red',
            titles: [
                { id: 'sec1', text: '🚨 ALERTA: Sesión duplicada detectada' },
                { id: 'sec2', text: '⚠️ Acceso sospechoso detectado' },
                { id: 'sec3', text: '🔐 Intento de acceso no autorizado' },
                { id: 'sec4', text: '🛡️ Actividad de seguridad importante' }
            ],
            selectedTitle: 0,
            descriptions: [
                { id: 'secd1', text: 'Alguien intentó acceder a tu cuenta desde otro dispositivo.' },
                { id: 'secd2', text: 'Se detectó actividad inusual en tu cuenta. Revisa tu sesión.' },
                { id: 'secd3', text: 'Tu cuenta ha sido protegida por nuestro sistema de seguridad.' },
                { id: 'secd4', text: 'Hemos tomado medidas para proteger tu información.' }
            ],
            selectedDescription: 0
        },
        {
            id: 'verification',
            icon: '✅',
            name: 'Estado de Verificación',
            enabled: true,
            color: 'green',
            titles: [
                { id: 'ver1', text: '✅ ¡Verificación completada!' },
                { id: 'ver2', text: '📧 Tu cuenta ha sido verificada' },
                { id: 'ver3', text: '🎉 ¡Felicidades! Cuenta verificada' },
                { id: 'ver4', text: '✓ Proceso de verificación exitoso' }
            ],
            selectedTitle: 0,
            descriptions: [
                { id: 'verd1', text: 'Tu cuenta institucional ha sido verificada correctamente.' },
                { id: 'verd2', text: 'Ahora tienes acceso completo a todos los recursos.' },
                { id: 'verd3', text: 'Tu correo de Google ha sido vinculado exitosamente.' },
                { id: 'verd4', text: 'El proceso de verificación se completó sin problemas.' }
            ],
            selectedDescription: 0
        },
        {
            id: 'reminders',
            icon: '⏰',
            name: 'Recordatorios',
            enabled: true,
            color: 'amber',
            titles: [
                { id: 'rem1', text: '⏰ Recordatorio: Verifica tu cuenta' },
                { id: 'rem2', text: '📝 Acción pendiente en tu cuenta' },
                { id: 'rem3', text: '👋 ¡No olvides completar tu registro!' },
                { id: 'rem4', text: '🔔 Tienes una tarea pendiente' }
            ],
            selectedTitle: 0,
            descriptions: [
                { id: 'remd1', text: 'Aún no has verificado tu cuenta. Completa el proceso para acceder a todos los beneficios.' },
                { id: 'remd2', text: 'Tu verificación está pendiente. Solo toma unos minutos.' },
                { id: 'remd3', text: 'Recuerda confirmar tu correo institucional.' },
                { id: 'remd4', text: 'Finaliza tu registro para desbloquear todas las funciones.' }
            ],
            selectedDescription: 0
        },
        {
            id: 'updates',
            icon: '📢',
            name: 'Avisos y Actualizaciones',
            enabled: true,
            color: 'blue',
            titles: [
                { id: 'upd1', text: '📢 Nuevo aviso importante' },
                { id: 'upd2', text: '🆕 Actualización disponible' },
                { id: 'upd3', text: '📣 Mensaje del administrador' },
                { id: 'upd4', text: '💡 Nueva información disponible' }
            ],
            selectedTitle: 0,
            descriptions: [
                { id: 'updd1', text: 'Hay un nuevo mensaje importante para ti. Revisa tu panel.' },
                { id: 'updd2', text: 'Hemos añadido nuevas funciones. ¡Descúbrelas!' },
                { id: 'updd3', text: 'El administrador ha publicado un aviso importante.' },
                { id: 'updd4', text: 'Hay novedades en la plataforma que te pueden interesar.' }
            ],
            selectedDescription: 0
        },
        {
            id: 'admin',
            icon: '👨‍💼',
            name: 'Actividad de Administradores',
            enabled: role !== 'student',
            color: 'purple',
            titles: [
                { id: 'adm1', text: '📝 Cambio realizado por admin' },
                { id: 'adm2', text: '🔄 Modificación en base de datos' },
                { id: 'adm3', text: '👤 Nuevo estudiante registrado' },
                { id: 'adm4', text: '⚙️ Acción administrativa ejecutada' }
            ],
            selectedTitle: 0,
            descriptions: [
                { id: 'admd1', text: 'Otro administrador realizó cambios en el sistema.' },
                { id: 'admd2', text: 'Se ha modificado la información de un estudiante.' },
                { id: 'admd3', text: 'Se registró un nuevo estudiante en la plataforma.' },
                { id: 'admd4', text: 'Una acción CRUD fue ejecutada por otro admin.' }
            ],
            selectedDescription: 0
        }
    ]);

    useEffect(() => {
        const alreadyAsked = localStorage.getItem(`notification_asked_${userId}`);
        if (alreadyAsked) {
            onClose();
        }
    }, [userId, onClose]);

    function toggleCategory(id: string) {
        setCategories(prev => prev.map(cat =>
            cat.id === id ? { ...cat, enabled: !cat.enabled } : cat
        ));
    }

    function updateCategoryTitle(id: string, titleIndex: number) {
        setCategories(prev => prev.map(cat =>
            cat.id === id ? { ...cat, selectedTitle: titleIndex } : cat
        ));
    }

    function updateCategoryDescription(id: string, descIndex: number) {
        setCategories(prev => prev.map(cat =>
            cat.id === id ? { ...cat, selectedDescription: descIndex } : cat
        ));
    }

    async function handleEnable() {
        setLoading(true);

        try {
            const token = await requestNotificationPermission();

            if (token) {
                const deviceInfo = {
                    browser: navigator.userAgent.includes('Chrome') ? 'Chrome'
                        : navigator.userAgent.includes('Firefox') ? 'Firefox'
                            : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
                    os: navigator.platform
                };

                // Guardar preferencias completas
                const preferences = categories.reduce((acc, cat) => {
                    acc[cat.id] = {
                        enabled: cat.enabled,
                        titleTemplate: cat.titles[cat.selectedTitle].text,
                        descriptionTemplate: cat.descriptions[cat.selectedDescription].text
                    };
                    return acc;
                }, {} as Record<string, { enabled: boolean; titleTemplate: string; descriptionTemplate: string }>);

                await registerNotificationToken(userId, token, role, deviceInfo);
                localStorage.setItem(`fcm_token_${userId}`, token);
                localStorage.setItem(`notification_prefs_${userId}`, JSON.stringify(preferences));
                localStorage.setItem(`notification_asked_${userId}`, 'true');
                setResult('success');

                setTimeout(() => onClose(), 2000);
            } else {
                localStorage.setItem(`notification_asked_${userId}`, 'true');
                setResult('denied');
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            setResult('denied');
        } finally {
            setLoading(false);
        }
    }

    function handleSkip() {
        localStorage.setItem(`notification_asked_${userId}`, 'true');
        onClose();
    }

    // Resultado exitoso
    if (result === 'success') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Notificaciones Activas!</h2>
                    <p className="text-slate-600">
                        Tus preferencias han sido guardadas correctamente.
                    </p>
                </div>
            </div>
        );
    }

    // Resultado denegado
    if (result === 'denied') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-4xl">🔕</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Sin problema</h2>
                    <p className="text-slate-600 mb-6">
                        Puedes activar las notificaciones más tarde desde la configuración.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        );
    }

    const colorClasses: Record<string, { bg: string; border: string; text: string; light: string }> = {
        red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', light: 'bg-red-100' },
        green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', light: 'bg-green-100' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', light: 'bg-amber-100' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', light: 'bg-blue-100' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', light: 'bg-purple-100' }
    };

    // Filtrar categorías según el rol
    const visibleCategories = role === 'student'
        ? categories.filter(c => c.id !== 'admin')
        : categories;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header con gradiente */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-5 text-center shrink-0">
                    <div className="w-12 h-12 mx-auto mb-2 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <h2 className="text-white font-bold text-lg mb-0.5">
                        {userName ? `¡Hola ${userName}!` : '¡Personaliza tus Alertas!'}
                    </h2>
                    <p className="text-white/80 text-sm">
                        Elige cómo quieres recibir cada notificación
                    </p>
                </div>

                {/* Contenido - Scroll */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Lista de categorías */}
                    <div className="space-y-2">
                        {visibleCategories.map((category) => (
                            <div
                                key={category.id}
                                className={`rounded-xl border-2 overflow-hidden transition-all ${category.enabled
                                        ? `${colorClasses[category.color].border} ${colorClasses[category.color].bg}`
                                        : 'border-slate-200 bg-slate-50 opacity-60'
                                    }`}
                            >
                                {/* Header de categoría */}
                                <div
                                    className="flex items-center justify-between p-3 cursor-pointer"
                                    onClick={() => setExpandedCategory(
                                        expandedCategory === category.id ? null : category.id
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{category.icon}</span>
                                        <span className={`font-medium text-sm ${category.enabled ? colorClasses[category.color].text : 'text-slate-500'
                                            }`}>
                                            {category.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Toggle */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCategory(category.id);
                                            }}
                                            className={`relative w-10 h-5 rounded-full transition-all ${category.enabled ? 'bg-green-500' : 'bg-slate-300'
                                                }`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${category.enabled ? 'left-5' : 'left-0.5'
                                                }`}></span>
                                        </button>
                                        {/* Chevron */}
                                        <svg
                                            className={`w-4 h-4 text-slate-400 transition-transform ${expandedCategory === category.id ? 'rotate-180' : ''
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Contenido expandible con selectores */}
                                {expandedCategory === category.id && category.enabled && (
                                    <div className="px-3 pb-3 pt-0 space-y-3">
                                        {/* Selector de Título */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                                📌 Estilo de título:
                                            </label>
                                            <select
                                                value={category.selectedTitle}
                                                onChange={(e) => updateCategoryTitle(category.id, parseInt(e.target.value))}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg ${colorClasses[category.color].light} ${colorClasses[category.color].border} ${colorClasses[category.color].text} focus:outline-none focus:ring-2 focus:ring-offset-1`}
                                            >
                                                {category.titles.map((title, idx) => (
                                                    <option key={title.id} value={idx}>
                                                        {title.text}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Selector de Descripción */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">
                                                💬 Estilo de mensaje:
                                            </label>
                                            <select
                                                value={category.selectedDescription}
                                                onChange={(e) => updateCategoryDescription(category.id, parseInt(e.target.value))}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg ${colorClasses[category.color].light} ${colorClasses[category.color].border} text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-1`}
                                            >
                                                {category.descriptions.map((desc, idx) => (
                                                    <option key={desc.id} value={idx}>
                                                        {desc.text}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Preview */}
                                        <div className={`p-2 rounded-lg ${colorClasses[category.color].light} border ${colorClasses[category.color].border}`}>
                                            <p className="text-xs text-slate-500 mb-1">Vista previa:</p>
                                            <p className={`font-medium text-sm ${colorClasses[category.color].text}`}>
                                                {category.titles[category.selectedTitle].text}
                                            </p>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                {category.descriptions[category.selectedDescription].text}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t space-y-2 shrink-0">
                    <button
                        onClick={handleEnable}
                        disabled={loading || !categories.some(c => c.enabled)}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Guardar Preferencias ({visibleCategories.filter(c => c.enabled).length} activas)
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleSkip}
                        disabled={loading}
                        className="w-full py-2 text-slate-500 hover:text-slate-700 font-medium transition-all text-sm"
                    >
                        Omitir por ahora
                    </button>
                </div>
            </div>
        </div>
    );
}
