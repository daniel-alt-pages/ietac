"use client";

import { useState } from 'react';
import { Student } from '@/lib/data';
import { Copy, Smartphone, Mail, Calendar, User, Lock, Check, Phone } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentTableProps {
    data: Student[];
    confirmations: Record<string, boolean>;
    onToggleConfirm: (id: string) => void;
}

export default function StudentTable({ data, confirmations, onToggleConfirm }: StudentTableProps) {
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2000);
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label}: ${text}`);
    };

    const handleCall = (phone: string, studentName: string) => {
        const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
        window.location.href = `tel:+57${cleanPhone}`;
        showToast(`Llamando a ${studentName}...`);
    };

    // Extract email username (without @gmail.com)
    const getEmailUsername = (email: string) => email.split('@')[0];

    const handleSendMessage = (student: Student) => {
        const firstName = student.first.replace(/^(IETAC|SG) - /, '');
        const fullEmail = student.email.includes('@') ? student.email : `${student.email}@gmail.com`;
        const message = `👋 Hola ${firstName}, aquí tienes tus credenciales institucionales:
    
📧 Usuario: ${fullEmail}
🔑 Contraseña: ${student.password}
    
🌐 Inicia sesión en Google: https://accounts.google.com/
    
⚠️ Por favor accede lo más rápido posible a tu correo para evitar una desactivación.`;

        const whatsappUrl = `https://wa.me/57${student.phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING'>('ALL');

    const confirmedCount = Object.values(confirmations).filter(Boolean).length;
    const pendingCount = data.length - confirmedCount;

    const filteredData = data.filter(student => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'CONFIRMED') return confirmations[student.id];
        if (statusFilter === 'PENDING') return !confirmations[student.id];
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Status Tabs - Mobile Optimized */}
            <div className="bg-white px-2 sm:px-4 py-2 sm:py-3 border-b border-slate-200 sticky top-0 z-20">
                <div className="flex gap-1 sm:gap-2">
                    <button
                        onClick={() => setStatusFilter('ALL')}
                        className={clsx(
                            "flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all",
                            statusFilter === 'ALL' ? "bg-slate-800 text-white shadow-md" : "bg-slate-100 text-slate-500"
                        )}
                    >
                        <span className="sm:hidden">📋</span>
                        <span className="hidden sm:inline">Todos</span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-xs", statusFilter === 'ALL' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
                            {data.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setStatusFilter('CONFIRMED')}
                        className={clsx(
                            "flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all",
                            statusFilter === 'CONFIRMED' ? "bg-green-600 text-white shadow-md" : "bg-green-50 text-green-600"
                        )}
                    >
                        <span className="sm:hidden">✅</span>
                        <span className="hidden sm:inline">Confirmados</span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-xs", statusFilter === 'CONFIRMED' ? "bg-white/20 text-white" : "bg-green-100 text-green-700")}>
                            {confirmedCount}
                        </span>
                    </button>
                    <button
                        onClick={() => setStatusFilter('PENDING')}
                        className={clsx(
                            "flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all",
                            statusFilter === 'PENDING' ? "bg-amber-500 text-white shadow-md" : "bg-amber-50 text-amber-600"
                        )}
                    >
                        <span className="sm:hidden">⏳</span>
                        <span className="hidden sm:inline">Pendientes</span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-xs", statusFilter === 'PENDING' ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700")}>
                            {pendingCount}
                        </span>
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 mx-4 my-4">
                <div className="overflow-x-auto h-full">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm shadow-slate-200/50">
                            <tr>
                                <Th>#</Th>
                                <Th>✓</Th>
                                <Th>Nombre Completo</Th>
                                <Th>Apellidos</Th>
                                <Th>Fecha Nac.</Th>
                                <Th>Género</Th>
                                <Th>Usuario Email</Th>
                                <Th>Contraseña</Th>
                                <Th>Teléfono</Th>
                                <Th>ID / Doc</Th>
                                <Th>Acciones</Th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {filteredData.length > 0 ? (
                                filteredData.map((student, index) => (
                                    <TableRow
                                        key={student.id}
                                        student={student}
                                        index={index}
                                        onCopy={handleCopy}
                                        onCall={handleCall}
                                        getEmailUsername={getEmailUsername}
                                        isConfirmed={confirmations[student.id] || false}
                                        onToggleConfirm={() => onToggleConfirm(student.id)}
                                        onSendMessage={() => handleSendMessage(student)}
                                    />
                                ))
                            ) : (
                                <EmptyState />
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {filteredData.length > 0 ? (
                    filteredData.map((student, index) => (
                        <MobileCard
                            key={student.id}
                            student={student}
                            index={index}
                            onCopy={handleCopy}
                            onCall={handleCall}
                            getEmailUsername={getEmailUsername}
                            isConfirmed={confirmations[student.id] || false}
                            onToggleConfirm={() => onToggleConfirm(student.id)}
                            onSendMessage={() => handleSendMessage(student)}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <p>No se encontraron resultados en esta categoría.</p>
                    </div>
                )}
            </div>

            {/* Desktop Footer / Stats */}
            <div className="hidden md:flex px-6 py-4 border-t border-slate-200 bg-white items-center justify-between sticky bottom-0 z-20">
                <span className="text-sm text-slate-500">
                    Mostrando <span className="font-medium text-slate-900">{filteredData.length}</span> registros
                    {' • '}
                    <span className="text-green-600 font-medium">{confirmedCount} confirmados</span>
                </span>
                <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Anterior</button>
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Siguiente</button>
                </div>
            </div>

            {/* Mobile Footer - Fixed at bottom */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-2.5 flex justify-between items-center shadow-lg z-40">
                <div className="text-xs text-slate-500 flex flex-col">
                    <span>{data.length} Total</span>
                    <span>Mostrando {filteredData.length}</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-bold text-green-700">{confirmedCount} / {data.length}</span>
                </div>
            </div>

            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2"
                    >
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-sm">{toast}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Subcomponents ---

interface TableRowProps {
    student: Student;
    index: number;
    onCopy: (t: string, l: string) => void;
    onCall: (phone: string, studentName: string) => void;
    getEmailUsername: (email: string) => string;
    isConfirmed: boolean;
    onToggleConfirm: () => void;
    onSendMessage: () => void;
}

function TableRow({ student, index, onCopy, onCall, getEmailUsername, isConfirmed, onToggleConfirm, onSendMessage }: TableRowProps) {
    const fullName = student.first;
    const cleanNameForInitials = fullName.replace(/^(IETAC|SG) - /, '');
    const initials = cleanNameForInitials.substring(0, 2).toUpperCase();
    const emailUser = getEmailUsername(student.email);

    // Institution-specific colors (inferred from name prefix)
    const isIETAC = student.first.startsWith('IETAC');

    const institutionColors = {
        avatar: isIETAC ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
        hover: isIETAC ? 'hover:bg-indigo-50/30' : 'hover:bg-emerald-50/30',
        text: isIETAC ? 'group-hover/cell:text-indigo-600' : 'group-hover/cell:text-emerald-600',
        email: isIETAC ? 'text-indigo-600' : 'text-emerald-600',
        copyIcon: isIETAC ? 'text-indigo-300' : 'text-emerald-300'
    };

    return (
        <motion.tr
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className={clsx("transition-colors group", institutionColors.hover, isConfirmed && "bg-green-50/50")}
        >
            {/* # Row Number */}
            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400 font-mono text-center">
                {index + 1}
            </td>

            {/* Confirmation Checkbox */}
            <td className="px-4 py-4 whitespace-nowrap text-center">
                <button
                    onClick={onToggleConfirm}
                    className={clsx(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        isConfirmed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-slate-300 hover:border-green-400"
                    )}
                >
                    {isConfirmed && <Check className="w-4 h-4" />}
                </button>
            </td>

            {/* 1. Nombre */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(fullName, 'Nombre')}>
                    <div className={clsx("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 border flex-shrink-0", institutionColors.avatar)}>
                        {initials}
                    </div>
                    <div className={clsx("font-semibold text-slate-900 transition-colors", institutionColors.text)}>{fullName}</div>
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 2. Apellidos */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.last, 'Apellidos')}>
                    {student.last}
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 3. Fecha Nac */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.birth, 'Fecha Nac')}>
                    {student.birth}
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 4. Género */}
            <td className="px-6 py-4 whitespace-nowrap">
                <span onClick={() => onCopy(student.gender, 'Género')} className={clsx(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer select-none",
                    student.gender === 'Mujer' ? "bg-pink-50 text-pink-700 border-pink-100" : "bg-blue-50 text-blue-700 border-blue-100"
                )}>
                    {student.gender}
                </span>
            </td>

            {/* 5. Usuario Email (sin @gmail.com) */}
            <td className={clsx("px-6 py-4 whitespace-nowrap text-sm", institutionColors.email)}>
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(emailUser, 'Usuario')}>
                    {emailUser}
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 6. Contraseña */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.password, 'Contraseña')}>
                    <span className="blur-[2px] hover:blur-none transition-all duration-200">{student.password}</span>
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 7. Teléfono */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.phone, 'Teléfono')}>
                    {student.phone}
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 8. ID */}
            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.id, 'ID')}>
                    {student.id}
                    <Copy className={clsx("w-3 h-3 ml-2 inline opacity-0 group-hover/cell:opacity-100 transition-opacity", institutionColors.copyIcon)} />
                </div>
            </td>

            {/* 9. Acciones */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 justify-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onCall(student.phone, cleanNameForInitials); }}
                        className="p-1.5 hover:bg-blue-50 rounded-full transition-colors"
                        title="Llamar por teléfono"
                    >
                        <Phone className="w-5 h-5 text-blue-600" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSendMessage(); }}
                        className="p-1.5 hover:bg-[#25D366]/10 rounded-full transition-colors group/wa"
                        title="Enviar credenciales por WhatsApp"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="w-5 h-5 fill-[#25D366] group-hover/wa:scale-110 transition-transform"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                    </button>
                </div>
            </td>
        </motion.tr>
    );
}

