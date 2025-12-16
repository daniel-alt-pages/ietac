"use client";

import { Student } from '@/lib/data';
import { Copy } from 'lucide-react';
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <Th>Nombre</Th>
                            <Th>Apellidos</Th>
                            <Th>Documento ID</Th>
                            <Th>Email</Th>
                            <Th>Teléfono</Th>
                            <Th>Género</Th>
                            <Th>Fecha Nac.</Th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {data.length > 0 ? (
                            data.map((student, index) => {
                                // Clean name logic
                                const cleanFirst = student.first.replace('IETAC - ', '');
                                const initials = cleanFirst.substring(0, 2).toUpperCase();

                                return (
                                    <motion.tr
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-slate-50/80 transition-colors duration-150 group"
                                    >
                                        {/* First Name */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center group/cell cursor-pointer relative" onClick={() => handleCopy(cleanFirst, 'Nombre')}>
                                                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold mr-3 border border-slate-200 shadow-sm ring-2 ring-transparent group-hover/cell:ring-indigo-100 transition-all">
                                                    {initials}
                                                </div>
                                                <div className="font-semibold text-slate-900 group-hover/cell:text-indigo-600 transition-colors">{cleanFirst}</div>
                                                <CopyButton />
                                            </div>
                                        </td>

                                        {/* Last Name */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                            <div className="flex items-center group/cell cursor-pointer w-full" onClick={() => handleCopy(student.last, 'Apellidos')}>
                                                {student.last}
                                                <CopyButton />
                                            </div>
                                        </td>

                                        {/* ID */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center group/cell cursor-pointer w-fit" onClick={() => handleCopy(student.pass, 'ID')}>
                                                <span className="font-mono text-slate-500 bg-slate-100/50 px-2 py-1 rounded text-xs border border-slate-200 tracking-wide group-hover/cell:bg-indigo-50 group-hover/cell:text-indigo-600 group-hover/cell:border-indigo-100 transition-colors">
                                                    {student.pass}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center group/cell cursor-pointer w-full text-indigo-600 hover:text-indigo-700" onClick={() => handleCopy(student.email, 'Email')}>
                                                {student.email}
                                                <CopyButton />
                                            </div>
                                        </td>

                                        {/* Phone */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center group/cell cursor-pointer w-full text-slate-500 font-mono" onClick={() => handleCopy(student.phone, 'Teléfono')}>
                                                {student.phone}
                                                <CopyButton />
                                            </div>
                                        </td>

                                        {/* Gender */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="cursor-pointer" onClick={() => handleCopy(student.gender, 'Género')}>
                                                <span className={clsx(
                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                                    student.gender === 'Mujer'
                                                        ? "bg-pink-50 text-pink-700 border-pink-100"
                                                        : "bg-blue-50 text-blue-700 border-blue-100"
                                                )}>
                                                    {student.gender}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Birth */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            <div className="flex items-center group/cell cursor-pointer" onClick={() => handleCopy(student.birth, 'Fecha Nac.')}>
                                                {student.birth}
                                                <CopyButton />
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    No se encontraron resultados para tu búsqueda.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <span className="text-sm text-slate-500">Mostrando <span className="font-medium text-slate-900">{data.length}</span> registros</span>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-all" disabled>Anterior</button>
                    <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-all" disabled>Siguiente</button>
                </div>
            </div>
        </div>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
            {children}
        </th>
    );
}

function CopyButton() {
    return (
        <Copy className="w-3.5 h-3.5 ml-2 text-indigo-400 opacity-0 group-hover/cell:opacity-100 transition-all transform scale-90 group-hover/cell:scale-100" />
    );
}
