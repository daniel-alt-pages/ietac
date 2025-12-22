"use client";

import { useState, useEffect, useMemo } from 'react';
import {
    StudentDocument,
    getAllStudentsFromFirestore
} from '@/lib/firebase';

interface GoogleVerificationReportProps {
    onClose: () => void;
}

type FilterStatus = 'ALL' | 'VERIFIED' | 'MISMATCH' | 'PENDING';

export default function GoogleVerificationReport({ onClose }: GoogleVerificationReportProps) {
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

    useEffect(() => {
        loadStudents();
    }, []);

    async function loadStudents() {
        setLoading(true);
        const data = await getAllStudentsFromFirestore();
        setStudents(data.filter(s => !s.deleted));
        setLoading(false);
    }

    // Helper to get email
    function getAssignedEmail(s: StudentDocument): string {
        const email = s.email || s.emailNormalized || s.assignedEmail || '';
        if (!email) return 'Sin asignar';
        return email.includes('@') ? email : `${email}@gmail.com`;
    }

    // Helper to get verified email
    function getVerifiedEmail(s: StudentDocument): string | null {
        return s.verifiedWithEmail || s.googleEmail || null;
    }

    // Get verification status - CORREGIDO para usar verificationStatus de Firestore
    function getStatus(s: StudentDocument): 'VERIFIED' | 'MISMATCH' | 'PENDING' {
        // Prioridad 1: Usar verificationStatus de Firestore si existe
        if (s.verificationStatus === 'VERIFIED') return 'VERIFIED';
        if (s.verificationStatus === 'MISMATCH') return 'MISMATCH';
        if (s.verificationStatus === 'PENDING') return 'PENDING';

        // Fallback: Calcular basado en emails (para datos legacy)
        const assigned = getAssignedEmail(s).toLowerCase().replace('@gmail.com', '');
        const verified = getVerifiedEmail(s);

        if (!verified) return 'PENDING';

        const usedNormalized = verified.toLowerCase().replace('@gmail.com', '');
        return assigned === usedNormalized ? 'VERIFIED' : 'MISMATCH';
    }

    // Filtered and sorted data
    const filteredStudents = useMemo(() => {
        let filtered = students;

        // Filter by status
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(s => getStatus(s) === statusFilter);
        }

        // Filter by search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.studentId.toLowerCase().includes(term) ||
                (s.first || s.firstName || '').toLowerCase().includes(term) ||
                (s.last || s.lastName || '').toLowerCase().includes(term) ||
                getAssignedEmail(s).toLowerCase().includes(term) ||
                (getVerifiedEmail(s) || '').toLowerCase().includes(term)
            );
        }

        // Sort: MISMATCH first, then PENDING, then VERIFIED
        return filtered.sort((a, b) => {
            const order = { MISMATCH: 0, PENDING: 1, VERIFIED: 2 };
            return order[getStatus(a)] - order[getStatus(b)];
        });
    }, [students, statusFilter, searchTerm]);

    // Stats
    const stats = useMemo(() => {
        const verified = students.filter(s => getStatus(s) === 'VERIFIED').length;
        const mismatch = students.filter(s => getStatus(s) === 'MISMATCH').length;
        const pending = students.filter(s => getStatus(s) === 'PENDING').length;
        return { verified, mismatch, pending, total: students.length };
    }, [students]);

    // Get name helper
    function getName(s: StudentDocument): string {
        const first = s.first || s.firstName || '';
        const last = s.last || s.lastName || '';
        return `${first} ${last}`.trim() || s.studentId;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">📧</span>
                            </div>
                            <div>
                                <h1 className="text-white font-bold text-xl">Reporte de Verificación Google</h1>
                                <p className="text-blue-100 text-sm">Email Asignado vs Email Usado</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setLoading(true); loadStudents(); }}
                                disabled={loading}
                                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all disabled:opacity-50"
                                title="Refrescar datos"
                            >
                                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="shrink-0 px-6 py-4 bg-slate-50 border-b grid grid-cols-4 gap-3">
                    <button
                        onClick={() => setStatusFilter('ALL')}
                        className={`rounded-xl p-3 text-center transition-all ${statusFilter === 'ALL' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-white border hover:bg-blue-50'}`}
                    >
                        <p className="text-2xl font-bold">{stats.total}</p>
                        <p className="text-xs">Total</p>
                    </button>
                    <button
                        onClick={() => setStatusFilter('VERIFIED')}
                        className={`rounded-xl p-3 text-center transition-all ${statusFilter === 'VERIFIED' ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' : 'bg-white border hover:bg-emerald-50'}`}
                    >
                        <p className="text-2xl font-bold">{stats.verified}</p>
                        <p className="text-xs">✓ Coinciden</p>
                    </button>
                    <button
                        onClick={() => setStatusFilter('MISMATCH')}
                        className={`rounded-xl p-3 text-center transition-all ${statusFilter === 'MISMATCH' ? 'bg-red-500 text-white ring-2 ring-red-300' : 'bg-white border hover:bg-red-50'}`}
                    >
                        <p className="text-2xl font-bold">{stats.mismatch}</p>
                        <p className="text-xs">✕ No coinciden</p>
                    </button>
                    <button
                        onClick={() => setStatusFilter('PENDING')}
                        className={`rounded-xl p-3 text-center transition-all ${statusFilter === 'PENDING' ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-white border hover:bg-amber-50'}`}
                    >
                        <p className="text-2xl font-bold">{stats.pending}</p>
                        <p className="text-xs">⏳ Sin verificar</p>
                    </button>
                </div>

                {/* Search */}
                <div className="shrink-0 px-6 py-3 border-b">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, ID o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-16 text-slate-400">
                            <p className="text-4xl mb-2">📭</p>
                            <p>No hay estudiantes que coincidan</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-100 text-left text-xs font-medium text-slate-600 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Estudiante Registrado</th>
                                    <th className="px-4 py-3">📧 Email Asignado</th>
                                    <th className="px-4 py-3">🔐 Email Usado (Google)</th>
                                    <th className="px-4 py-3">👤 Nombre en Email Usado</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student) => {
                                    const status = getStatus(student);
                                    const assignedEmail = getAssignedEmail(student);
                                    const usedEmail = getVerifiedEmail(student);

                                    // Extract name from the used email (e.g., "sg.estudiante.maria.lopez" -> "Maria Lopez")
                                    const extractNameFromEmail = (email: string | null): string => {
                                        if (!email) return '-';
                                        const username = email.split('@')[0];
                                        // Try to extract name parts from common patterns
                                        const parts = username.replace(/^(sg|ietac|estudiante|adm)[._-]*/gi, '')
                                            .split(/[._-]/)
                                            .filter(p => p.length > 1)
                                            .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
                                        return parts.length > 0 ? parts.join(' ') : username;
                                    };

                                    const nameFromEmail = student.verifiedWithName || extractNameFromEmail(usedEmail);
                                    const registeredName = getName(student);

                                    // Check if names match (loosely)
                                    const nameMatch = usedEmail ?
                                        registeredName.toLowerCase().split(' ').some(part =>
                                            nameFromEmail.toLowerCase().includes(part)
                                        ) : null;

                                    return (
                                        <tr key={student.studentId} className={`hover:bg-slate-50 ${status === 'MISMATCH' ? 'bg-red-50' : ''
                                            }`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-slate-800">{registeredName}</p>
                                                    <p className="text-xs text-slate-500">ID: {student.studentId} • {student.institution}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-slate-700 font-mono break-all">{assignedEmail}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                {usedEmail ? (
                                                    <p className={`text-sm font-mono break-all ${status === 'VERIFIED' ? 'text-emerald-600' : 'text-red-600 font-bold'
                                                        }`}>
                                                        {usedEmail}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic">Sin verificar</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {usedEmail ? (
                                                    <div>
                                                        <p className={`text-sm font-medium ${nameMatch ? 'text-emerald-600' : 'text-orange-600'
                                                            }`}>
                                                            {nameFromEmail}
                                                        </p>
                                                        {nameMatch === false && (
                                                            <p className="text-xs text-orange-500">⚠️ Nombre diferente</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400">-</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {status === 'VERIFIED' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                                                        ✓ OK
                                                    </span>
                                                )}
                                                {status === 'MISMATCH' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                                        ✕ Error
                                                    </span>
                                                )}
                                                {status === 'PENDING' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                                        ⏳
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando {filteredStudents.length} de {stats.total} estudiantes
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-all font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
