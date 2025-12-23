"use client";

import { useState, useEffect } from 'react';
import { requestNotificationPermission, registerNotificationToken } from '@/lib/firebase';

interface NotificationPermissionButtonProps {
    userId: string;
    role: 'admin' | 'ietac_admin' | 'student';
    variant?: 'full' | 'compact';
}

export default function NotificationPermissionButton({
    userId,
    role,
    variant = 'full'
}: NotificationPermissionButtonProps) {
    const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);

    useEffect(() => {
        // Verificar estado actual de permisos
        if (!('Notification' in window)) {
            setPermissionStatus('unsupported');
            return;
        }

        setPermissionStatus(Notification.permission as 'default' | 'granted' | 'denied');

        // Verificar si ya está registrado en localStorage
        const savedToken = localStorage.getItem(`fcm_token_${userId}`);
        if (savedToken) {
            setRegistered(true);
        }
    }, [userId]);

    async function handleEnableNotifications() {
        setLoading(true);

        try {
            const token = await requestNotificationPermission();

            if (token) {
                // Registrar el token en Firestore
                const deviceInfo = {
                    browser: navigator.userAgent.includes('Chrome') ? 'Chrome'
                        : navigator.userAgent.includes('Firefox') ? 'Firefox'
                            : navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
                    os: navigator.platform
                };

                const success = await registerNotificationToken(userId, token, role, deviceInfo);

                if (success) {
                    localStorage.setItem(`fcm_token_${userId}`, token);
                    setRegistered(true);
                    setPermissionStatus('granted');
                }
            } else {
                setPermissionStatus(Notification.permission as 'default' | 'granted' | 'denied');
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
        } finally {
            setLoading(false);
        }
    }

    // No mostrar si no soporta notificaciones
    if (permissionStatus === 'unsupported') {
        return null;
    }

    // Ya registrado
    if (registered && permissionStatus === 'granted') {
        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-1 text-green-600 text-xs">
                    <span>🔔</span>
                    <span>Activo</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Notificaciones activas
            </div>
        );
    }

    // Denegado
    if (permissionStatus === 'denied') {
        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-1 text-red-500 text-xs">
                    <span>🔕</span>
                    <span>Bloqueado</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Notificaciones bloqueadas
            </div>
        );
    }

    // Botón para activar
    if (variant === 'compact') {
        return (
            <button
                onClick={handleEnableNotifications}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs transition-all disabled:opacity-50"
            >
                {loading ? (
                    <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <span>🔔</span>
                )}
                <span>Activar</span>
            </button>
        );
    }

    return (
        <button
            onClick={handleEnableNotifications}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
            {loading ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Activando...
                </>
            ) : (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Activar Notificaciones
                </>
            )}
        </button>
    );
}
