"use client";

import { Student } from '@/lib/data';
import { Copy, Smartphone, Mail, Calendar, User, Hash, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface StudentTableProps {
    data: Student[];
}

export default function StudentTable({ data }: StudentTableProps) {
    const { showToast } = useToast();

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${label}: ${text}`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
                <div className="overflow-x-auto h-full">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <Th>Nombre</Th>
                                <Th>Apellidos</Th>
                                <Th>Fecha Nac.</Th>
                                <Th>Género</Th>
                                <Th>Email</Th>
                                <Th>Contraseña</Th>
                                <Th>Teléfono</Th>
                                <Th>ID / Doc</Th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.length > 0 ? (
                                data.map((student, index) => (
                                    <TableRow key={index} student={student} index={index} onCopy={handleCopy} />
                                ))
                            ) : (
                                <EmptyState />
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 pb-20">
                {data.length > 0 ? (
                    data.map((student, index) => (
                        <MobileCard key={index} student={student} index={index} onCopy={handleCopy} />
                    ))
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        <p>No se encontraron resultados.</p>
                    </div>
                )}
            </div>

            {/* Footer / Pagination */}
            <div className="hidden lg:flex px-6 py-4 border-t border-slate-200 bg-white items-center justify-between sticky bottom-0">
                <span className="text-sm text-slate-500">Mostrando <span className="font-medium text-slate-900">{data.length}</span> registros</span>
                <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Anterior</button>
                    <button className="px-3 py-1 text-sm border rounded text-slate-400" disabled>Siguiente</button>
                </div>
            </div>
        </div>
    );
}

// --- Subcomponents ---

function TableRow({ student, index, onCopy }: { student: Student; index: number; onCopy: (t: string, l: string) => void }) {
    const cleanFirst = student.first.replace('IETAC - ', '');
    const initials = cleanFirst.substring(0, 2).toUpperCase();

    return (
        <motion.tr
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="hover:bg-indigo-50/30 transition-colors group"
        >
            {/* 1. Nombre */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center cursor-pointer" onClick={() => onCopy(cleanFirst, 'Nombre')}>
                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-3 border border-indigo-200">
                        {initials}
                    </div>
                    <div className="font-semibold text-slate-900">{cleanFirst}</div>
                    <CopyIcon />
                </div>
            </td>

            {/* 2. Apellidos */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium clickable-cell" onClick={() => onCopy(student.last, 'Apellidos')}>
                {student.last} <CopyIcon />
            </td>

            {/* 3. Fecha Nac */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono clickable-cell" onClick={() => onCopy(student.birth, 'Fecha Nac')}>
                {student.birth} <CopyIcon />
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

            {/* 5. Email */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 clickable-cell" onClick={() => onCopy(student.email, 'Email')}>
                {student.email} <CopyIcon />
            </td>

            {/* 6. Contraseña */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono clickable-cell" onClick={() => onCopy(student.password, 'Contraseña')}>
                <span className="blur-[2px] hover:blur-none transition-all duration-200">{student.password}</span> <CopyIcon />
            </td>

            {/* 7. Teléfono */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono clickable-cell" onClick={() => onCopy(student.phone, 'Teléfono')}>
                {student.phone} <CopyIcon />
            </td>

            {/* 8. ID (Extra) */}
            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400 clickable-cell" onClick={() => onCopy(student.id, 'ID')}>
                {student.id} <CopyIcon />
            </td>
        </motion.tr>
    );
}

function MobileCard({ student, index, onCopy }: { student: Student; index: number; onCopy: (t: string, l: string) => void }) {
    const cleanFirst = student.first.replace('IETAC - ', '');

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

            {/* Header: Name & ID */}
            <div className="flex justify-between items-start mb-4 pl-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight" onClick={() => onCopy(cleanFirst + ' ' + student.last, 'Nombre Completo')}>{cleanFirst}</h3>
                    <p className="text-sm text-slate-600 font-medium">{student.last}</p>
                </div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500" onClick={() => onCopy(student.id, 'ID')}>{student.id}</span>
            </div>

            {/* Grid of Info */}
            <div className="grid grid-cols-1 gap-3 pl-3">
                <MobileRow icon={<Mail className="w-4 h-4" />} label="Email" value={student.email} onCopy={onCopy} highlight />
                <MobileRow icon={<Lock className="w-4 h-4" />} label="Pass" value={student.password} onCopy={onCopy} isPass />
                <div className="flex gap-4">
                    <MobileRow icon={<Calendar className="w-4 h-4" />} label="Nac." value={student.birth} onCopy={onCopy} />
                    <MobileRow icon={<User className="w-4 h-4" />} label="Gen" value={student.gender} onCopy={onCopy} />
                </div>
                <MobileRow icon={<Smartphone className="w-4 h-4" />} label="Tel" value={student.phone} onCopy={onCopy} />
            </div>
        </motion.div>
    );
}

function MobileRow({ icon, label, value, onCopy, highlight = false, isPass = false }: any) {
    return (
        <div
            className={clsx("flex items-center p-2 rounded-lg active:bg-slate-50 transition-colors cursor-pointer border border-transparent active:border-slate-100", highlight && "bg-indigo-50/50 border-indigo-50")}
            onClick={() => onCopy(value, label)}
        >
            <div className={clsx("p-1.5 rounded-md mr-3 text-slate-400", highlight ? "bg-indigo-100 text-indigo-600" : "bg-slate-100")}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider font-sans">{label}</p>
                <p className={clsx("text-sm font-medium truncate", highlight ? "text-indigo-700" : "text-slate-700", isPass && "blur-[2px] active:blur-none transition-all")}>
                    {value}
                </p>
            </div>
            <Copy className="w-4 h-4 text-slate-300 ml-2" />
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
            {children}
        </th>
    );
}

function CopyIcon() {
    return <Copy className="w-3 h-3 ml-2 text-indigo-300 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
}

function EmptyState() {
    return (
        <tr>
            <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                Sin resultados
            </td>
        </tr>
    );
}
