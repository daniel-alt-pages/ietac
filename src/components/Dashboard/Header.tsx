import { Search, Bell, X, Filter, SlidersHorizontal } from 'lucide-react';
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
}

// Componente de filtro alfabético mejorado
const AlphabetFilter = ({
    label,
    value,
    onChange,
    alphabet,
    colorScheme = 'indigo'
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    alphabet: string[];
    colorScheme?: 'indigo' | 'emerald';
}) => {
    const colors = {
        indigo: {
            active: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25',
            inactive: 'bg-white/60 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60'
        },
        emerald: {
            active: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25',
            inactive: 'bg-white/60 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200/60'
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                {value !== 'ALL' && (
                    <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        colorScheme === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                    )}>
                        {value}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap gap-1">
                <button
                    onClick={() => onChange('ALL')}
                    className={clsx(
                        "h-8 px-3 text-xs font-semibold rounded-lg transition-all duration-200",
                        value === 'ALL' ? colors[colorScheme].active : colors[colorScheme].inactive
                    )}
                >
                    Todos
                </button>
                {alphabet.map(letter => (
                    <button
                        key={letter}
                        onClick={() => onChange(letter)}
                        className={clsx(
                            "w-8 h-8 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center",
                            value === letter ? colors[colorScheme].active : colors[colorScheme].inactive
                        )}
                    >
                        {letter}
                    </button>
                ))}
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
    onLastnameFilterChange
}: HeaderProps) {
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const hasActiveFilters = nameFilter !== 'ALL' || lastnameFilter !== 'ALL';

    return (
        <>
            <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    {/* Top Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                        {/* Title & Institution Toggle */}
                        <div className="flex items-center justify-between sm:justify-start gap-4 min-w-0">
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight shrink-0">
                                📚 Estudiantes
                            </h2>

                            {/* Institution Segmented Control */}
                            <div className="flex p-1 bg-slate-100 rounded-xl shrink-0">
                                <button
                                    onClick={() => onInstitutionChange('ALL')}
                                    className={clsx(
                                        "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'ALL'
                                            ? "bg-white text-slate-800 shadow-md"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => onInstitutionChange('IETAC')}
                                    className={clsx(
                                        "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'IETAC'
                                            ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                                            : "text-slate-500 hover:text-indigo-600"
                                    )}
                                >
                                    IETAC
                                </button>
                                <button
                                    onClick={() => onInstitutionChange('SG')}
                                    className={clsx(
                                        "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'SG'
                                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                            : "text-slate-500 hover:text-emerald-600"
                                    )}
                                >
                                    SG
                                </button>
                            </div>
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                            <div className="relative group w-full max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                    placeholder="Buscar por nombre, ID..."
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative"
                                    title="Notificaciones"
                                >
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                                </button>
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/20">
                                    AD
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Filters */}
                    <div className="hidden md:block mt-4 pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <AlphabetFilter
                                label="Filtrar por Nombre"
                                value={nameFilter}
                                onChange={onNameFilterChange}
                                alphabet={alphabet}
                                colorScheme="indigo"
                            />
                            <AlphabetFilter
                                label="Filtrar por Apellido"
                                value={lastnameFilter}
                                onChange={onLastnameFilterChange}
                                alphabet={alphabet}
                                colorScheme="emerald"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Filters FAB */}
            <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className={clsx(
                    "md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-95",
                    hasActiveFilters
                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-indigo-500/40"
                        : "bg-slate-800 shadow-slate-800/30"
                )}
                title="Abrir filtros"
            >
                <SlidersHorizontal className="w-6 h-6 text-white" />
                {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full ring-2 ring-white text-[10px] font-bold text-white flex items-center justify-center">
                        {(nameFilter !== 'ALL' ? 1 : 0) + (lastnameFilter !== 'ALL' ? 1 : 0)}
                    </span>
                )}
            </button>

            {/* Mobile Filters Modal */}
            {isMobileFiltersOpen && (
                <div
                    className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsMobileFiltersOpen(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
                        </div>

                        {/* Header */}
                        <div className="px-5 pb-4 flex items-center justify-between">
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
                                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                                >
                                    Limpiar todo
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="px-5 pb-6 space-y-5 overflow-y-auto max-h-[60vh]">
                            <AlphabetFilter
                                label="Filtrar por Nombre"
                                value={nameFilter}
                                onChange={onNameFilterChange}
                                alphabet={alphabet}
                                colorScheme="indigo"
                            />
                            <AlphabetFilter
                                label="Filtrar por Apellido"
                                value={lastnameFilter}
                                onChange={onLastnameFilterChange}
                                alphabet={alphabet}
                                colorScheme="emerald"
                            />
                        </div>

                        {/* Action */}
                        <div className="px-5 pb-8 pt-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all"
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