interface MobileCardProps {
    student: Student;
    index: number;
    onCopy: (t: string, l: string) => void;
    onCall: (phone: string, studentName: string) => void;
    getEmailUsername: (email: string) => string;
    isConfirmed: boolean;
    onToggleConfirm: () => void;
    onSendMessage: () => void;
}

function MobileCard({ student, index, onCopy, onCall, getEmailUsername, isConfirmed, onToggleConfirm, onSendMessage }: MobileCardProps) {
    const fullName = student.first;
    const cleanNameForInitials = fullName.replace(/^(IETAC|SG) - /, '');
    const emailUser = getEmailUsername(student.email);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 active:shadow-md transition-shadow"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                    <button
                        onClick={onToggleConfirm}
                        className={clsx(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                            isConfirmed
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-slate-300"
                        )}
                    >
                        {isConfirmed && <Check className="w-4 h-4" />}
                    </button>
                    <h3 className="text-base font-bold text-slate-900 active:text-indigo-600" onClick={() => onCopy(fullName, 'Nombre')}>{fullName}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onCall(student.phone, cleanNameForInitials)}
                        className="p-1.5 hover:bg-blue-50 rounded-full transition-colors"
                        title="Llamar por teléfono"
                    >
                        <Phone className="w-5 h-5 text-blue-600" />
                    </button>
                    <button
                        onClick={onSendMessage}
                        className="p-1.5 hover:bg-[#25D366]/10 rounded-full transition-colors group/wa"
                        title="Enviar credenciales por WhatsApp"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="w-5 h-5 fill-[#25D366] group-hover/wa:scale-110 transition-transform"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
                {/* Apellidos */}
                <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 font-medium">Apellidos:</span>
                    <span className="text-slate-900 font-semibold active:text-indigo-600" onClick={() => onCopy(student.last, 'Apellidos')}>{student.last}</span>
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 font-medium">Email:</span>
                    <span className="text-indigo-600 font-mono text-xs active:text-indigo-800" onClick={() => onCopy(emailUser, 'Usuario')}>{emailUser}</span>
                </div>

                {/* Password */}
                <div className="flex items-center gap-2 text-sm">
                    <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 font-medium">Contraseña:</span>
                    <span className="text-slate-900 font-mono text-xs blur-sm active:blur-none active:text-indigo-600" onClick={() => onCopy(student.password, 'Contraseña')}>{student.password}</span>
                </div>
            </div>

            {/* Grid of Info */}
            <div className="p-3 grid grid-cols-2 gap-2">
                <MobileField label="Teléfono" value={student.phone} icon={<Smartphone size={13} />} onCopy={onCopy} />
                <MobileField label="Fecha Nac." value={student.birth} icon={<Calendar size={13} />} onCopy={onCopy} />
                <MobileField label="Género" value={student.gender} icon={<User size={13} />} onCopy={onCopy} />
                <MobileField label="ID" value={student.id} icon={<User size={13} />} onCopy={onCopy} />
            </div>
        </motion.div >
    );
}

interface MobileFieldProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    fullWidth?: boolean;
    blur?: boolean;
    onCopy: (text: string, label: string) => void;
}

function MobileField({ label, value, icon, fullWidth, blur, onCopy }: MobileFieldProps) {
    return (
        <div
            className={clsx("flex flex-col gap-1 p-3 rounded-lg bg-slate-50 active:bg-indigo-50 transition-colors border border-transparent active:border-indigo-100", fullWidth && "col-span-2")}
            onClick={() => onCopy(value, label)}
        >
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold uppercase">
                {icon}
                <span>{label}</span>
            </div>
            <div className={clsx("text-sm font-medium text-slate-700 truncate", blur && "blur-[2px] active:blur-none")}>
                {value}
            </div>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 backdrop-blur-sm whitespace-nowrap border-b border-slate-200">
            {children}
        </th>
    );
}


function EmptyState() {
    return (
        <tr>
            <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                Sin resultados
            </td>
        </tr>
    );
}
