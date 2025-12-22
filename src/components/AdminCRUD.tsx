"use client";

import { useState, useEffect, useMemo } from 'react';
import {
    createStudent,
    updateStudentCRUD,
    deleteStudent,
    restoreStudent,
    generateDeletionToken,
    getAllStudentsFromFirestore,
    optimizeFirestoreUsage,
    syncStudentsToFirestore,
    StudentCRUDData,
    StudentDocument
} from '@/lib/firebase';
import { doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { studentData } from '@/lib/data';

interface AdminCRUDProps {
    adminId: string;
    onClose: () => void;
    fixedInstitution?: string; // Optional: Restrict to institution
}

type CRUDMode = 'list' | 'create' | 'edit' | 'delete' | 'change-id';

export default function AdminCRUD({ adminId, onClose, fixedInstitution }: AdminCRUDProps) {
    const [mode, setMode] = useState<CRUDMode>('list');
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState<StudentCRUDData>({
        id: '', first: '', last: '', birth: '', gender: 'M',
        email: '', password: '', phone: '', institution: fixedInstitution || 'IETAC'
    });

    // Original ID (for editing)
    const [originalId, setOriginalId] = useState('');

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<StudentDocument | null>(null);
    const [deletionToken, setDeletionToken] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [tokenExpiry, setTokenExpiry] = useState(60);

    // ID Change confirmation state
    const [idChangeToken, setIdChangeToken] = useState('');
    const [idChangeTokenInput, setIdChangeTokenInput] = useState('');
    const [idChangeExpiry, setIdChangeExpiry] = useState(60);
    const [pendingIdChange, setPendingIdChange] = useState<{ oldId: string; newId: string; data: StudentCRUDData } | null>(null);

    useEffect(() => { loadStudents(); }, [showDeleted]);

    useEffect(() => {
        if (deletionToken && tokenExpiry > 0) {
            const timer = setInterval(() => {
                setTokenExpiry(prev => {
                    if (prev <= 1) { setDeletionToken(''); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [deletionToken, tokenExpiry]);

    useEffect(() => {
        if (idChangeToken && idChangeExpiry > 0) {
            const timer = setInterval(() => {
                setIdChangeExpiry(prev => {
                    if (prev <= 1) { setIdChangeToken(''); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [idChangeToken, idChangeExpiry]);

    async function loadStudents() {
        setLoading(true);
        const data = await getAllStudentsFromFirestore(showDeleted);
        setStudents(data);
        setLoading(false);
    }

    async function handleSyncStudents() {
        setSyncing(true);
        try {
            const studentsToSync = studentData.map(s => ({
                id: s.id,
                first: s.first,
                last: s.last,
                birth: s.birth,
                gender: s.gender as 'M' | 'F',
                email: s.email,
                password: s.password,
                phone: s.phone,
                institution: s.institution
            }));

            const result = await syncStudentsToFirestore(studentsToSync);
            showMessage('success', `Sincronizado: ${result.created} creados, ${result.updated} actualizados`);
            loadStudents();
        } catch (error) {
            console.error('Error syncing:', error);
            showMessage('error', 'Error al sincronizar');
        } finally {
            setSyncing(false);
        }
    }

    function showMessage(type: 'success' | 'error', text: string) {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
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

    const getPassword = (s: StudentDocument) => s.password || s.assignedPassword || '';

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            if (fixedInstitution && s.institution !== fixedInstitution) return false;

            const term = searchTerm.toLowerCase();
            if (!term) return true;
            const { first, last } = getName(s);
            const email = getEmail(s);
            return (
                s.studentId?.toLowerCase().includes(term) ||
                first.toLowerCase().includes(term) ||
                last.toLowerCase().includes(term) ||
                email.toLowerCase().includes(term) ||
                s.institution?.toLowerCase().includes(term)
            );
        });
    }, [students, searchTerm, fixedInstitution]);

    function generateIdChangeToken(oldId: string, newId: string): string {
        const combined = `${oldId}-${newId}-${adminId}`;
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash % 900000 + 100000).toString();
    }

    async function handleCreate() {
        if (!formData.id || !formData.first || !formData.last || !formData.email) {
            showMessage('error', 'Completa todos los campos obligatorios.');
            return;
        }
        const result = await createStudent(formData);
        if (result.success) {
            showMessage('success', result.message);
            setMode('list'); loadStudents(); resetForm();
        } else {
            showMessage('error', result.message);
        }
    }

    async function handleUpdate() {
        if (!formData.id) return;

        if (formData.id !== originalId) {
            const token = generateIdChangeToken(originalId, formData.id);
            setIdChangeToken(token);
            setIdChangeExpiry(60);
            setIdChangeTokenInput('');
            setPendingIdChange({ oldId: originalId, newId: formData.id, data: formData });
            setMode('change-id');
            return;
        }

        const result = await updateStudentCRUD(formData.id, formData);
        if (result.success) {
            showMessage('success', result.message);
            setMode('list'); loadStudents(); resetForm();
        } else {
            showMessage('error', result.message);
        }
    }

    async function handleIdChangeConfirm() {
        if (!pendingIdChange || idChangeTokenInput !== idChangeToken) {
            showMessage('error', 'Código incorrecto');
            return;
        }

        try {
            const { oldId, newId, data } = pendingIdChange;

            // Verificar que el nuevo ID no exista
            const newDocRef = doc(db, 'students', newId);
            const newDocSnap = await getDoc(newDocRef);
            if (newDocSnap.exists()) {
                showMessage('error', `Ya existe un estudiante con ID ${newId}`);
                return;
            }

            // Buscar datos del estudiante (Firestore o data.ts local)
            const oldDocRef = doc(db, 'students', oldId);
            const oldDocSnap = await getDoc(oldDocRef);

            let oldData: Record<string, unknown> = {};

            if (oldDocSnap.exists()) {
                // Estudiante existe en Firestore
                oldData = oldDocSnap.data();
            } else {
                // Estudiante viene de data.ts - usar los datos del formulario
                oldData = {
                    studentId: oldId,
                    first: data.first,
                    last: data.last,
                    email: data.email,
                    password: data.password,
                    birth: data.birth,
                    gender: data.gender,
                    phone: data.phone,
                    institution: data.institution,
                    verificationStatus: 'PENDING',
                    createdAt: new Date().toISOString()
                };
            }

            // Crear documento con nuevo ID
            await setDoc(newDocRef, {
                ...oldData,
                studentId: newId,
                first: data.first,
                last: data.last,
                birth: data.birth,
                gender: data.gender,
                email: data.email,
                password: data.password,
                phone: data.phone,
                institution: data.institution,
                assignedEmail: `${data.email}@gmail.com`,
                updatedAt: new Date().toISOString(),
                idChangedFrom: oldId,
                idChangedAt: new Date().toISOString(),
                idChangedBy: adminId
            });

            // Eliminar documento antiguo solo si existía en Firestore
            if (oldDocSnap.exists()) {
                await deleteDoc(oldDocRef);
            }

            showMessage('success', `ID cambiado: ${oldId} → ${newId}`);
            setMode('list');
            loadStudents();
            resetForm();
            setPendingIdChange(null);
            setIdChangeToken('');
        } catch (error) {
            console.error('Error changing ID:', error);
            showMessage('error', 'Error al cambiar el ID');
        }
    }

    function handleDeleteRequest(student: StudentDocument) {
        setDeleteTarget(student);
        setDeletionToken(generateDeletionToken(student.studentId, adminId));
        setTokenExpiry(60);
        setTokenInput('');
        setMode('delete');
    }

    async function handleDeleteConfirm() {
        if (!deleteTarget) return;
        const result = await deleteStudent(deleteTarget.studentId, tokenInput, adminId);
        if (result.success) {
            showMessage('success', result.message);
            setMode('list'); loadStudents();
            setDeleteTarget(null); setDeletionToken('');
        } else {
            showMessage('error', result.message);
        }
    }

    async function handleRestore(studentId: string) {
        const result = await restoreStudent(studentId, adminId);
        if (result.success) { showMessage('success', result.message); loadStudents(); }
        else { showMessage('error', result.message); }
    }

    function handleEdit(student: StudentDocument) {
        const { first, last } = getName(student);
        const id = student.studentId;
        setOriginalId(id);
        setFormData({
            id, first, last,
            birth: student.birth || '', gender: student.gender || 'M',
            email: getEmail(student), password: getPassword(student),
            phone: student.phone || '', institution: student.institution || fixedInstitution || 'IETAC'
        });
        setMode('edit');
    }

    function resetForm() {
        setFormData({ id: '', first: '', last: '', birth: '', gender: 'M', email: '', password: '', phone: '', institution: fixedInstitution || 'IETAC' });
        setOriginalId('');
    }

    // Icon components for cleaner code
    const Icons = {
        users: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
        plus: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
        warning: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        edit: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        trash: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
        restore: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-[#0f172a] rounded-2xl w-full max-w-5xl max-h-[98vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10 border border-white/5">

                {/* Professional Header */}
                <div className="shrink-0 bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] px-6 py-5 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                {Icons.users}
                            </div>
                            <div>
                                <h1 className="text-white font-semibold text-xl tracking-tight">Gestión de Estudiantes</h1>
                                <p className="text-purple-300/60 text-sm">Panel de administración • CRUD</p>
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

                {/* Toast Message */}
                {message && (
                    <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 animate-slideDown ${message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-300 border border-red-500/20'
                        }`}>
                        <span className="text-lg">{message.type === 'success' ? '✓' : '✕'}</span>
                        {message.text}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* LIST MODE */}
                    {mode === 'list' && (
                        <div className="space-y-5">
                            {/* Action Bar */}
                            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                                <button
                                    onClick={() => { resetForm(); setMode('create'); }}
                                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {Icons.plus}
                                    <span>Nuevo Estudiante</span>
                                </button>

                                <button
                                    onClick={async () => {
                                        if (!confirm('¿Optimizar base de datos? Esto eliminará registros redundantes en Firestore que ya existen localmente para ahorrar espacio/cuota.')) return;
                                        setLoading(true);
                                        const result = await optimizeFirestoreUsage();
                                        setLoading(false);
                                        showMessage('success', `Optimización: -${result.deleted} docs redundantes, ${result.kept} activos.`);
                                        loadStudents();
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium border border-slate-600 shadow-sm transition-all"
                                    title="Eliminar datos redundantes de Firebase"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    <span className="hidden xl:inline">Optimizar BD</span>
                                </button>

                                <button
                                    onClick={handleSyncStudents}
                                    disabled={syncing}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all"
                                    title="Sincronizar estudiantes de data.ts a Firestore"
                                >
                                    <svg className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    <span className="hidden xl:inline">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                                </button>

                                <div className="flex-1 relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        {Icons.search}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, ID, email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                                    />
                                </div>

                                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer hover:text-slate-300 transition-colors px-3 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                    <input
                                        type="checkbox"
                                        checked={showDeleted}
                                        onChange={(e) => setShowDeleted(e.target.checked)}
                                        className="w-4 h-4 accent-purple-500 rounded"
                                    />
                                    Ver eliminados
                                </label>
                            </div>

                            {/* Stats Bar */}
                            <div className="flex items-center gap-4 px-4 py-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                    <span className="text-slate-400 text-sm">Total: <span className="text-white font-semibold">{students.filter(s => !s.deleted).length}</span></span>
                                </div>
                                <div className="w-px h-4 bg-slate-700"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                    <span className="text-slate-400 text-sm">Mostrando: <span className="text-white font-semibold">{filteredStudents.length}</span></span>
                                </div>
                                {showDeleted && (
                                    <>
                                        <div className="w-px h-4 bg-slate-700"></div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                            <span className="text-slate-400 text-sm">Eliminados: <span className="text-red-400 font-semibold">{students.filter(s => s.deleted).length}</span></span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Table */}
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-sm">Cargando estudiantes...</p>
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                    <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 text-3xl">📭</div>
                                    <p className="text-sm">No se encontraron estudiantes</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/20">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                                <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                                                <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estudiante</th>
                                                <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                                                <th className="text-left px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Contraseña</th>
                                                <th className="text-right px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/30">
                                            {filteredStudents.map(s => {
                                                const { full, first } = getName(s);
                                                const email = getEmail(s);
                                                const pass = getPassword(s);
                                                return (
                                                    <tr key={s.studentId} className={`hover:bg-slate-700/20 transition-colors ${s.deleted ? 'opacity-50' : ''}`}>
                                                        <td className="px-5 py-4">
                                                            <span className="font-mono text-sm text-slate-300 bg-slate-700/30 px-2.5 py-1 rounded-lg">{s.studentId}</span>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-purple-300 font-semibold text-sm border border-purple-500/20">
                                                                    {first.charAt(0) || '?'}
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-medium">{full || 'Sin nombre'}</p>
                                                                    <p className="text-slate-500 text-xs">{s.institution}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 hidden md:table-cell">
                                                            <span className="text-purple-300/80 text-sm font-mono">{email ? `${email}@gmail.com` : '-'}</span>
                                                        </td>
                                                        <td className="px-5 py-4 hidden lg:table-cell">
                                                            <span className="text-slate-500 text-sm font-mono">{pass || '-'}</span>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {s.deleted ? (
                                                                    <button
                                                                        onClick={() => handleRestore(s.studentId)}
                                                                        className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                                                                    >
                                                                        {Icons.restore}
                                                                        Restaurar
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleEdit(s)}
                                                                            className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors"
                                                                            title="Editar"
                                                                        >
                                                                            {Icons.edit}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteRequest(s)}
                                                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                                            title="Eliminar"
                                                                        >
                                                                            {Icons.trash}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CREATE / EDIT MODE */}
                    {(mode === 'create' || mode === 'edit') && (
                        <div className="max-w-2xl mx-auto">
                            <div className="text-center mb-8">
                                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${mode === 'create' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    <span className="text-3xl">{mode === 'create' ? '➕' : '✏️'}</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white">{mode === 'create' ? 'Nuevo Estudiante' : 'Editar Estudiante'}</h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    {mode === 'create' ? 'Agrega un nuevo estudiante al sistema' : `Modificando: ${originalId}`}
                                </p>
                            </div>

                            <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/30 space-y-5">
                                {/* ID Field with special highlight */}
                                <div>
                                    <label className="block text-slate-300 text-sm font-medium mb-2">ID (Cédula) <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.id}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                        className={`w-full rounded-xl px-4 py-3 text-white font-mono transition-all ${mode === 'edit' && formData.id !== originalId
                                            ? 'bg-orange-500/10 border-2 border-orange-500/50 focus:border-orange-400'
                                            : 'bg-slate-700/50 border border-slate-600/50 focus:border-purple-500'
                                            } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                                        placeholder="1234567890"
                                    />
                                    {mode === 'edit' && formData.id !== originalId && (
                                        <div className="mt-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <span className="text-orange-400 text-xl">⚠️</span>
                                                <div>
                                                    <p className="text-orange-300 text-sm font-medium">Cambio de ID detectado</p>
                                                    <p className="text-orange-200/60 text-xs mt-1">
                                                        Esta acción requiere confirmación con código de seguridad.
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2 text-xs">
                                                        <span className="text-slate-400">Actual:</span>
                                                        <code className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">{originalId}</code>
                                                        <span className="text-slate-500">→</span>
                                                        <span className="text-slate-400">Nuevo:</span>
                                                        <code className="bg-orange-900/50 px-2 py-0.5 rounded text-orange-300">{formData.id}</code>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Nombre <span className="text-red-400">*</span></label>
                                        <input type="text" value={formData.first}
                                            onChange={(e) => setFormData({ ...formData, first: e.target.value.toUpperCase() })}
                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                            placeholder="JUAN" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Apellido <span className="text-red-400">*</span></label>
                                        <input type="text" value={formData.last}
                                            onChange={(e) => setFormData({ ...formData, last: e.target.value.toUpperCase() })}
                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                            placeholder="PÉREZ" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Institución</label>
                                        <select
                                            value={formData.institution}
                                            onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                                            disabled={!!fixedInstitution}
                                            className={`w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 ${fixedInstitution ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <option value="IETAC">IETAC</option>
                                            <option value="SG">SeamosGenios</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Género</label>
                                        <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                                            <option value="M">Masculino</option>
                                            <option value="F">Femenino</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Fecha de Nacimiento</label>
                                        <input type="text" value={formData.birth}
                                            onChange={(e) => setFormData({ ...formData, birth: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                            placeholder="15/03/2006" />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-sm font-medium mb-2">Teléfono</label>
                                        <input type="text" value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                            placeholder="3001234567" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 text-sm font-medium mb-2">Email <span className="text-red-400">*</span></label>
                                    <div className="flex">
                                        <input type="text" value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                                            className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-l-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                            placeholder="estudiante.juan" />
                                        <span className="bg-slate-600/50 border border-slate-600/50 border-l-0 rounded-r-xl px-4 py-3 text-slate-400 text-sm">@gmail.com</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 text-sm font-medium mb-2">Contraseña</label>
                                    <input type="text" value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                                        placeholder="Sg@2025..." />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => setMode('list')}
                                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-white py-3.5 rounded-xl font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={mode === 'create' ? handleCreate : handleUpdate}
                                    className={`flex-1 py-3.5 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${mode === 'edit' && formData.id !== originalId
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                                        : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20'
                                        }`}
                                >
                                    {mode === 'create' ? 'Crear Estudiante' : (formData.id !== originalId ? 'Cambiar ID y Guardar' : 'Guardar Cambios')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CHANGE ID CONFIRMATION */}
                    {mode === 'change-id' && pendingIdChange && (
                        <div className="p-8">
                            <div className="max-w-md mx-auto">
                                <div className="flex flex-col items-center mb-8">
                                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-orange-500/30">
                                        {Icons.warning}
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-2">Confirmar Cambio de ID</h2>
                                    <p className="text-slate-400 text-center">Esta es una operación crítica que requiere confirmación</p>
                                </div>

                                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/10 shadow-xl">
                                    <div className="flex items-center justify-between text-base mb-4">
                                        <span className="text-slate-300 font-medium">ID Actual</span>
                                        <code className="bg-slate-700/50 px-4 py-2 rounded-lg text-white font-mono text-lg border border-slate-600/50">{pendingIdChange.oldId}</code>
                                    </div>
                                    <div className="flex justify-center my-4">
                                        <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center justify-between text-base">
                                        <span className="text-slate-300 font-medium">Nuevo ID</span>
                                        <code className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-4 py-2 rounded-lg text-orange-300 font-mono text-lg border border-orange-500/40 shadow-lg shadow-orange-500/10">{pendingIdChange.newId}</code>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-2 border-orange-500/30 rounded-2xl p-6 mb-6 shadow-xl">
                                    {idChangeToken ? (
                                        <>
                                            <p className="text-white text-base mb-4 text-center font-medium">
                                                Ingresa el código de confirmación <span className="text-orange-400 font-bold text-lg">({idChangeExpiry}s)</span>
                                            </p>
                                            <div className="bg-slate-900 rounded-2xl p-6 font-mono text-5xl text-white tracking-[0.4em] mb-6 border-2 border-slate-700 shadow-inner text-center">
                                                {idChangeToken}
                                            </div>
                                            <input
                                                type="text"
                                                value={idChangeTokenInput}
                                                onChange={(e) => setIdChangeTokenInput(e.target.value)}
                                                placeholder="475002"
                                                maxLength={6}
                                                className="w-full bg-slate-800 border-2 border-slate-600 rounded-2xl px-6 py-5 text-center text-4xl font-mono tracking-[0.4em] text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/30 transition-all shadow-lg"
                                                autoFocus
                                            />
                                        </>
                                    ) : (
                                        <p className="text-slate-400 text-center">Token expirado. Cancela y vuelve a intentar.</p>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => { setMode('edit'); setPendingIdChange(null); setIdChangeToken(''); }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-lg"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleIdChangeConfirm}
                                        disabled={idChangeTokenInput.length !== 6 || !idChangeToken}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white py-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-2xl hover:shadow-orange-500/30 disabled:shadow-none text-lg"
                                    >
                                        Confirmar Cambio
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DELETE CONFIRMATION */}
                    {mode === 'delete' && deleteTarget && (
                        <div className="max-w-lg mx-auto text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-3xl flex items-center justify-center border border-red-500/30 text-red-400">
                                {Icons.warning}
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">Eliminar Estudiante</h2>
                            <p className="text-slate-400 text-sm mb-2">Esta acción moverá al estudiante a eliminados</p>

                            <div className="bg-slate-800/50 rounded-2xl p-5 my-6 border border-slate-700/50">
                                <p className="text-white font-semibold text-lg">{getName(deleteTarget).full}</p>
                                <p className="text-slate-500 text-sm font-mono">ID: {deleteTarget.studentId}</p>
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-6">
                                {deletionToken ? (
                                    <>
                                        <p className="text-slate-300 text-sm mb-3">
                                            Código de confirmación <span className="text-red-400 font-medium">({tokenExpiry}s)</span>
                                        </p>
                                        <div className="bg-slate-900/50 rounded-xl p-4 font-mono text-3xl text-white tracking-[0.3em] mb-4 border border-slate-700/50">
                                            {deletionToken}
                                        </div>
                                        <input
                                            type="text"
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            placeholder="000000"
                                            maxLength={6}
                                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.3em] text-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                        />
                                    </>
                                ) : (
                                    <p className="text-slate-500">Token expirado</p>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setMode('list'); setDeleteTarget(null); setDeletionToken(''); }}
                                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-white py-3.5 rounded-xl font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={tokenInput.length !== 6 || !deletionToken}
                                    className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white py-3.5 rounded-xl font-medium transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
