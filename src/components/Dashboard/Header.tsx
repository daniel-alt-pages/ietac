import { Search, Bell, X } from 'lucide-react';
import clsx from 'clsx';

interface HeaderProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export default function Header({ searchTerm, onSearchChange }: HeaderProps) {
    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

                {/* Title - Hidden on very small screens to give space to search */}
                <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight hidden xs:block truncate shrink-0">
                    Estudiantes
                </h2>

                {/* Search Bar Container */}
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

                {/* Notifications & User Actions */}
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
        </header>
    );
}
