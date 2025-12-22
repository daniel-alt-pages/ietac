"use client";
import { useState } from 'react';
import { Menu, X, Database, PieChart, LogOut, SlidersHorizontal } from 'lucide-react';

interface MobileNavProps {
    activeView: 'data' | 'statistics' | 'settings';
    onViewChange: (view: 'data' | 'statistics' | 'settings') => void;
    onLogout: () => void;
    onOpenFilters?: () => void;
    hasActiveFilters?: boolean;
    activeFiltersCount?: number;
}

export default function MobileNav({
    activeView,
    onViewChange,
    onLogout,
    onOpenFilters,
    hasActiveFilters = false,
    activeFiltersCount = 0
}: MobileNavProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Backdrop oscuro cuando está abierto */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/70 z-40 backdrop-blur-sm animate-in fade-in duration-200 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Contenedor del FAB */}
            <div className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col items-end gap-2">
                {/* Menú expandido */}
                {isOpen && (
                    <div className="flex flex-col items-end gap-2 mb-3 animate-in slide-in-from-bottom-5 fade-in duration-200">

                        {/* Filtros */}
                        {onOpenFilters && (
                            <button
                                onClick={() => { onOpenFilters(); setIsOpen(false); }}
                                className="group flex items-center gap-2"
                                title="Abrir filtros"
                            >
                                <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-slate-100">
                                    Filtros {hasActiveFilters && `(${activeFiltersCount})`}
                                </span>
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${hasActiveFilters
                                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                                    : 'bg-white text-slate-600 border border-slate-200'
                                    }`}>
                                    <SlidersHorizontal className="w-5 h-5" />
                                </div>
                            </button>
                        )}

                        {/* Estadísticas */}
                        <button
                            onClick={() => { onViewChange('statistics'); setIsOpen(false); }}
                            className="group flex items-center gap-2"
                            title="Ver estadísticas"
                        >
                            <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-slate-100">
                                Estadísticas
                            </span>
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${activeView === 'statistics'
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                : 'bg-white text-indigo-600 border border-indigo-100'
                                }`}>
                                <PieChart className="w-5 h-5" />
                            </div>
                        </button>

                        {/* Base de Datos */}
                        <button
                            onClick={() => { onViewChange('data'); setIsOpen(false); }}
                            className="group flex items-center gap-2"
                            title="Ver base de datos"
                        >
                            <span className="bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-slate-100">
                                Estudiantes
                            </span>
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${activeView === 'data'
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                : 'bg-white text-indigo-600 border border-indigo-100'
                                }`}>
                                <Database className="w-5 h-5" />
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="w-full h-px bg-slate-300/50 my-1"></div>

                        {/* Cerrar Sesión */}
                        <button
                            onClick={onLogout}
                            className="group flex items-center gap-2"
                            title="Cerrar sesión"
                        >
                            <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-red-100">
                                Salir
                            </span>
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-400 to-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95">
                                <LogOut className="w-5 h-5" />
                            </div>
                        </button>
                    </div>
                )}

                {/* Botón Principal (FAB) - Diseño premium */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90 ${isOpen
                        ? 'bg-slate-800 text-white rotate-180'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/40'
                        }`}
                    title={isOpen ? "Cerrar menú" : "Abrir menú"}
                >
                    {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>
        </>
    );
}
