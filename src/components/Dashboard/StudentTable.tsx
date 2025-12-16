"use client";

import { Student } from '@/lib/data';
import { Copy, Smartphone, Mail, Calendar, User, Lock, Check, Circle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface StudentTableProps {
    data: Student[];
    confirmations: Record<string, boolean>;
    onToggleConfirm: (id: string) => void;
}

export default function StudentTable({ data, confirmations, onToggleConfirm }: StudentTableProps) {
    const { showToast } = useToast();

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label}: ${text}`);
    };

    // Extract email username (without @gmail.com)
    const getEmailUsername = (email: string) => email.split('@')[0];

    const handleSendMessage = (student: Student) => {
        const firstName = student.first.replace('IETAC - ', '');
        const message = `👋 Hola ${firstName}, aquí tienes tus credenciales institucionales:
    
📧 Usuario: ${student.email}
🔑 Contraseña: ${student.password}
    
🌐 Inicia sesión en Google: https://accounts.google.com/
    
Por favor cambia tu contraseña al ingresar.`;

        const whatsappUrl = `https://wa.me/57${student.phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                <div className="overflow-x-auto h-full">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
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
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.length > 0 ? (
                                data.map((student, index) => (
                                    <TableRow
                                        key={student.id}
                                        student={student}
                                        index={index}
                                        onCopy={handleCopy}
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
            <div className="md:hidden space-y-4 pb-28 px-4 pt-4">
                {data.length > 0 ? (
                    data.map((student, index) => (
                        <MobileCard
                            key={student.id}
                            student={student}
                            index={index}
                            onCopy={handleCopy}
                            getEmailUsername={getEmailUsername}
                            isConfirmed={confirmations[student.id] || false}
                            onToggleConfirm={() => onToggleConfirm(student.id)}
                            onSendMessage={() => handleSendMessage(student)}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <p>No se encontraron resultados.</p>
                    </div>
                )}
            </div>

            {/* Desktop Footer / Stats */}
            <div className="hidden md:flex px-6 py-4 border-t border-slate-200 bg-white items-center justify-between sticky bottom-0 z-20">
                <span className="text-sm text-slate-500">
                    Mostrando <span className="font-medium text-slate-900">{data.length}</span> registros
                    {' • '}
                    <span className="text-green-600 font-medium">{Object.values(confirmations).filter(Boolean).length} confirmados</span>
                </span>
                <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Anterior</button>
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Siguiente</button>
                </div>
            </div>

            {/* Mobile Footer - Fixed at bottom */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between items-center shadow-lg z-50">
                <div className="text-sm">
                    <span className="text-slate-500">{data.length} estudiantes</span>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-bold text-green-700">{Object.values(confirmations).filter(Boolean).length} / {data.length}</span>
                </div>
            </div>
        </div>
    );
}

// --- Subcomponents ---

interface TableRowProps {
    student: Student;
    index: number;
    onCopy: (t: string, l: string) => void;
    getEmailUsername: (email: string) => string;
    isConfirmed: boolean;
    onToggleConfirm: () => void;
    onSendMessage: () => void;
}

function TableRow({ student, index, onCopy, getEmailUsername, isConfirmed, onToggleConfirm, onSendMessage }: TableRowProps) {
    const fullName = student.first;
    const cleanNameForInitials = fullName.replace('IETAC - ', '');
    const initials = cleanNameForInitials.substring(0, 2).toUpperCase();
    const emailUser = getEmailUsername(student.email);

    return (
        <motion.tr
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className={clsx("hover:bg-indigo-50/30 transition-colors group", isConfirmed && "bg-green-50/50")}
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
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center cursor-pointer group/cell flex-1" onClick={() => onCopy(fullName, 'Nombre')}>
                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-3 border border-indigo-200 flex-shrink-0">
                            {initials}
                        </div>
                        <div className="font-semibold text-slate-900 group-hover/cell:text-indigo-600 transition-colors">{fullName}</div>
                        <CopyIcon />
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSendMessage(); }}
                        className="p-1.5 hover:bg-green-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Enviar credenciales por WhatsApp"
                    >
                        <img
                            src="https://images.seeklogo.com/logo-png/30/1/whatsapp-logo-png_seeklogo-306926.png"
                            alt="WhatsApp"
                            className="w-5 h-5 object-contain"
                        />
                    </button>
                </div>
            </td>

            {/* 2. Apellidos */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.last, 'Apellidos')}>
                    {student.last}
                    <CopyIcon />
                </div>
            </td>

            {/* 3. Fecha Nac */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.birth, 'Fecha Nac')}>
                    {student.birth}
                    <CopyIcon />
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
            <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(emailUser, 'Usuario')}>
                    {emailUser}
                    <CopyIcon />
                </div>
            </td>

            {/* 6. Contraseña */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.password, 'Contraseña')}>
                    <span className="blur-[2px] hover:blur-none transition-all duration-200">{student.password}</span>
                    <CopyIcon />
                </div>
            </td>

            {/* 7. Teléfono */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.phone, 'Teléfono')}>
                    {student.phone}
                    <CopyIcon />
                </div>
            </td>

            {/* 8. ID */}
            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                <div className="flex items-center cursor-pointer group/cell" onClick={() => onCopy(student.id, 'ID')}>
                    {student.id}
                    <CopyIcon />
                </div>
            </td>
        </motion.tr>
    );
}

