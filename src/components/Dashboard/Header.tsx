"use client";

import { Search, Bell, X, Filter, SlidersHorizontal, Download, ChevronDown, LogOut, User, CheckCircle, Clock, Phone, MessageCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect, useRef } from 'react';
import { ActivityEvent } from '@/lib/firebase';

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
    onLogout: () => void;
    // New notification props
    activityEvents?: ActivityEvent[];
    todayLogins?: number;
    todayConfirmations?: number;
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
    onExportExcel,
    onLogout,
    activityEvents = [],
    todayLogins = 0,
    todayConfirmations = 0
}: HeaderProps) {
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notificationFilter, setNotificationFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
    const notificationRef = useRef<HTMLDivElement>(null);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    const hasActiveFilters = nameFilter !== 'ALL' || lastnameFilter !== 'ALL';
    const activeFiltersCount = (nameFilter !== 'ALL' ? 1 : 0) + (lastnameFilter !== 'ALL' ? 1 : 0);

    // Close notifications on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Format relative time
    const getRelativeTime = (timestamp: string) => {
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        return then.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    };

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

                                {/* Notifications Dropdown */}
                                <div className="relative" ref={notificationRef}>
                                    <button
                                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                        className={clsx(
                                            "p-2 rounded-lg transition-colors relative",
                                            isNotificationsOpen
                                                ? "text-indigo-600 bg-indigo-50"
                                                : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                        )}
                                        title="Notificaciones"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {activityEvents.length > 0 && (
                                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                                        )}
                                    </button>

                                    {/* Dropdown Panel - AMPLIADO Y PROFESIONAL */}
                                    {isNotificationsOpen && (
                                        <div className="fixed inset-x-0 top-0 bottom-0 md:absolute md:inset-auto md:right-0 md:top-auto md:mt-2 md:w-[420px] bg-white md:rounded-2xl shadow-2xl md:border md:border-slate-200 overflow-hidden z-50">
                                            {/* Header Premium */}
                                            <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 px-4 py-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-white font-bold text-sm md:text-base flex items-center gap-2">
                                                        <Bell className="w-4 h-4" />
                                                        Centro de Actividad
                                                    </h3>
                                                    <button
                                                        onClick={() => setIsNotificationsOpen(false)}
                                                        className="text-white/60 hover:text-white transition-colors p-1"
                                                        title="Cerrar"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                {/* Stats Grid - Responsive */}
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 text-center">
                                                        <div className="text-xl md:text-2xl font-bold text-white">{todayLogins}</div>
                                                        <div className="text-[9px] md:text-[10px] text-indigo-200 uppercase tracking-wide">Logins</div>
                                                    </div>
                                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 text-center">
                                                        <div className="text-xl md:text-2xl font-bold text-green-400">{todayConfirmations}</div>
                                                        <div className="text-[9px] md:text-[10px] text-green-200 uppercase tracking-wide">OK</div>
                                                    </div>
                                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-3 text-center">
                                                        <div className="text-xl md:text-2xl font-bold text-amber-400">{todayLogins - todayConfirmations}</div>
                                                        <div className="text-[9px] md:text-[10px] text-amber-200 uppercase tracking-wide">Pend.</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Filter Tabs */}
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                                <div className="flex gap-1">
                                                    {[
                                                        { key: 'all', label: 'Todos', icon: User },
                                                        { key: 'pending', label: 'Pendientes', icon: AlertCircle },
                                                        { key: 'confirmed', label: 'Confirmados', icon: CheckCircle }
                                                    ].map((tab) => (
                                                        <button
                                                            key={tab.key}
                                                            onClick={() => setNotificationFilter(tab.key as 'all' | 'pending' | 'confirmed')}
                                                            className={clsx(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                                notificationFilter === tab.key
                                                                    ? "bg-indigo-500 text-white shadow-sm"
                                                                    : "text-slate-500 hover:bg-slate-100"
                                                            )}
                                                        >
                                                            <tab.icon className="w-3.5 h-3.5" />
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Events List - AGRUPADO POR ESTUDIANTE */}
                                            <div className="max-h-[50vh] overflow-y-auto">
                                                {activityEvents.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-400">
                                                        <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                        <p className="text-sm font-medium">No hay actividad reciente</p>
                                                        <p className="text-xs mt-1">Los eventos aparecerán aquí</p>
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        // Agrupar eventos por estudiante
                                                        const grouped = activityEvents.reduce((acc, event) => {
                                                            if (!acc[event.studentId]) {
                                                                acc[event.studentId] = {
                                                                    studentId: event.studentId,
                                                                    studentName: event.studentName,
                                                                    institution: event.institution,
                                                                    phone: event.phone,
                                                                    events: [],
                                                                    hasConfirmed: false,
                                                                    hasLogin: false,
                                                                    lastTimestamp: event.timestamp
                                                                };
                                                            }
                                                            acc[event.studentId].events.push(event);
                                                            if (event.type === 'confirmation') acc[event.studentId].hasConfirmed = true;
                                                            if (event.type === 'login') acc[event.studentId].hasLogin = true;
                                                            return acc;
                                                        }, {} as Record<string, {
                                                            studentId: string;
                                                            studentName: string;
                                                            institution: string;
                                                            phone?: string;
                                                            events: ActivityEvent[];
                                                            hasConfirmed: boolean;
                                                            hasLogin: boolean;
                                                            lastTimestamp: string;
                                                        }>);

                                                        // Aplicar filtro
                                                        let groupedList = Object.values(grouped);
                                                        if (notificationFilter === 'pending') {
                                                            groupedList = groupedList.filter(s => s.hasLogin && !s.hasConfirmed);
                                                        } else if (notificationFilter === 'confirmed') {
                                                            groupedList = groupedList.filter(s => s.hasConfirmed);
                                                        }
                                                        groupedList = groupedList.slice(0, 15);

                                                        if (groupedList.length === 0) {
                                                            return (
                                                                <div className="p-6 text-center text-slate-400">
                                                                    <p className="text-sm">No hay estudiantes en esta categoría</p>
                                                                </div>
                                                            );
                                                        }

                                                        return groupedList.map((student, idx) => {
                                                            const isIncomplete = student.hasLogin && !student.hasConfirmed;
                                                            return (
                                                                <div
                                                                    key={student.studentId}
                                                                    className={clsx(
                                                                        "px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group",
                                                                        idx === 0 && "bg-gradient-to-r from-indigo-50/50 to-transparent",
                                                                        isIncomplete && "bg-gradient-to-r from-amber-50/50 to-transparent"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        {/* Avatar con inicial */}
                                                                        <div className={clsx(
                                                                            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-sm",
                                                                            student.hasConfirmed && "bg-gradient-to-br from-green-400 to-emerald-500 text-white",
                                                                            isIncomplete && "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
                                                                            !student.hasLogin && !student.hasConfirmed && "bg-gradient-to-br from-blue-400 to-indigo-500 text-white"
                                                                        )}>
                                                                            {student.studentName.charAt(0).toUpperCase()}
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between">
                                                                                <p className="text-sm font-bold text-slate-800 truncate">
                                                                                    {student.studentName}
                                                                                </p>
                                                                                <span className={clsx(
                                                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                                                                                    student.institution === 'IETAC' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                                                                                )}>
                                                                                    {student.institution}
                                                                                </span>
                                                                            </div>

                                                                            {/* Estado y badges */}
                                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                                {student.hasConfirmed ? (
                                                                                    <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                                                                                        <CheckCircle className="w-3.5 h-3.5" />
                                                                                        Cuenta creada
                                                                                    </span>
                                                                                ) : isIncomplete ? (
                                                                                    <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium animate-pulse">
                                                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                                                        Pendiente de confirmar
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                                                                                        <User className="w-3.5 h-3.5" />
                                                                                        Sesión activa
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-slate-300">•</span>
                                                                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                                                    <Clock className="w-3 h-3" />
                                                                                    {getRelativeTime(student.lastTimestamp)}
                                                                                </span>
                                                                            </div>

                                                                            {/* Acciones rápidas */}
                                                                            {student.phone && (
                                                                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <a
                                                                                        href={`https://wa.me/57${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${student.studentName.split(' ')[0]}, soy del equipo académico. ¿Pudiste crear tu cuenta de Gmail correctamente?`)}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        <MessageCircle className="w-3 h-3" />
                                                                                        WhatsApp
                                                                                    </a>
                                                                                    <a
                                                                                        href={`tel:+57${student.phone.replace(/\D/g, '')}`}
                                                                                        className="flex items-center gap-1 bg-slate-500 hover:bg-slate-600 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        <Phone className="w-3 h-3" />
                                                                                        Llamar
                                                                                    </a>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                                                <p className="text-[11px] text-slate-400 text-center">
                                                    Mostrando últimos {Math.min(activityEvents.length, 15)} estudiantes con actividad
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="h-6 w-px bg-slate-200 mx-2"></div>

                                <button
                                    onClick={onLogout}
                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 group"
                                    title="Cerrar sesión"
                                >
                                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-medium hidden sm:block">Salir</span>
                                </button>
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
            </header >

            {/* Mobile Filters FAB - AHORA INTEGRADO EN MobileNav */}
            {/* 
            <button
                onClick={() => setIsMobileFiltersOpen(true)}
                className={clsx(
                    "md:hidden fixed bottom-28 right-4 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95",
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
            */}

            {/* Mobile Filters Modal */}
            {
                isMobileFiltersOpen && (
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
                )
            }
        </>
    );
}
