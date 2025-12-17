import { Search, Bell, X, Filter } from 'lucide-react';
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

// Helper component for Filters
const FilterSection = ({
    mobile = false,
    nameFilter,
    onNameFilterChange,
    lastnameFilter,
    onLastnameFilterChange,
    alphabet
}: {
    mobile?: boolean;
    nameFilter: string;
    onNameFilterChange: (val: string) => void;
    lastnameFilter: string;
    onLastnameFilterChange: (val: string) => void;
    alphabet: string[];
}) => (
    <div className={clsx("flex flex-col gap-3", mobile ? "p-4" : "hidden md:flex")}>
        {/* Name Filter */}
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Nombre</span>
            <div className="flex flex-wrap gap-1">
                <button
                    onClick={() => onNameFilterChange('ALL')}
                    className={clsx(
                        "h-7 px-2 text-xs font-medium rounded transition-all",
                        nameFilter === 'ALL'
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    Todos
                </button>
                {alphabet.map(letter => (
                    <button
                        key={`name-${letter}`}
                        onClick={() => onNameFilterChange(letter)}
                        className={clsx(
                            "w-7 h-7 text-xs font-medium rounded transition-all flex items-center justify-center",
                            nameFilter === letter
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        {letter}
                    </button>
                ))}
            </div>
        </div>

        {/* Lastname Filter */}
        <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Apellido</span>
            <div className="flex flex-wrap gap-1">
                <button
                    onClick={() => onLastnameFilterChange('ALL')}
                    className={clsx(
                        "h-7 px-2 text-xs font-medium rounded transition-all",
                        lastnameFilter === 'ALL'
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    Todos
                </button>
                {alphabet.map(letter => (
                    <button
                        key={`lastname-${letter}`}
                        onClick={() => onLastnameFilterChange(letter)}
                        className={clsx(
                            "w-7 h-7 text-xs font-medium rounded transition-all flex items-center justify-center",
                            lastnameFilter === letter
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        {letter}
                    </button>
                ))}
            </div>
        </div>
    </div>
);

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

    return (
        <>
            <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
                    {/* Top Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                        {/* Title & Institution Toggle */}
                        <div className="flex items-center justify-between sm:justify-start gap-6 min-w-0">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight shrink-0">
                                Estudiantes
                            </h2>

                            {/* Improved Institution Toggle */}
                            <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner shrink-0">
                                <button
                                    onClick={() => onInstitutionChange('ALL')}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'ALL'
                                            ? "bg-white text-slate-800 shadow-sm ring-1 ring-black/5"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => onInstitutionChange('IETAC')}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'IETAC'
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                            : "text-slate-500 hover:text-indigo-600"
                                    )}
                                >
                                    IETAC
                                </button>
                                <button
                                    onClick={() => onInstitutionChange('SG')}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200",
                                        institutionFilter === 'SG'
                                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                                            : "text-slate-500 hover:text-emerald-600"
                                    )}
                                >
                                    SG
                                </button>
                            </div>
                        </div>

                        {/* Search & Actions */}
                        <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
                            {/* Search Bar - Responsive */}
                            <div className="relative group w-full max-w-md transition-all duration-300">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    className="w-full pl-9 pr-9 py-2 bg-slate-100/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Buscar..."
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => onSearchChange('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Desktop Notification & User */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all relative"
                                    title="Notificaciones"
                                >
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white ml-1">
                                    AD
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Filters (Visible on MD+) */}
                    <div className="hidden md:block border-t border-slate-100 pt-3">
                        <FilterSection
                            nameFilter={nameFilter}
                            onNameFilterChange={onNameFilterChange}
                            lastnameFilter={lastnameFilter}
                            onLastnameFilterChange={onLastnameFilterChange}
                            alphabet={alphabet}
                        />
                    </div>
                </div>
            </header>

            {/* Mobile Filters FAB (Floating Bubble) */}
            <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95"
                title="Abrir filtros"
            >
                <Filter className="w-6 h-6" />
                {(nameFilter !== 'ALL' || lastnameFilter !== 'ALL') && (
                    <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-indigo-600 animate-pulse"></span>
                )}
            </button>

            {/* Mobile Filters Drawer/Modal */}
            {isMobileFiltersOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div
                        className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-indigo-600" />
                                Filtros Avanzados
                            </h3>
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto">
                            <FilterSection
                                mobile={true}
                                nameFilter={nameFilter}
                                onNameFilterChange={onNameFilterChange}
                                lastnameFilter={lastnameFilter}
                                onLastnameFilterChange={onLastnameFilterChange}
                                alphabet={alphabet}
                            />
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsMobileFiltersOpen(false)}
                                className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl w-full shadow-md shadow-indigo-200 active:scale-95 transition-all"
                            >
                                Ver Resultados
                            </button>
                        </div>
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setIsMobileFiltersOpen(false)} />
                </div>
            )}
        </>
    );
}