interface MobileCardProps {
    student: Student;
    index: number;
    onCopy: (t: string, l: string) => void;
    getEmailUsername: (email: string) => string;
    isConfirmed: boolean;
    onToggleConfirm: () => void;
    onSendMessage: () => void;
}

function MobileCard({ student, index, onCopy, getEmailUsername, isConfirmed, onToggleConfirm, onSendMessage }: MobileCardProps) {
    const fullName = student.first;
    const emailUser = getEmailUsername(student.email);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={clsx("bg-white rounded-xl shadow-sm border overflow-hidden", isConfirmed ? "border-green-300 bg-green-50/30" : "border-slate-200")}
        >
            {/* Header */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400 bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center">{index + 1}</span>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 active:text-indigo-600" onClick={() => onCopy(fullName, 'Nombre')}>{fullName}</h3>
                        <p className="text-sm text-slate-500 active:text-indigo-600" onClick={() => onCopy(student.last, 'Apellidos')}>{student.last}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onSendMessage}
                        className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors border border-green-100"
                        title="Enviar credenciales por WhatsApp"
                    >
                        <img
                            src="https://images.seeklogo.com/logo-png/30/1/whatsapp-logo-png_seeklogo-306926.png"
                            alt="WhatsApp"
                            className="w-5 h-5 object-contain"
                        />
                    </button>
                    <button
                        onClick={onToggleConfirm}
                        className={clsx(
                            "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
                            isConfirmed
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-slate-300 bg-white"
                        )}
                    >
                        {isConfirmed ? <Check className="w-5 h-5" /> : <Circle className="w-4 h-4 text-slate-300" />}
                    </button>
                </div>
            </div>

            {/* Grid of Info */}
            <div className="p-4 grid grid-cols-2 gap-3">
                <MobileField label="Usuario" value={emailUser} icon={<Mail size={14} />} fullWidth onCopy={onCopy} />
                <MobileField label="Contraseña" value={student.password} icon={<Lock size={14} />} blur onCopy={onCopy} />
                <MobileField label="Teléfono" value={student.phone} icon={<Smartphone size={14} />} onCopy={onCopy} />
                <MobileField label="Fecha Nac." value={student.birth} icon={<Calendar size={14} />} onCopy={onCopy} />
                <MobileField label="Género" value={student.gender} icon={<User size={14} />} onCopy={onCopy} />
                <MobileField label="ID" value={student.id} icon={<User size={14} />} onCopy={onCopy} />
            </div>
        </motion.div>
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
        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
            {children}
        </th>
    );
}

function CopyIcon() {
    return <Copy className="w-3 h-3 ml-2 text-indigo-300 inline opacity-0 group-hover/cell:opacity-100 transition-opacity" />;
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
