"use client";

import { useState, useEffect, useMemo } from 'react';
import { subscribeToActivityEvents, ActivityEvent, ActivityEventType } from '@/lib/firebase';

interface ActivityLogProps {
    onClose: () => void;
}

type EventFilter = 'ALL' | 'login' | 'google_intruso' | 'google_verify' | 'confirmation' | 'admin_action';

const EVENT_CONFIG: Record<ActivityEventType, { icon: string; color: string; bg: string; label: string }> = {
    'login': { icon: '🔐', color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Login' },
    'login_failed': { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10', label: 'Login Fallido' },
    'confirmation': { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/10', label: 'Confirmación' },
    'view_credentials': { icon: '👁️', color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Ver Credenciales' },
    'page_view': { icon: '📄', color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Vista de Página' },
    'copy_email': { icon: '📧', color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'Copiar Email' },
    'copy_password': { icon: '🔑', color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Copiar Contraseña' },
    'heartbeat': { icon: '💓', color: 'text-pink-400', bg: 'bg-pink-500/10', label: 'Heartbeat' },
    'google_verify': { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Verificación Google' },
    'google_intruso': { icon: '⛔', color: 'text-red-500', bg: 'bg-red-500/20', label: 'INTRUSO' },
    'google_error': { icon: '⚠️', color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Error Google' },
    'admin_action': { icon: '🛡️', color: 'text-indigo-400', bg: 'bg-indigo-500/10', label: 'Acción Admin' },
    'session_end': { icon: '🚪', color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Fin Sesión' }
};

export default function ActivityLog({ onClose }: ActivityLogProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState<EventFilter>('ALL');
    const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToActivityEvents((data) => {
            setEvents(data);
            setLoading(false);
        }, 500); // Últimos 500 eventos

        return () => unsubscribe();
    }, []);

    const stats = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastHour = now.getTime() - 60 * 60 * 1000;
        
        const todayEvents = events.filter(e => new Date(e.timestamp).getTime() >= today);
        const lastHourEvents = events.filter(e => new Date(e.timestamp).getTime() >= lastHour);
        const intrusos = events.filter(e => e.type === 'google_intruso');
        const logins = events.filter(e => e.type === 'login');

        return {
            total: events.length,
            today: todayEvents.length,
            lastHour: lastHourEvents.length,
            intrusos: intrusos.length,
            logins: logins.length
        };
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            // Filter by type
            if (eventFilter !== 'ALL' && event.type !== eventFilter) return false;
            
            // Filter by search
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                event.studentId?.toLowerCase().includes(term) ||
                event.studentName?.toLowerCase().includes(term) ||
                event.details?.toLowerCase().includes(term) ||
                event.institution?.toLowerCase().includes(term) ||
                event.type?.toLowerCase().includes(term)
            );
        });
    }, [events, searchTerm, eventFilter]);

    function formatDate(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Ahora';
            if (diffMins < 60) return `Hace ${diffMins}m`;
            if (diffHours < 24) return `Hace ${diffHours}h`;
            if (diffDays < 7) return `Hace ${diffDays}d`;
            
            return date.toLocaleDateString('es-CO', { 
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        } catch { return dateStr; }
    }

    function formatFullDate(dateStr: string): string {
        try {
            return new Date(dateStr).toLocaleString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch { return dateStr; }
    }

    const getEventConfig = (type: ActivityEventType) => {
        return EVENT_CONFIG[type] || { icon: '📝', color: 'text-slate-400', bg: 'bg-slate-500/10', label: type };
    };

    // Icons
    const Icons = {
        activity: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
        search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
        back: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-[#0f172a] rounded-2xl w-full max-w-5xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl shadow-cyan-500/10 border border-white/5">
                
                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                                {Icons.activity}
                            </div>
                            <div>
                                <h1 className="text-white font-semibold text-xl tracking-tight">Registro de Actividad</h1>
                                <p className="text-cyan-200/60 text-sm">Monitoreo en tiempo real • {stats.total} eventos</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                        >
                            {Icons.close}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="shrink-0 px-6 py-4 bg-slate-900/50 border-b border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                            <p className="text-slate-500 text-xs mb-1">Última Hora</p>
                            <p className="text-2xl font-bold text-white">{stats.lastHour}</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                            <p className="text-slate-500 text-xs mb-1">Hoy</p>
                            <p className="text-2xl font-bold text-blue-400">{stats.today}</p>
                        </div>
                        <button 
                            onClick={() => setEventFilter(eventFilter === 'login' ? 'ALL' : 'login')}
                            className={`rounded-xl p-3 text-left transition-all ${eventFilter === 'login' ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10'}`}
                        >
                            <p className="text-blue-300/70 text-xs mb-1">Logins</p>
                            <p className="text-2xl font-bold text-blue-400">{stats.logins}</p>
                        </button>
                        <button 
                            onClick={() => setEventFilter(eventFilter === 'google_intruso' ? 'ALL' : 'google_intruso')}
                            className={`rounded-xl p-3 text-left transition-all ${eventFilter === 'google_intruso' ? 'bg-red-500/20 border-2 border-red-500' : 'bg-red-500/5 border border-red-500/20 hover:bg-red-500/10'}`}
                        >
                            <p className="text-red-300/70 text-xs mb-1">Intrusos</p>
                            <p className="text-2xl font-bold text-red-400">{stats.intrusos}</p>
                        </button>
                        <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
                            <p className="text-emerald-300/70 text-xs mb-1">Total</p>
                            <p className="text-2xl font-bold text-emerald-400">{stats.total}</p>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="shrink-0 px-6 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            {Icons.search}
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por ID, nombre, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        />
                    </div>
                    
                    <select 
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value as EventFilter)}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="ALL">Todos los eventos</option>
                        <option value="login">🔐 Logins</option>
                        <option value="google_intruso">⛔ Intrusos</option>
                        <option value="google_verify">✓ Verificaciones</option>
                        <option value="confirmation">✅ Confirmaciones</option>
                        <option value="admin_action">🛡️ Admin</option>
                    </select>

                    {eventFilter !== 'ALL' && (
                        <button 
                            onClick={() => setEventFilter('ALL')}
                            className="text-cyan-300 hover:text-white text-sm px-3 py-2 bg-cyan-500/10 rounded-lg transition-colors"
                        >
                            ✕ Limpiar
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {selectedEvent ? (
                        /* DETAIL VIEW */
                        <div className="max-w-2xl mx-auto">
                            <button 
                                onClick={() => setSelectedEvent(null)}
                                className="flex items-center gap-2 text-cyan-300 hover:text-white text-sm mb-6 transition-colors"
                            >
                                {Icons.back}
                                Volver a la lista
                            </button>

                            <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 overflow-hidden">
                                <div className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/30 border-b border-slate-700/30">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-16 h-16 rounded-2xl ${getEventConfig(selectedEvent.type).bg} flex items-center justify-center text-3xl`}>
                                            {getEventConfig(selectedEvent.type).icon}
                                        </div>
                                        <div>
                                            <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${getEventConfig(selectedEvent.type).bg} ${getEventConfig(selectedEvent.type).color} mb-2`}>
                                                {getEventConfig(selectedEvent.type).label}
                                            </span>
                                            <p className="text-white font-semibold">{selectedEvent.studentName}</p>
                                            <p className="text-slate-500 text-sm">{formatFullDate(selectedEvent.timestamp)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs mb-1">ID Estudiante</p>
                                            <p className="text-white font-mono">{selectedEvent.studentId}</p>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs mb-1">Institución</p>
                                            <p className="text-white">{selectedEvent.institution}</p>
                                        </div>
                                    </div>

                                    {selectedEvent.details && (
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs mb-2">Detalles</p>
                                            <p className="text-white text-sm leading-relaxed">{selectedEvent.details}</p>
                                        </div>
                                    )}

                                    {selectedEvent.phone && (
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs mb-1">Teléfono</p>
                                            <p className="text-white font-mono">{selectedEvent.phone}</p>
                                        </div>
                                    )}

                                    {selectedEvent.userAgent && (
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs mb-1">User Agent</p>
                                            <p className="text-slate-300 text-xs font-mono break-all">{selectedEvent.userAgent}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* LIST VIEW */
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-sm">Cargando actividad...</p>
                            </div>
                        ) : filteredEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 text-3xl">📭</div>
                                <p className="text-sm">No hay eventos que mostrar</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredEvents.map((event, index) => {
                                    const config = getEventConfig(event.type);
                                    const isIntruso = event.type === 'google_intruso';
                                    
                                    return (
                                        <div 
                                            key={event.id || index}
                                            onClick={() => setSelectedEvent(event)}
                                            className={`rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 group ${
                                                isIntruso 
                                                    ? 'bg-red-900/20 hover:bg-red-900/30 border border-red-500/30 hover:border-red-500/50' 
                                                    : 'bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50'
                                            }`}
                                        >
                                            {/* Icon */}
                                            <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center text-lg shrink-0`}>
                                                {config.icon}
                                            </div>
                                            
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                                                        {config.label}
                                                    </span>
                                                    {isIntruso && (
                                                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold animate-pulse">
                                                            ¡ALERTA!
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-white font-medium truncate">{event.studentName}</p>
                                                <p className="text-slate-500 text-xs truncate">{event.details || `ID: ${event.studentId}`}</p>
                                            </div>

                                            {/* Time & Institution */}
                                            <div className="text-right shrink-0">
                                                <p className="text-slate-400 text-sm">{formatDate(event.timestamp)}</p>
                                                <p className="text-slate-600 text-xs">{event.institution}</p>
                                            </div>

                                            {/* Chevron */}
                                            <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-3 border-t border-white/5 bg-slate-900/30 flex items-center justify-between text-xs text-slate-500">
                    <span>Mostrando {filteredEvents.length} de {events.length} eventos</span>
                    <span className="text-slate-600">• Actualización en tiempo real</span>
                </div>
            </div>
        </div>
    );
}
