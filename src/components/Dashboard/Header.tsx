import { Search, Bell, X, Building2 } from 'lucide-react';
import clsx from 'clsx';

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


export default function Header({ searchTerm, onSearchChange, institutionFilter, onInstitutionChange, nameFilter, onNameFilterChange, lastnameFilter, onLastnameFilterChange }: HeaderProps) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
                {/* First Row: Title, Institution Filter, Search */}
                <div className="flex items-center justify-between gap-4">
                    {/* Title */}
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight hidden xs:block truncate shrink-0">
                        Estudiantes
                    </h2>

                    {/* Institution Filter */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400 hidden sm:block" />
                        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => onInstitutionChange('ALL')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    institutionFilter === 'ALL'
                                        ? "bg-white text-slate-800 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => onInstitutionChange('IETAC')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    institutionFilter === 'IETAC'
                                        ? "bg-indigo-500 text-white shadow-md"
                                        : "text-slate-500 hover:text-indigo-600"
                                )}
                            >
                                IETAC
                            </button>
                            <button
                                onClick={() => onInstitutionChange('SG')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    institutionFilter === 'SG'
                                        ? "bg-emerald-500 text-white shadow-md"
                                        : "text-slate-500 hover:text-emerald-600"
                                )}
                            >
                                SG
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-2xl flex justify-end md:justify-center">
                        <div className="relative group w-full max-w-md transition-all duration-300 focus-within:max-w-lg">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm hover:border-slate-300"
                                placeholder="Buscar por nombre, ID o email..."
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => onSearchChange('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* User Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all relative group" aria-label="Notificaciones">
                            <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white ml-1">
                            AD
                        </div>
                    </div>
                </div>

                {/* Second Row: Alphabetical Filters */}
                <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
                    {/* Name Filter */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-600">Nombre:</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onNameFilterChange('ALL')}
                                className={clsx(
                                    "px-2 py-1 text-xs font-medium rounded transition-all",
                                    nameFilter === 'ALL'
                                        ? "bg-indigo-500 text-white shadow-sm"
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
                                        "w-7 h-7 text-xs font-medium rounded transition-all",
                                        nameFilter === letter
                                            ? "bg-indigo-500 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lastname Filter */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-600">Apellido:</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onLastnameFilterChange('ALL')}
                                className={clsx(
                                    "px-2 py-1 text-xs font-medium rounded transition-all",
                                    lastnameFilter === 'ALL'
                                        ? "bg-emerald-500 text-white shadow-sm"
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
                                        "w-7 h-7 text-xs font-medium rounded transition-all",
                                        lastnameFilter === letter
                                            ? "bg-emerald-500 text-white shadow-sm"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    {letter}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
