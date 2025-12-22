"use client";

import { useState } from 'react';
import { studentData } from '@/lib/data';
import { seedStudentsToFirestore, getAllStudents, getVerificationStats, StudentDocument } from '@/lib/firebase';

export default function SeedPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [stats, setStats] = useState<{ total: number; verified: number; pending: number; rate: number } | null>(null);

    const handleSeed = async () => {
        setStatus('loading');
        try {
            const res = await seedStudentsToFirestore(studentData);
            setResult(res);
            setStatus('success');
            // Recargar datos
            await loadStudents();
        } catch (error) {
            console.error('Seed error:', error);
            setStatus('error');
        }
    };

    const loadStudents = async () => {
        const data = await getAllStudents();
        setStudents(data);
        const statsData = await getVerificationStats();
        setStats(statsData);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">🔧 Admin: Migración a Firestore</h1>
                <p className="text-slate-400 mb-8">Fase 1: Subir datos de estudiantes a la nube</p>

                {/* Información */}
                <div className="bg-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">📊 Datos en data.ts</h2>
                    <p className="text-slate-300">
                        Total de estudiantes en código: <span className="text-green-400 font-bold">{studentData.length}</span>
                    </p>
                    <ul className="mt-2 text-sm text-slate-400">
                        <li>• IETAC: {studentData.filter(s => s.institution === 'IETAC').length} estudiantes</li>
                        <li>• SG: {studentData.filter(s => s.institution === 'SG').length} estudiantes</li>
                    </ul>
                </div>

                {/* Botón de Seed */}
                <div className="bg-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">🚀 Ejecutar Migración</h2>
                    <p className="text-slate-400 mb-4">
                        Esto creará documentos en Firestore para cada estudiante con identificadores únicos.
                    </p>

                    <button
                        onClick={handleSeed}
                        disabled={status === 'loading'}
                        className={`px-6 py-3 rounded-xl font-bold transition-all ${status === 'loading'
                                ? 'bg-slate-600 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-500'
                            }`}
                    >
                        {status === 'loading' ? '⏳ Migrando...' : '📤 Migrar Estudiantes a Firestore'}
                    </button>

                    {status === 'success' && result && (
                        <div className="mt-4 p-4 bg-green-900/30 border border-green-500/30 rounded-xl">
                            <p className="text-green-400 font-bold">✅ Migración completada</p>
                            <p className="text-sm text-green-300">
                                {result.success} estudiantes creados, {result.errors} errores
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 font-bold">❌ Error en migración</p>
                            <p className="text-sm text-red-300">Revisa la consola para más detalles</p>
                        </div>
                    )}
                </div>

                {/* Verificar datos */}
                <div className="bg-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">🔍 Verificar Datos en Firestore</h2>
                    <button
                        onClick={loadStudents}
                        className="px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 transition-all"
                    >
                        📥 Cargar Estudiantes desde Firestore
                    </button>

                    {stats && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-700 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-white">{stats.total}</p>
                                <p className="text-xs text-slate-400">Total</p>
                            </div>
                            <div className="bg-green-900/30 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-green-400">{stats.verified}</p>
                                <p className="text-xs text-green-300">Verificados</p>
                            </div>
                            <div className="bg-amber-900/30 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                                <p className="text-xs text-amber-300">Pendientes</p>
                            </div>
                            <div className="bg-purple-900/30 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-purple-400">{stats.rate}%</p>
                                <p className="text-xs text-purple-300">Tasa Verif.</p>
                            </div>
                        </div>
                    )}

                    {students.length > 0 && (
                        <div className="mt-4 max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-700 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">Nombre</th>
                                        <th className="p-2 text-left">Institución</th>
                                        <th className="p-2 text-left">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.slice(0, 20).map((s) => (
                                        <tr key={s.studentId} className="border-t border-slate-700">
                                            <td className="p-2">{s.fullName}</td>
                                            <td className="p-2">{s.institution}</td>
                                            <td className="p-2">
                                                <span className={`px-2 py-1 rounded text-xs ${s.verificationStatus === 'VERIFIED'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-amber-500/20 text-amber-400'
                                                    }`}>
                                                    {s.verificationStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {students.length > 20 && (
                                <p className="text-center text-slate-500 text-sm mt-2">
                                    ... y {students.length - 20} más
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Volver */}
                <a
                    href="/"
                    className="inline-block px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
                >
                    ← Volver al inicio
                </a>
            </div>
        </div>
    );
}
