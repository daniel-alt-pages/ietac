"use client";

import { useState, useEffect, useMemo } from 'react';
import {
    StudentDocument,
    getAllStudentsFromFirestore
} from '@/lib/firebase';
import * as XLSX from 'xlsx';

interface GoogleVerificationReportProps {
    onClose: () => void;
}

type FilterStatus = 'ALL' | 'VERIFIED' | 'MISMATCH' | 'PENDING';
type FilterInstitution = 'ALL' | 'IETAC' | 'SG';

export default function GoogleVerificationReport({ onClose }: GoogleVerificationReportProps) {
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [institutionFilter, setInstitutionFilter] = useState<FilterInstitution>('ALL');
    const [copied, setCopied] = useState(false);

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

    // Get verification status
    function getStatus(s: StudentDocument): 'VERIFIED' | 'MISMATCH' | 'PENDING' {
        const verified = getVerifiedEmail(s);

        // Si ya está verificado con email, verificar si coincide
        if (s.verificationStatus === 'VERIFIED' && verified) return 'VERIFIED';

        // Si tiene estatus MISMATCH pero NO tiene email verificado, en realidad está PENDING
        if (s.verificationStatus === 'MISMATCH') {
            if (!verified) return 'PENDING'; // No ha verificado con ningún email
            // Sí tiene email verificado que no coincide
            const assigned = getAssignedEmail(s).toLowerCase().replace('@gmail.com', '');
            const usedNormalized = verified.toLowerCase().replace('@gmail.com', '');
            return assigned === usedNormalized ? 'VERIFIED' : 'MISMATCH';
        }

        if (s.verificationStatus === 'PENDING' || !s.verificationStatus) return 'PENDING';

        // Fallback: calcular basado en emails
        if (!verified) return 'PENDING';

        const assigned = getAssignedEmail(s).toLowerCase().replace('@gmail.com', '');
        const usedNormalized = verified.toLowerCase().replace('@gmail.com', '');
        return assigned === usedNormalized ? 'VERIFIED' : 'MISMATCH';
    }

    // Format date with time
    function formatDateTime(dateStr: string | null | undefined): string {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch {
            return dateStr;
        }
    }

    // Filtered and sorted data
    const filteredStudents = useMemo(() => {
        let filtered = students;

        // Filter by status
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(s => getStatus(s) === statusFilter);
        }

        // Filter by institution
        if (institutionFilter !== 'ALL') {
            filtered = filtered.filter(s => s.institution === institutionFilter);
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
    }, [students, statusFilter, institutionFilter, searchTerm]);

    // Stats
    const stats = useMemo(() => {
        const verified = students.filter(s => getStatus(s) === 'VERIFIED').length;
        const mismatch = students.filter(s => getStatus(s) === 'MISMATCH').length;
        const pending = students.filter(s => getStatus(s) === 'PENDING').length;
        const ietac = students.filter(s => s.institution === 'IETAC').length;
        const sg = students.filter(s => s.institution === 'SG').length;
        return { verified, mismatch, pending, total: students.length, ietac, sg };
    }, [students]);

    // Get name helper
    function getName(s: StudentDocument): string {
        const first = s.first || s.firstName || '';
        const last = s.last || s.lastName || '';
        return `${first} ${last}`.trim() || s.studentId;
    }

    // 📋 Copiar al portapapeles
    async function copyToClipboard() {
        const rows = filteredStudents.map(s => {
            const status = getStatus(s);
            return [
                s.studentId,
                getName(s),
                s.institution,
                getAssignedEmail(s),
                getVerifiedEmail(s) || '',
                s.verifiedWithName || '',
                status === 'VERIFIED' ? 'Verificado' : status === 'MISMATCH' ? 'No Coincide' : 'Pendiente',
                formatDateTime(s.verifiedAt)
            ].join('\t');
        });

        const header = ['ID', 'Nombre', 'Institución', 'Email Asignado', 'Email Google', 'Nombre Google', 'Estado', 'Fecha/Hora'].join('\t');
        const content = [header, ...rows].join('\n');

        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    }

    // 📊 Exportar a XLSX con estilos
    function exportToXLSX() {
        const data = filteredStudents.map(student => {
            const status = getStatus(student);
            const assignedEmail = getAssignedEmail(student);
            const usedEmail = getVerifiedEmail(student);

            return {
                'ID': student.studentId || '',
                'Nombre Completo': getName(student),
                'Institución': student.institution || '',
                'Email Asignado': assignedEmail,
                'Email Google': usedEmail || '',
                'Nombre en Google': student.verifiedWithName || '',
                'Estado': status === 'VERIFIED' ? '✓ Verificado' : status === 'MISMATCH' ? '✕ No Coincide' : '⏳ Pendiente',
                'Fecha y Hora': formatDateTime(student.verifiedAt)
            };
        });

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 12 },  // ID
            { wch: 30 },  // Nombre
            { wch: 10 },  // Institución
            { wch: 35 },  // Email Asignado
            { wch: 35 },  // Email Google
            { wch: 25 },  // Nombre Google
            { wch: 15 },  // Estado
            { wch: 22 }   // Fecha/Hora
        ];

        // Agregar hoja
        XLSX.utils.book_append_sheet(wb, ws, 'Verificación Google');

        // Descargar
        const fileName = `Verificacion_Google_${statusFilter !== 'ALL' ? statusFilter + '_' : ''}${institutionFilter !== 'ALL' ? institutionFilter + '_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">📧</span>
                            </div>
                            <div>
                                <h1 className="text-white font-bold text-xl">Reporte de Verificación Google</h1>
                                <p className="text-blue-100 text-sm">Email Asignado vs Email Usado • Tiempo exacto de verificación</p>
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

                {/* Stats Row */}
                <div className="shrink-0 px-6 py-4 bg-slate-50 border-b flex flex-wrap gap-2">
                    {/* Status Filters */}
                    <div className="flex gap-2 flex-wrap flex-1">
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            className={`rounded-xl px-4 py-2 text-center transition-all ${statusFilter === 'ALL' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-white border hover:bg-blue-50'}`}
                        >
                            <span className="font-bold">{stats.total}</span>
                            <span className="text-xs ml-1">Total</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('VERIFIED')}
                            className={`rounded-xl px-4 py-2 text-center transition-all ${statusFilter === 'VERIFIED' ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' : 'bg-white border hover:bg-emerald-50'}`}
                        >
                            <span className="font-bold">{stats.verified}</span>
                            <span className="text-xs ml-1">✓ OK</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('MISMATCH')}
                            className={`rounded-xl px-4 py-2 text-center transition-all ${statusFilter === 'MISMATCH' ? 'bg-red-500 text-white ring-2 ring-red-300' : 'bg-white border hover:bg-red-50'}`}
                        >
                            <span className="font-bold">{stats.mismatch}</span>
                            <span className="text-xs ml-1">✕ Error</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('PENDING')}
                            className={`rounded-xl px-4 py-2 text-center transition-all ${statusFilter === 'PENDING' ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-white border hover:bg-amber-50'}`}
                        >
                            <span className="font-bold">{stats.pending}</span>
                            <span className="text-xs ml-1">⏳ Pend.</span>
                        </button>
                    </div>

                    {/* Institution Filter */}
                    <div className="flex gap-2 border-l pl-4">
                        <button
                            onClick={() => setInstitutionFilter('ALL')}
                            className={`rounded-xl px-4 py-2 transition-all ${institutionFilter === 'ALL' ? 'bg-purple-500 text-white' : 'bg-white border hover:bg-purple-50'}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setInstitutionFilter('IETAC')}
                            className={`rounded-xl px-4 py-2 transition-all ${institutionFilter === 'IETAC' ? 'bg-purple-500 text-white' : 'bg-white border hover:bg-purple-50'}`}
                        >
                            IETAC ({stats.ietac})
                        </button>
                        <button
                            onClick={() => setInstitutionFilter('SG')}
                            className={`rounded-xl px-4 py-2 transition-all ${institutionFilter === 'SG' ? 'bg-purple-500 text-white' : 'bg-white border hover:bg-purple-50'}`}
                        >
                            SG ({stats.sg})
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="shrink-0 px-6 py-3 border-b flex gap-3">
                    <input
                        type="text"
                        placeholder="🔍 Buscar por nombre, ID o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="px-3 py-2 text-slate-500 hover:text-slate-700 border rounded-lg hover:bg-slate-50"
                        >
                            Limpiar
                        </button>
                    )}
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
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-100 text-left text-xs font-medium text-slate-600 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Estudiante</th>
                                    <th className="px-4 py-3">📧 Email Asignado</th>
                                    <th className="px-4 py-3">🔐 Email Google</th>
                                    <th className="px-4 py-3">👤 Nombre Google</th>
                                    <th className="px-4 py-3">🕐 Fecha/Hora</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-3 py-3 text-center w-12">
                                        <svg className="w-4 h-4 mx-auto text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student) => {
                                    const status = getStatus(student);
                                    const assignedEmail = getAssignedEmail(student);
                                    const usedEmail = getVerifiedEmail(student);
                                    const registeredName = getName(student);

                                    return (
                                        <tr key={student.studentId} className={`hover:bg-slate-50 ${status === 'MISMATCH' ? 'bg-red-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-slate-800">{registeredName}</p>
                                                    <p className="text-xs text-slate-500">ID: {student.studentId} • {student.institution}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-slate-700 font-mono text-xs break-all">{assignedEmail}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                {usedEmail ? (
                                                    <p className={`font-mono text-xs break-all ${status === 'VERIFIED' ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                                                        {usedEmail}
                                                    </p>
                                                ) : (
                                                    <p className="text-slate-400 italic text-xs">Sin verificar</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {student.verifiedWithName ? (
                                                    <p className="text-slate-700 text-xs">{student.verifiedWithName}</p>
                                                ) : (
                                                    <p className="text-slate-400 text-xs">-</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-slate-600 text-xs font-mono">
                                                    {formatDateTime(student.verifiedAt)}
                                                </p>
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
                                            {/* Individual contact button */}
                                            <td className="px-3 py-3 text-center">
                                                {status !== 'VERIFIED' && student.phone ? (
                                                    <button
                                                        onClick={() => {
                                                            const name = registeredName.replace(/^(SG|IETAC)\s*-\s*/i, '');
                                                            const phone = student.phone?.replace(/\D/g, '');
                                                            let message = '';

                                                            if (status === 'MISMATCH') {
                                                                message = encodeURIComponent(
                                                                    `¡Hola ${name}!\n\n` +
                                                                    `Notamos que verificaste tu cuenta con un correo diferente al asignado.\n\n` +
                                                                    `Correo asignado: ${assignedEmail}\n` +
                                                                    `Correo usado: ${usedEmail || 'otro correo'}\n\n` +
                                                                    `Por favor, ingresa nuevamente y verifica con el correo correcto.\n\n` +
                                                                    `https://seamosgenios-portal.web.app`
                                                                );
                                                            } else {
                                                                message = encodeURIComponent(
                                                                    `¡Hola ${name}!\n\n` +
                                                                    `Te recordamos que aún no has verificado tu cuenta institucional.\n\n` +
                                                                    `Tu correo asignado es:\n${assignedEmail}\n\n` +
                                                                    `Para activar tu cuenta ingresa a:\nhttps://seamosgenios-portal.web.app\n\n` +
                                                                    `Usa tu cédula y fecha de nacimiento para ingresar.`
                                                                );
                                                            }

                                                            window.open(`https://wa.me/57${phone}?text=${message}`, '_blank');
                                                        }}
                                                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-110 shadow-sm ${status === 'MISMATCH'
                                                            ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                                                            : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                                                            }`}
                                                        title={status === 'MISMATCH' ? 'Contactar - Corregir error' : 'Contactar - Recordatorio'}
                                                    >
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                        </svg>
                                                    </button>
                                                ) : (
                                                    <span className="w-9 h-9 inline-block"></span>
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
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-slate-500">
                            Mostrando <strong>{filteredStudents.length}</strong> de {stats.total}
                            {institutionFilter !== 'ALL' && <span className="ml-1 text-purple-600">({institutionFilter})</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={copyToClipboard}
                            className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${copied
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                        >
                            {copied ? '✓ Copiado!' : '📋 Copiar'}
                        </button>
                        <button
                            onClick={exportToXLSX}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-lg transition-all font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            📊 Excel
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-all font-medium"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
