"use client";

import { GraduationCap, Database, PieChart, Settings } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    activeView?: 'data' | 'statistics' | 'settings';
    onViewChange?: (view: 'data' | 'statistics' | 'settings') => void;
}

export default function Sidebar({ activeView = 'data', onViewChange }: SidebarProps) {
    return (
        <aside className="hidden md:flex w-20 lg:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 transition-all duration-300">
            <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
                <GraduationCap className="w-8 h-8 text-indigo-400" />
                <span className="ml-3 font-bold text-lg hidden lg:block tracking-wide">EduManager</span>
            </div>
            <nav className="flex-1 py-6 space-y-1">
                <NavButton
                    icon={<Database className="w-5 h-5" />}
                    label="Base de Datos"
                    active={activeView === 'data'}
                    onClick={() => onViewChange?.('data')}
                />
                <NavButton
                    icon={<PieChart className="w-5 h-5" />}
                    label="Estadísticas"
                    active={activeView === 'statistics'}
                    onClick={() => onViewChange?.('statistics')}
                />
                <NavButton
                    icon={<Settings className="w-5 h-5" />}
                    label="Configuración"
                    active={activeView === 'settings'}
                    onClick={() => onViewChange?.('settings')}
                />
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center justify-center lg:justify-start group cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-200 flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/20">AD</div>
                    <div className="ml-3 hidden lg:block">
                        <p className="text-sm font-medium group-hover:text-indigo-300 transition-colors">Admin User</p>
                        <p className="text-xs text-green-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            Online
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

function NavButton({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full flex items-center px-4 lg:px-6 py-3 transition-colors relative group",
                active
                    ? "bg-indigo-600/10 text-white border-r-4 border-indigo-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
        >
            <span className={clsx("transition-transform group-hover:scale-110", active && "text-indigo-400")}>{icon}</span>
            <span className="ml-3 hidden lg:block font-medium">{label}</span>
            {active && <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-transparent pointer-events-none" />}
        </button>
    );
}
