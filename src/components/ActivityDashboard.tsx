"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
    subscribeToActivityEvents,
    subscribeToStudents,
    getStudentsSummary,
    ActivityEvent,
    StudentDocument,
    StudentSummary
} from '@/lib/firebase';
import StudentActivityProfile from './StudentProfile';

interface ActivityDashboardProps {
    onClose: () => void;
}

type ViewFilter = 'all' | 'IETAC' | 'SG' | 'verified' | 'pending' | 'alerts';
type TimeFilter = 'today' | 'week' | 'month' | 'all';

export default function ActivityDashboard({ onClose }: ActivityDashboardProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
    const [selectedStudent, setSelectedStudent] = useState<StudentDocument | null>(null);

    // Subscribe to data
    useEffect(() => {
        const unsubEvents = subscribeToActivityEvents((data) => {
            setEvents(data);
        }, 1000);

        const unsubStudents = subscribeToStudents((data) => {
            setStudents(data);
            setLoading(false);
        });

        return () => {
            unsubEvents();
            unsubStudents();
        };
    }, []);

    // Get student summaries
    const studentSummaries = useMemo(() => {
        return getStudentsSummary(events, students);
    }, [events, students]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = studentSummaries.length;
        const verified = studentSummaries.filter(s => s.verificationStatus === 'VERIFIED').length;
        const pending = studentSummaries.filter(s => s.verificationStatus === 'PENDING').length;
        const alerts = studentSummaries.filter(s => s.hasAlerts).length;
        const rate = total > 0 ? Math.round((verified / total) * 100) : 0;

        // Today's activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEvents = events.filter(e => new Date(e.timestamp) >= today);
        const activeToday = new Set(todayEvents.map(e => e.studentId)).size;

        return { total, verified, pending, alerts, rate, activeToday };
    }, [studentSummaries, events]);

    // Filtered summaries
    const filteredSummaries = useMemo(() => {
        let filtered = studentSummaries;

        // Filter by view
        switch (viewFilter) {
            case 'IETAC':
                filtered = filtered.filter(s => s.institution === 'IETAC');
                break;
            case 'SG':
                filtered = filtered.filter(s => s.institution === 'SG' || s.institution === 'Seamos Genios');
                break;
            case 'verified':
                filtered = filtered.filter(s => s.verificationStatus === 'VERIFIED');
                break;
            case 'pending':
                filtered = filtered.filter(s => s.verificationStatus === 'PENDING');
                break;
            case 'alerts':
                filtered = filtered.filter(s => s.hasAlerts);
                break;
        }

        // Filter by time
        if (timeFilter !== 'all') {
            const now = new Date();
            let cutoff: Date;
            switch (timeFilter) {
                case 'today':
                    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    cutoff = new Date(0);
            }
            filtered = filtered.filter(s => s.lastActivity && new Date(s.lastActivity) >= cutoff);
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s => 
                s.studentId.toLowerCase().includes(term) ||
                s.studentName.toLowerCase().includes(term) ||
                s.institution.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [studentSummaries, viewFilter, timeFilter, searchTerm]);

    // Format relative time
    function formatRelativeTime(dateStr: string): string {
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

    // Get status badge
    function getStatusBadge(summary: StudentSummary) {
        if (summary.hasAlerts) {
            return { label: 'Alerta', bg: 'bg-red-100', text: 'text-red-700', icon: '⚠️' };
        }
        switch (summary.verificationStatus) {
            case 'VERIFIED':
                return { label: 'Verificado', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓' };
            case 'PENDING':
                return { label: 'Pendiente', bg: 'bg-amber-100', text: 'text-amber-700', icon: '⏳' };
            case 'MISMATCH':
                return { label: 'Mismatch', bg: 'bg-orange-100', text: 'text-orange-700', icon: '⚡' };
            default:
                return { label: 'Desconocido', bg: 'bg-slate-100', text: 'text-slate-700', icon: '?' };
        }
    }

    // Find full student data or create from summary
    function findOrCreateStudent(summary: StudentSummary): StudentDocument {
        const existing = students.find(s => s.studentId === summary.studentId);
        if (existing) return existing;
        
        // Create a StudentDocument from summary data
        return {
            studentId: summary.studentId,
            first: summary.studentName.split(' ')[0] || summary.studentId,
            last: summary.studentName.split(' ').slice(1).join(' ') || '',
            institution: summary.institution,
            phone: summary.phone || '',
            email: '',
            password: '',
            verificationStatus: summary.verificationStatus
        };
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
                
                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-white font-semibold text-xl tracking-tight">Centro de Monitoreo</h1>
                                <p className="text-cyan-200/60 text-sm">Seguimiento de estudiantes en tiempo real</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="shrink-0 px-6 py-4 bg-slate-800/50 border-b border-white/5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <button
                            onClick={() => setViewFilter('all')}
                            className={`rounded-xl p-3 text-center transition-all ${viewFilter === 'all' ? 'bg-cyan-500/20 ring-2 ring-cyan-500' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            <p className="text-2xl font-bold text-white">{stats.total}</p>
                            <p className="text-xs text-slate-400">Total</p>
                        </button>
                        <button
                            onClick={() => setViewFilter('verified')}
                            className={`rounded-xl p-3 text-center transition-all ${viewFilter === 'verified' ? 'bg-emerald-500/20 ring-2 ring-emerald-500' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            <p className="text-2xl font-bold text-emerald-400">{stats.verified}</p>
                            <p className="text-xs text-slate-400">Verificados</p>
                        </button>
                        <button
                            onClick={() => setViewFilter('pending')}
                            className={`rounded-xl p-3 text-center transition-all ${viewFilter === 'pending' ? 'bg-amber-500/20 ring-2 ring-amber-500' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                            <p className="text-xs text-slate-400">Pendientes</p>
                        </button>
                        <button
                            onClick={() => setViewFilter('alerts')}
                            className={`rounded-xl p-3 text-center transition-all ${viewFilter === 'alerts' ? 'bg-red-500/20 ring-2 ring-red-500' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            <p className="text-2xl font-bold text-red-400">{stats.alerts}</p>
                            <p className="text-xs text-slate-400">Alertas</p>
                        </button>
                        <div className="rounded-xl p-3 bg-white/5 text-center">
                            <p className="text-2xl font-bold text-blue-400">{stats.activeToday}</p>
                            <p className="text-xs text-slate-400">Activos hoy</p>
                        </div>
                        <div className="rounded-xl p-3 bg-white/5 text-center">
                            <p className="text-2xl font-bold text-purple-400">{stats.rate}%</p>
                            <p className="text-xs text-slate-400">Tasa verif.</p>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="shrink-0 px-6 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] relative">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                        />
                    </div>

                    {/* Institution filter */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewFilter(viewFilter === 'IETAC' ? 'all' : 'IETAC')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${viewFilter === 'IETAC' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                        >
                            IETAC
                        </button>
                        <button
                            onClick={() => setViewFilter(viewFilter === 'SG' ? 'all' : 'SG')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${viewFilter === 'SG' ? 'bg-pink-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                        >
                            SG
                        </button>
                    </div>

                    {/* Time filter */}
                    <select 
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                    >
                        <option value="today">Hoy</option>
                        <option value="week">Esta semana</option>
                        <option value="month">Este mes</option>
                        <option value="all">Todo el tiempo</option>
                    </select>

                    {viewFilter !== 'all' && (
                        <button 
                            onClick={() => setViewFilter('all')}
                            className="text-cyan-300 hover:text-white text-sm px-3 py-2 bg-cyan-500/10 rounded-lg"
                        >
                            ✕ Limpiar filtro
                        </button>
                    )}
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-sm">Cargando estudiantes...</p>
                        </div>
                    ) : filteredSummaries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-3xl">📭</div>
                            <p className="text-sm">No hay estudiantes que coincidan</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSummaries.map((summary) => {
                                const badge = getStatusBadge(summary);
                                const initials = summary.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
                                
                                return (
                                    <div 
                                        key={summary.studentId}
                                        onClick={() => setSelectedStudent(findOrCreateStudent(summary))}
                                        className={`rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 group hover:scale-[1.01] ${
                                            summary.hasAlerts
                                                ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30'
                                                : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${
                                            summary.verificationStatus === 'VERIFIED'
                                                ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                                                : summary.hasAlerts
                                                    ? 'bg-gradient-to-br from-red-400 to-red-600'
                                                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                                        }`}>
                                            {initials}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-medium text-white truncate">{summary.studentName}</h3>
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
                                                    {badge.icon} {badge.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span>ID: {summary.studentId}</span>
                                                <span>•</span>
                                                <span>{summary.institution}</span>
                                                {summary.deviceType && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{summary.deviceType === 'mobile' ? '📱' : summary.deviceType === 'tablet' ? '📟' : '🖥️'} {summary.browser || ''}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right side */}
                                        <div className="text-right shrink-0">
                                            <p className="text-sm text-slate-300">
                                                {summary.lastActivity ? formatRelativeTime(summary.lastActivity) : 'Sin actividad'}
                                            </p>
                                            <p className="text-xs text-slate-500">{summary.totalEvents} eventos</p>
                                        </div>

                                        {/* Arrow */}
                                        <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-3 border-t border-white/5 bg-slate-800/30 flex items-center justify-between text-xs text-slate-500">
                    <span>Mostrando {filteredSummaries.length} de {studentSummaries.length} estudiantes</span>
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Actualización en tiempo real
                    </span>
                </div>
            </div>

            {/* Student Profile Modal */}
            {selectedStudent && (
                <StudentActivityProfile 
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
}
