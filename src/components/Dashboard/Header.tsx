"use client";

import { Search, Bell, X, Filter, SlidersHorizontal, Download, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

interface HeaderProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    institutionFilter: string;
    onInstitutionChange: (value: string) => void;
    nameFilter: string;
    onNameFilterChange: (value: string) => void;
    lastnameFilter: string;
    onLastnameFilterChange: (value: string) => void;
    onExportExcel: () => void;
}

// Componente de filtro alfabético compacto y profesional
const AlphabetFilter = ({
    label,
    value,
    onChange,
    alphabet,
    accentColor = 'indigo'
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    alphabet: string[];
    accentColor?: 'indigo' | 'emerald' | 'violet';
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const colorMap = {
        indigo: {
            bg: 'bg-indigo-500',
            bgHover: 'hover:bg-indigo-100',
            text: 'text-indigo-600',
            ring: 'ring-indigo-500/20',
            badge: 'bg-indigo-100 text-indigo-700'
        },
        emerald: {
            bg: 'bg-emerald-500',
            bgHover: 'hover:bg-emerald-100',
            text: 'text-emerald-600',
            ring: 'ring-emerald-500/20',
            badge: 'bg-emerald-100 text-emerald-700'
        },
        violet: {
            bg: 'bg-violet-500',
            bgHover: 'hover:bg-violet-100',
            text: 'text-violet-600',
            ring: 'ring-violet-500/20',
            badge: 'bg-violet-100 text-violet-700'
        }
    };

    const colors = colorMap[accentColor];

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header clickeable */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    {value !== 'ALL' && (
                        <span className={clsx("text-xs px-2 py-0.5 rounded-full font-bold", colors.badge)}>
                            {value}
                        </span>
                    )}
                </div>
                <ChevronDown className={clsx(
                    "w-4 h-4 text-slate-400 transition-transform duration-200",
                    isExpanded && "rotate-180"
                )} />
            </button>

            {/* Panel expandible */}
            <div className={clsx(
                "grid transition-all duration-200 ease-out",
                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}>
                <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => { onChange('ALL'); setIsExpanded(false); }}
                                className={clsx(
                                    "h-8 px-3 text-xs font-semibold rounded-lg transition-all duration-150",
                                    value === 'ALL'
                                        ? `${colors.bg} text-white shadow-sm`
                                        : `bg-slate-100 text-slate-600 hover:bg-slate-200`
                                )}
                            >
                                Todos
                            </button>
                            {alphabet.map(letter => (
                                <button
                                    key={letter}
                                    onClick={() => { onChange(letter); setIsExpanded(false); }}
                                    className={clsx(
                                        "w-8 h-8 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center justify-center",
                                        value === letter
                                            ? `${colors.bg} text-white shadow-sm`
                                            : `bg-slate-100 text-slate-600 hover:bg-slate-200`
                                    )}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function Header({
    searchTerm,
    onSearchChange,
    institutionFilter,
    onInstitutionChange,
    nameFilter,
    onNameFilterChange,
    lastnameFilter,
    onLastnameFilterChange,
    onExportExcel
}: HeaderProps) {
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const hasActiveFilters = nameFilter !== 'ALL' || lastnameFilter !== 'ALL';
    const activeFiltersCount = (nameFilter !== 'ALL' ? 1 : 0) + (lastnameFilter !== 'ALL' ? 1 : 0);

    return (
        <>
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Top Bar */}
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                        {/* Left: Title & Institution */}
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold text-slate-900">
                                Estudiantes
                            </h1>

                            {/* Institution Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {[
                                    { value: 'ALL', label: 'Todos', color: 'slate' },
                                    { value: 'IETAC', label: 'IETAC', color: 'indigo' },
                                    { value: 'SG', label: 'SG', color: 'emerald' }
                                ].map(tab => (
                                    <button
                                        key={tab.value}
                                        onClick={() => onInstitutionChange(tab.value)}
                                        className={clsx(
                                            "px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-150",
                                            institutionFilter === tab.value
                                                ? tab.color === 'slate'
                                                    ? "bg-white text-slate-800 shadow-sm"
                                                    : tab.color === 'indigo'
                                                        ? "bg-indigo-500 text-white shadow-sm"
                                                        : "bg-emerald-500 text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: Search & Actions */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            {/* Search */}
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    placeholder="Buscar estudiante..."
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={onExportExcel}
                                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Descargar Excel"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                <button
                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative"
                                    title="Notificaciones"
                                >
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                                </button>
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold ml-1">
                                    AD
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Filters */}
                    <div className="hidden md:flex gap-4 pb-4">
                        <div className="flex-1">
                            <AlphabetFilter
                                label="Filtrar por Nombre"
                                value={nameFilter}
                                onChange={onNameFilterChange}
                                alphabet={alphabet}
                                accentColor="indigo"
                            />
                        </div>
                        <div className="flex-1">
                            <AlphabetFilter
                                label="Filtrar por Apellido"
                                value={lastnameFilter}
                                onChange={onLastnameFilterChange}
                                alphabet={alphabet}
                                accentColor="emerald"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Filters FAB */}
            <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className={clsx(
                    "md:hidden fixed bottom-16 right-4 z-50 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95",
                    hasActiveFilters
                        ? "bg-indigo-500 shadow-indigo-500/30"
                        : "bg-slate-700 shadow-slate-700/30"
                )}
                title="Filtros"
            >
                <SlidersHorizontal className="w-5 h-5 text-white" />
                {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white">
                        {activeFiltersCount}
                    </span>
                )}
            </button>

            {/* Mobile Filters Modal */}
            {isMobileFiltersOpen && (
                <div
                    className="fixed inset-0 z-50 md:hidden bg-black/50"
                    onClick={() => setIsMobileFiltersOpen(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
                        </div>

                        {/* Header */}
                        <div className="px-5 pb-4 flex items-center justify-between border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Filter className="w-5 h-5 text-indigo-500" />
                                Filtros
                            </h3>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        onNameFilterChange('ALL');
                                        onLastnameFilterChange('ALL');
                                    }}
                                    className="text-xs font-semibold text-red-500"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="p-5 space-y-4 overflow-y-auto max-h-[50vh]">
                            <AlphabetFilter
                                label="Filtrar por Nombre"
                                value={nameFilter}
                                onChange={onNameFilterChange}
                                alphabet={alphabet}
                                accentColor="indigo"
                            />
                            <AlphabetFilter
                                label="Filtrar por Apellido"
                                value={lastnameFilter}
                                onChange={onLastnameFilterChange}
                                alphabet={alphabet}
                                accentColor="emerald"
                            />
                        </div>

                        {/* Action */}
                        <div className="p-5 border-t border-slate-100 bg-slate-50">
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="w-full py-3 bg-indigo-500 text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                            >
                                Ver Resultados
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
