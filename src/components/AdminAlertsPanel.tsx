"use client";

import { useState, useEffect } from 'react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    doc,
    where,
    getDocs
} from 'firebase/firestore';
import { dbSecondary } from '@/lib/firebase';

interface AdminAlert {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: string;
    read: boolean;
    data?: Record<string, unknown>;
}

interface AdminAlertsPanelProps {
    onClose: () => void;
}

export default function AdminAlertsPanel({ onClose }: AdminAlertsPanelProps) {
    const [alerts, setAlerts] = useState<AdminAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Suscripción en tiempo real a las alertas
        const alertsQuery = query(
            collection(dbSecondary, 'admin_alerts'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
            const alertsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AdminAlert[];
            setAlerts(alertsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    async function markAsRead(alertId: string) {
        try {
            await updateDoc(doc(dbSecondary, 'admin_alerts', alertId), {
                read: true
            });
        } catch (error) {
            console.error('Error marking alert as read:', error);
        }
    }

    async function markAllAsRead() {
        try {
            const unreadQuery = query(
                collection(dbSecondary, 'admin_alerts'),
                where('read', '==', false)
            );
            const snapshot = await getDocs(unreadQuery);

            const updates = snapshot.docs.map(doc =>
                updateDoc(doc.ref, { read: true })
            );
            await Promise.all(updates);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    const filteredAlerts = alerts.filter(alert => {
        // Filtro de búsqueda
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            if (!alert.title.toLowerCase().includes(search) &&
                !alert.message.toLowerCase().includes(search)) {
                return false;
            }
        }

        // Filtro de estado
        if (filter === 'unread' && alert.read) return false;
        if (filter === 'high' && alert.priority !== 'high') return false;

        return true;
    });

    const unreadCount = alerts.filter(a => !a.read).length;

    const priorityConfig: Record<string, { color: string; bg: string; icon: string }> = {
        low: { color: 'text-green-600', bg: 'bg-green-100', icon: '🟢' },
        medium: { color: 'text-amber-600', bg: 'bg-amber-100', icon: '🟡' },
        high: { color: 'text-red-600', bg: 'bg-red-100', icon: '🔴' }
    };

    const typeIcons: Record<string, string> = {
        verification_error: '❌',
        duplicate_session: '🔐',
        crud_action: '📝',
        student_verified: '✅',
        login_failed: '🚫',
        account_disabled: '⛔',
        reminder_pending: '⏰'
    };

    function formatTimeAgo(timestamp: string) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'Ahora';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col mt-16 mr-4 animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h2 className="text-white font-bold">Alertas del Sistema</h2>
                                <p className="text-white/60 text-xs">{alerts.length} alertas totales</p>
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

                {/* Filtros y búsqueda */}
                <div className="px-4 py-3 bg-slate-50 border-b space-y-2 shrink-0">
                    {/* Búsqueda */}
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar alertas..."
                            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Filtros */}
                    <div className="flex items-center gap-2">
                        {(['all', 'unread', 'high'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filter === f
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white border text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                {f === 'all' ? 'Todas' : f === 'unread' ? `No leídas (${unreadCount})` : '🔴 Urgentes'}
                            </button>
                        ))}
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Marcar todas leídas
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista de alertas */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredAlerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <span className="text-4xl mb-2">🔔</span>
                            <p className="text-sm">No hay alertas que mostrar</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    onClick={() => !alert.read && markAsRead(alert.id)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-50 ${!alert.read ? 'bg-indigo-50/50' : ''
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Icono de tipo */}
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${priorityConfig[alert.priority]?.bg || 'bg-slate-100'
                                            }`}>
                                            {typeIcons[alert.type] || '📋'}
                                        </div>

                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`font-medium text-sm truncate ${!alert.read ? 'text-slate-900' : 'text-slate-600'
                                                    }`}>
                                                    {alert.title}
                                                </p>
                                                {!alert.read && (
                                                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                {alert.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${priorityConfig[alert.priority]?.bg || 'bg-slate-100'
                                                    } ${priorityConfig[alert.priority]?.color || 'text-slate-600'}`}>
                                                    {priorityConfig[alert.priority]?.icon} {alert.priority}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {formatTimeAgo(alert.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
