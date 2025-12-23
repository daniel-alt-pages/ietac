"use client";

import { useState, useEffect, useMemo } from 'react';
import {
    getAllStudentsFromFirestore,
    resetVerification,
    StudentDocument
} from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface VerificationReportProps {
    onClose: () => void;
}

type StatusFilter = 'ALL' | 'VERIFIED' | 'PENDING' | 'MISMATCH';

export default function VerificationReport({ onClose }: VerificationReportProps) {
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [selectedStudent, setSelectedStudent] = useState<StudentDocument | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { loadStudents(); }, []);

    async function loadStudents() {
        setLoading(true);
        const data = await getAllStudentsFromFirestore(false);
        setStudents(data);
        setLoading(false);
    }

    function showMessage(type: 'success' | 'error', text: string) {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    }

    const getName = (s: StudentDocument) => {
        const first = s.first || s.firstName || '';
        const last = s.last || s.lastName || '';
        return { first, last, full: `${first} ${last}`.trim() };
    };

    const getEmail = (s: StudentDocument) => {
        if (s.email) return s.email;
        if (s.emailNormalized) return s.emailNormalized;
        if (s.assignedEmail) return s.assignedEmail.replace('@gmail.com', '');
        return '';
    };

    const stats = useMemo(() => {
        const verified = students.filter(s => s.verificationStatus === 'VERIFIED').length;
        const pending = students.filter(s => (!s.verificationStatus || s.verificationStatus === 'PENDING')).length;
        const mismatch = students.filter(s => s.verificationStatus === 'MISMATCH').length;
        const total = students.length;
        const rate = total > 0 ? Math.round((verified / total) * 100) : 0;
        return { verified, pending, mismatch, total, rate };
    }, [students]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            if (statusFilter !== 'ALL') {
                const status = s.verificationStatus || 'PENDING';
                if (status !== statusFilter) return false;
            }
            const term = searchTerm.toLowerCase();
            if (!term) return true;
            const { first, last } = getName(s);
            const email = getEmail(s);
            return (
                s.studentId?.toLowerCase().includes(term) ||
                first.toLowerCase().includes(term) ||
                last.toLowerCase().includes(term) ||
                email.toLowerCase().includes(term) ||
                s.institution?.toLowerCase().includes(term) ||
                s.verifiedWithEmail?.toLowerCase().includes(term)
            );
        });
    }, [students, searchTerm, statusFilter]);

    async function handleManualVerify(studentId: string) {
        try {
            const studentsDoc = doc(db, 'students', studentId);
            await updateDoc(studentsDoc, {
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date().toISOString(),
                verifiedWithEmail: 'admin-manual-verification'
            });
            showMessage('success', 'Verificado manualmente ✓');
            loadStudents();
        } catch (error) {
            console.error('Error:', error);
            showMessage('error', 'Error al verificar');
        }
    }

    async function handleReset(studentId: string) {
        const success = await resetVerification(studentId);
        if (success) {
            showMessage('success', 'Reseteado a Pendiente');
            loadStudents();
        } else {
            showMessage('error', 'Error al resetear');
        }
    }

    function formatDate(dateStr: string | null | undefined): string {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CO', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        } catch { return dateStr; }
    }

    // 📊 Exportar a Excel
    function exportToExcel() {
        const data = filteredStudents.map(student => {
            const { first, last } = getName(student);
            const email = getEmail(student);
            const status = student.verificationStatus || 'PENDING';

            return {
                'ID': student.studentId || '',
                'Nombre': first,
                'Apellido': last,
                'Institución': student.institution || '',
                'Email Asignado': `${email}@gmail.com`,
                'Email Verificado': student.verifiedWithEmail || '',
                'Estado': status === 'VERIFIED' ? 'Verificado' : status === 'MISMATCH' ? 'Mismatch' : 'Pendiente',
                'Fecha Verificación': student.verifiedAt ? new Date(student.verifiedAt).toLocaleDateString('es-CO') : '',
                'Verificado Por': student.verifiedWithName || ''
            };
        });

        // Crear CSV
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${(row as Record<string, string>)[h] || ''}"`).join(','))
        ].join('\n');

        // Descargar
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Reporte_Verificacion_Google_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        showMessage('success', `Exportado ${data.length} registros a Excel`);
    }

    // Icons
    const Icons = {
        shield: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
        close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
        search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
        check: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
        refresh: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
        back: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
        download: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    };

    // Status Badge Component
    const StatusBadge = ({ status, large = false }: { status?: string; large?: boolean }) => {
        const config = {
            VERIFIED: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: '✓', label: 'Verificado' },
            MISMATCH: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '✕', label: 'Mismatch' },
            PENDING: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: '○', label: 'Pendiente' }
        }[status as string] || { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: '○', label: 'Pendiente' };

        return (
            <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} border ${config.border} ${large ? 'px-4 py-2 rounded-xl text-sm' : 'px-2.5 py-1 rounded-lg text-xs'} font-medium`}>
                <span>{config.icon}</span>
                {config.label}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-[#0f172a] rounded-2xl w-full max-w-5xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl shadow-blue-500/10 border border-white/5">

                {/* Professional Header */}
                <div className="shrink-0 bg-gradient-to-r from-[#0c4a6e] via-[#0369a1] to-[#0c4a6e] px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                {Icons.shield}
                            </div>
                            <div>
                                <h1 className="text-white font-semibold text-xl tracking-tight">Reporte de Verificación</h1>
                                <p className="text-blue-200/60 text-sm">Estado de confirmación de cuentas Google</p>
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

                {/* Stats Dashboard */}
                <div className="shrink-0 px-6 py-5 bg-slate-900/50 border-b border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Total */}
                        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/30">
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Total</p>
                            <p className="text-3xl font-bold text-white">{stats.total}</p>
                        </div>

                        {/* Verified */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'VERIFIED' ? 'ALL' : 'VERIFIED')}
                            className={`rounded-2xl p-4 text-left transition-all ${statusFilter === 'VERIFIED'
                                ? 'bg-emerald-500/20 border-2 border-emerald-500 scale-[1.02]'
                                : 'bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10'
                                }`}
                        >
                            <p className="text-emerald-300/70 text-xs font-medium uppercase tracking-wider mb-1">Verificados</p>
                            <p className="text-3xl font-bold text-emerald-400">{stats.verified}</p>
                        </button>

                        {/* Pending */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                            className={`rounded-2xl p-4 text-left transition-all ${statusFilter === 'PENDING'
                                ? 'bg-amber-500/20 border-2 border-amber-500 scale-[1.02]'
                                : 'bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10'
                                }`}
                        >
                            <p className="text-amber-300/70 text-xs font-medium uppercase tracking-wider mb-1">Pendientes</p>
                            <p className="text-3xl font-bold text-amber-400">{stats.pending}</p>
                        </button>

                        {/* Mismatch */}
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'MISMATCH' ? 'ALL' : 'MISMATCH')}
                            className={`rounded-2xl p-4 text-left transition-all ${statusFilter === 'MISMATCH'
                                ? 'bg-red-500/20 border-2 border-red-500 scale-[1.02]'
                                : 'bg-red-500/5 border border-red-500/20 hover:bg-red-500/10'
                                }`}
                        >
                            <p className="text-red-300/70 text-xs font-medium uppercase tracking-wider mb-1">Mismatch</p>
                            <p className="text-3xl font-bold text-red-400">{stats.mismatch}</p>
                        </button>

                        {/* Rate */}
                        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl p-4 border border-purple-500/20">
                            <p className="text-purple-300/70 text-xs font-medium uppercase tracking-wider mb-1">Tasa Éxito</p>
                            <p className="text-3xl font-bold text-purple-400">{stats.rate}%</p>
                        </div>
                    </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="shrink-0 px-6 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            {Icons.search}
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>
                    {statusFilter !== 'ALL' && (
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className="flex items-center gap-2 text-sm text-blue-300 hover:text-white px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl border border-blue-500/20 transition-colors"
                        >
                            <span>✕</span> Limpiar filtro
                        </button>
                    )}

                    {/* Export Button */}
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 text-sm text-white px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-medium"
                    >
                        {Icons.download}
                        <span>📊 Exportar Excel</span>
                    </button>
                </div>

                {/* Toast */}
                {message && (
                    <div className={`mx-6 mt-3 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/20'
                        }`}>
                        <span className="text-lg">{message.type === 'success' ? '✓' : '✕'}</span>
                        {message.text}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {selectedStudent ? (
                        /* DETAIL VIEW */
                        <div className="max-w-2xl mx-auto">
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-6 transition-colors"
                            >
                                {Icons.back}
                                Volver a la lista
                            </button>

                            <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 overflow-hidden">
                                {/* Header */}
                                <div className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/30 border-b border-slate-700/30">
                                    <div className="flex items-center gap-5">
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-3xl font-bold text-blue-300 border border-blue-500/20">
                                            {getName(selectedStudent).first.charAt(0)}{getName(selectedStudent).last.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-2xl text-white font-bold">{getName(selectedStudent).full}</h3>
                                            <p className="text-slate-400 text-sm mt-1">{selectedStudent.institution} • ID: {selectedStudent.studentId}</p>
                                            <div className="mt-3">
                                                <StatusBadge status={selectedStudent.verificationStatus} large />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Email Comparison */}
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">📧 Email Asignado</p>
                                            <p className="text-white font-mono text-sm break-all">{getEmail(selectedStudent)}@gmail.com</p>
                                        </div>
                                        <div className={`rounded-xl p-4 border ${selectedStudent.verificationStatus === 'VERIFIED'
                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                            : selectedStudent.verificationStatus === 'MISMATCH'
                                                ? 'bg-red-500/5 border-red-500/20'
                                                : 'bg-slate-900/50 border-slate-700/30'
                                            }`}>
                                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">🔐 Email Usado</p>
                                            <p className={`font-mono text-sm break-all ${selectedStudent.verificationStatus === 'VERIFIED'
                                                ? 'text-emerald-300'
                                                : selectedStudent.verificationStatus === 'MISMATCH'
                                                    ? 'text-red-300'
                                                    : 'text-slate-500'
                                                }`}>
                                                {selectedStudent.verifiedWithEmail === 'admin-manual-verification'
                                                    ? '(Verificación manual por admin)'
                                                    : selectedStudent.verifiedWithEmail || 'No ha intentado'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {selectedStudent.verificationStatus === 'MISMATCH' && (
                                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                            <p className="text-red-300 text-sm font-medium flex items-center gap-2">
                                                <span>⚠️</span>
                                                El estudiante usó un email diferente al asignado
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>Última verificación:</span>
                                        <span className="text-slate-400">{formatDate(selectedStudent.verifiedAt)}</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-4 border-t border-slate-700/30">
                                        {selectedStudent.verificationStatus !== 'VERIFIED' && (
                                            <button
                                                onClick={() => { handleManualVerify(selectedStudent.studentId); setSelectedStudent(null); }}
                                                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border border-emerald-500/20 transition-colors"
                                            >
                                                {Icons.check}
                                                Verificar Manualmente
                                            </button>
                                        )}
                                        {selectedStudent.verificationStatus !== 'PENDING' && (
                                            <button
                                                onClick={() => { handleReset(selectedStudent.studentId); setSelectedStudent(null); }}
                                                className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border border-amber-500/20 transition-colors"
                                            >
                                                {Icons.refresh}
                                                Resetear a Pendiente
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Activity Log */}
                                {selectedStudent.activityLog && selectedStudent.activityLog.length > 0 && (
                                    <div className="p-6 border-t border-slate-700/30">
                                        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                            <span>📜</span> Historial de Actividad
                                        </h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {selectedStudent.activityLog.slice().reverse().slice(0, 10).map((a, i) => (
                                                <div key={i} className="flex gap-3 text-xs bg-slate-900/30 p-3 rounded-xl border border-slate-700/20">
                                                    <span className="text-slate-500 shrink-0">{formatDate(a.timestamp)}</span>
                                                    <span className="text-slate-300">{a.details || a.type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* LIST VIEW */
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className="text-sm">Cargando verificaciones...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 text-3xl">🔍</div>
                                <p className="text-sm">No se encontraron estudiantes</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredStudents.map(student => {
                                    const { full, first } = getName(student);
                                    const email = getEmail(student);
                                    const status = student.verificationStatus || 'PENDING';

                                    return (
                                        <div
                                            key={student.studentId}
                                            onClick={() => setSelectedStudent(student)}
                                            className="bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4 border border-slate-700/30 hover:border-slate-600/50 group"
                                        >
                                            {/* Avatar */}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                status === 'MISMATCH' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                                    'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                                                }`}>
                                                {first.charAt(0) || '?'}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">{full}</p>
                                                <p className="text-slate-500 text-xs font-mono truncate">{email}@gmail.com</p>
                                            </div>

                                            {/* Email Usado (Desktop) */}
                                            <div className="hidden md:block text-right min-w-[180px]">
                                                {student.verifiedWithEmail && student.verifiedWithEmail !== 'admin-manual-verification' ? (
                                                    <p className={`text-xs font-mono truncate ${status === 'VERIFIED' ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                                        {student.verifiedWithEmail}
                                                    </p>
                                                ) : student.verifiedWithEmail === 'admin-manual-verification' ? (
                                                    <p className="text-xs text-purple-400/80">(Admin)</p>
                                                ) : null}
                                                <p className="text-slate-600 text-xs">{formatDate(student.verifiedAt)}</p>
                                            </div>

                                            {/* Status */}
                                            <StatusBadge status={status} />

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {status !== 'VERIFIED' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleManualVerify(student.studentId); }}
                                                        className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                                                        title="Verificar"
                                                    >
                                                        {Icons.check}
                                                    </button>
                                                )}
                                                {status !== 'PENDING' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleReset(student.studentId); }}
                                                        className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
                                                        title="Resetear"
                                                    >
                                                        {Icons.refresh}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-3 border-t border-white/5 bg-slate-900/30 flex items-center justify-between text-xs text-slate-500">
                    <span>Mostrando {filteredStudents.length} de {students.length} estudiantes</span>
                    <span className="text-slate-600">• Reporte de Verificación Google</span>
                </div>
            </div>
        </div>
    );
}
