"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
StudentDocument,
    getAllStudentsFromFirestore
} from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, addDoc, getDocs, where } from 'firebase/firestore';
import { db, dbSecondary } from '@/lib/firebase';
import * as XLSX from 'xlsx';

interface AdminControlCenterProps {
    adminId: string;
    onClose: () => void;
}

interface AdminAlert {
    id: string;
    title: string;
    message: string;
    type: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: string;
    read: boolean;
}

type TabType = 'verification' | 'notifications' | 'broadcast' | 'activity';
type FilterStatus = 'ALL' | 'VERIFIED' | 'MISMATCH' | 'PENDING';
type FilterInstitution = 'ALL' | 'IETAC' | 'SG';
type FilterGender = 'ALL' | 'Mujer' | 'Hombre';
type FilterDateRange = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type SortField = 'name' | 'date' | 'status' | 'institution';
type SortOrder = 'asc' | 'desc';

export default function AdminControlCenter({ adminId, onClose }: AdminControlCenterProps) {
    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('verification');

    // Verification states
    const [students, setStudents] = useState<StudentDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
    const [institutionFilter, setInstitutionFilter] = useState<FilterInstitution>('ALL');
    const [genderFilter, setGenderFilter] = useState<FilterGender>('ALL');
    const [dateRangeFilter, setDateRangeFilter] = useState<FilterDateRange>('ALL');
    const [customDateFrom, setCustomDateFrom] = useState('');
    const [customDateTo, setCustomDateTo] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Notification states
    const [alerts, setAlerts] = useState<AdminAlert[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Broadcast states
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'urgent'>('info');
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'pending' | 'verified' | 'ietac' | 'sg'>('all');
    const [sending, setSending] = useState(false);

    // Load students
    const loadStudents = useCallback(async () => {
        setLoading(true);
        const data = await getAllStudentsFromFirestore();
        setStudents(data.filter(s => !s.deleted));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    // Load alerts
    useEffect(() => {
        const alertsCollection = collection(dbSecondary, 'admin_alerts');
        const q = query(alertsCollection, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const alertsData: AdminAlert[] = [];
            snapshot.forEach((doc) => {
                alertsData.push({ id: doc.id, ...doc.data() } as AdminAlert);
            });
            setAlerts(alertsData);
            setUnreadCount(alertsData.filter(a => !a.read).length);
        });

        return () => unsubscribe();
    }, []);

    // Helpers
    const getAssignedEmail = (s: StudentDocument): string => {
        const email = s.email || s.emailNormalized || s.assignedEmail || '';
        if (!email) return 'Sin asignar';
        return email.includes('@') ? email : `${email}@gmail.com`;
    };

    const getVerifiedEmail = (s: StudentDocument): string | null => {
        return s.verifiedWithEmail || s.googleEmail || null;
    };

    const getStatus = (s: StudentDocument): 'VERIFIED' | 'MISMATCH' | 'PENDING' => {
        const verified = getVerifiedEmail(s);
        if (s.verificationStatus === 'VERIFIED' && verified) return 'VERIFIED';
        if (s.verificationStatus === 'MISMATCH') {
            if (!verified) return 'PENDING';
            const assigned = getAssignedEmail(s).toLowerCase().replace('@gmail.com', '');
            const usedNormalized = verified.toLowerCase().replace('@gmail.com', '');
            return assigned === usedNormalized ? 'VERIFIED' : 'MISMATCH';
        }
        if (s.verificationStatus === 'PENDING' || !s.verificationStatus) return 'PENDING';
        if (!verified) return 'PENDING';
        const assigned = getAssignedEmail(s).toLowerCase().replace('@gmail.com', '');
        const usedNormalized = verified.toLowerCase().replace('@gmail.com', '');
        return assigned === usedNormalized ? 'VERIFIED' : 'MISMATCH';
    };

    const getName = (s: StudentDocument): string => {
        const first = s.first || s.firstName || '';
        const last = s.last || s.lastName || '';
        return `${first} ${last}`.trim() || s.studentId;
    };

    const formatDateTime = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('es-CO', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch { return dateStr; }
    };

    const isInDateRange = (dateStr: string | null | undefined): boolean => {
        if (dateRangeFilter === 'ALL' || !dateStr) return true;
        const date = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (dateRangeFilter) {
            case 'TODAY':
                return date >= today;
            case 'WEEK':
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                return date >= weekAgo;
            case 'MONTH':
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                return date >= monthAgo;
            case 'CUSTOM':
                const from = customDateFrom ? new Date(customDateFrom) : null;
                const to = customDateTo ? new Date(customDateTo + 'T23:59:59') : null;
                if (from && date < from) return false;
                if (to && date > to) return false;
                return true;
            default:
                return true;
        }
    };

    // Filtered and sorted data
    const filteredStudents = useMemo(() => {
        let filtered = students;

        // Status filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(s => getStatus(s) === statusFilter);
        }

        // Institution filter
        if (institutionFilter !== 'ALL') {
            filtered = filtered.filter(s => s.institution === institutionFilter);
        }

        // Gender filter
        if (genderFilter !== 'ALL') {
            filtered = filtered.filter(s => s.gender === genderFilter);
        }

        // Date range filter
        filtered = filtered.filter(s => isInDateRange(s.verifiedAt || s.createdAt));

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                s.studentId.toLowerCase().includes(term) ||
                getName(s).toLowerCase().includes(term) ||
                getAssignedEmail(s).toLowerCase().includes(term) ||
                (s.phone || '').includes(term)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let compareA: string | number = '';
            let compareB: string | number = '';

            switch (sortField) {
                case 'name':
                    compareA = getName(a).toLowerCase();
                    compareB = getName(b).toLowerCase();
                    break;
                case 'date':
                    compareA = new Date(a.verifiedAt || a.createdAt || 0).getTime();
                    compareB = new Date(b.verifiedAt || b.createdAt || 0).getTime();
                    break;
                case 'status':
                    const order = { MISMATCH: 0, PENDING: 1, VERIFIED: 2 };
                    compareA = order[getStatus(a)];
                    compareB = order[getStatus(b)];
                    break;
                case 'institution':
                    compareA = a.institution || '';
                    compareB = b.institution || '';
                    break;
            }

            if (sortOrder === 'asc') {
                return compareA < compareB ? -1 : compareA > compareB ? 1 : 0;
            } else {
                return compareA > compareB ? -1 : compareA < compareB ? 1 : 0;
            }
        });

        return filtered;
    }, [students, statusFilter, institutionFilter, genderFilter, dateRangeFilter, customDateFrom, customDateTo, searchTerm, sortField, sortOrder]);

    // Stats
    const stats = useMemo(() => {
        const verified = students.filter(s => getStatus(s) === 'VERIFIED').length;
        const mismatch = students.filter(s => getStatus(s) === 'MISMATCH').length;
        const pending = students.filter(s => getStatus(s) === 'PENDING').length;
        const ietac = students.filter(s => s.institution === 'IETAC').length;
        const sg = students.filter(s => s.institution === 'SG').length;
        const male = students.filter(s => s.gender === 'Hombre').length;
        const female = students.filter(s => s.gender === 'Mujer').length;
        const verifiedToday = students.filter(s => {
            const verifiedAt = s.verifiedAt ? new Date(s.verifiedAt) : null;
            if (!verifiedAt) return false;
            const today = new Date();
            return verifiedAt.toDateString() === today.toDateString();
        }).length;

        return {
            verified, mismatch, pending, total: students.length,
            ietac, sg, male, female, verifiedToday,
            verificationRate: students.length > 0 ? Math.round((verified / students.length) * 100) : 0
        };
    }, [students]);

    // Export to Excel
    const exportToXLSX = () => {
        const data = filteredStudents.map(s => ({
            'ID': s.studentId,
            'Nombre': getName(s),
            'Institución': s.institution,
            'Género': s.gender || 'N/A',
            'Email Asignado': getAssignedEmail(s),
            'Email Verificado': getVerifiedEmail(s) || '',
            'Estado': getStatus(s) === 'VERIFIED' ? '✓ Verificado' : getStatus(s) === 'MISMATCH' ? '✕ Error' : '⏳ Pendiente',
            'Fecha Verificación': formatDateTime(s.verifiedAt),
            'Teléfono': s.phone || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 10 },
            { wch: 35 }, { wch: 35 }, { wch: 15 }, { wch: 22 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

        const fileName = `Reporte_Admin_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Mark alert as read
    const markAlertAsRead = async (alertId: string) => {
        try {
            await updateDoc(doc(dbSecondary, 'admin_alerts', alertId), { read: true });
        } catch (error) {
            console.error('Error marking alert:', error);
        }
    };

    // Send broadcast
    const sendBroadcast = async () => {
        if (!broadcastTitle || !broadcastBody) return;
        setSending(true);

        try {
            const broadcastsCollection = collection(dbSecondary, 'broadcast_messages');
            await addDoc(broadcastsCollection, {
                title: broadcastTitle,
                body: broadcastBody,
                type: broadcastType,
                targetAudience: broadcastTarget,
                sentBy: adminId,
                sentAt: new Date().toISOString(),
                recipientCount: broadcastTarget === 'all' ? stats.total :
                    broadcastTarget === 'pending' ? stats.pending :
                        broadcastTarget === 'verified' ? stats.verified :
                            broadcastTarget === 'ietac' ? stats.ietac : stats.sg
            });

            setBroadcastTitle('');
            setBroadcastBody('');
            alert('✅ Mensaje enviado correctamente');
        } catch (error) {
            console.error('Error sending broadcast:', error);
            alert('❌ Error al enviar el mensaje');
        } finally {
            setSending(false);
        }
    };

    // Tab content components
    const renderVerificationTab = () => (
        <div className="flex flex-col h-full">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <div className="bg-white rounded-xl p-3 shadow-sm border">
                    <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                    <p className="text-xs text-slate-500">Total Estudiantes</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-3 shadow-sm border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-600">{stats.verified}</p>
                    <p className="text-xs text-emerald-600">✓ Verificados ({stats.verificationRate}%)</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 shadow-sm border border-amber-200">
                    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                    <p className="text-xs text-amber-600">⏳ Pendientes</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 shadow-sm border border-red-200">
                    <p className="text-2xl font-bold text-red-600">{stats.mismatch}</p>
                    <p className="text-xs text-red-600">✕ Errores</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 shadow-sm border border-blue-200">
                    <p className="text-2xl font-bold text-blue-600">{stats.verifiedToday}</p>
                    <p className="text-xs text-blue-600">📅 Hoy</p>
                </div>
            </div>

            {/* Filters Row */}
            <div className="p-4 bg-white border-b space-y-3">
                {/* Primary Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre, ID, email, teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {/* Status Filter Buttons */}
                    <div className="flex gap-1">
                        {(['ALL', 'VERIFIED', 'PENDING', 'MISMATCH'] as FilterStatus[]).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${statusFilter === status
                                    ? status === 'VERIFIED' ? 'bg-emerald-500 text-white' :
                                        status === 'PENDING' ? 'bg-amber-500 text-white' :
                                            status === 'MISMATCH' ? 'bg-red-500 text-white' :
                                                'bg-blue-500 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    }`}
                            >
                                {status === 'ALL' ? 'Todos' : status === 'VERIFIED' ? '✓ OK' : status === 'PENDING' ? '⏳' : '✕'}
                            </button>
                        ))}
                    </div>

                    {/* Institution Filter */}
                    <select
                        value={institutionFilter}
                        onChange={(e) => setInstitutionFilter(e.target.value as FilterInstitution)}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                        <option value="ALL">🏫 Todas</option>
                        <option value="IETAC">IETAC ({stats.ietac})</option>
                        <option value="SG">SG ({stats.sg})</option>
                    </select>

                    {/* Toggle Advanced Filters */}
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${showAdvancedFilters ? 'bg-indigo-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                    >
                        ⚙️ {showAdvancedFilters ? 'Ocultar' : 'Más filtros'}
                    </button>
                </div>

                {/* Advanced Filters */}
                {showAdvancedFilters && (
                    <div className="flex flex-wrap gap-3 pt-3 border-t">
                        {/* Gender Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Género:</span>
                            <select
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value as FilterGender)}
                                className="px-2 py-1 border rounded text-sm"
                            >
                                <option value="ALL">Todos</option>
                                <option value="Mujer">👩 Mujer ({stats.female})</option>
                                <option value="Hombre">👨 Hombre ({stats.male})</option>
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Período:</span>
                            <select
                                value={dateRangeFilter}
                                onChange={(e) => setDateRangeFilter(e.target.value as FilterDateRange)}
                                className="px-2 py-1 border rounded text-sm"
                            >
                                <option value="ALL">Todo el tiempo</option>
                                <option value="TODAY">Hoy</option>
                                <option value="WEEK">Última semana</option>
                                <option value="MONTH">Último mes</option>
                                <option value="CUSTOM">Personalizado</option>
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {dateRangeFilter === 'CUSTOM' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(e) => setCustomDateFrom(e.target.value)}
                                    className="px-2 py-1 border rounded text-sm"
                                />
                                <span className="text-xs text-slate-400">a</span>
                                <input
                                    type="date"
                                    value={customDateTo}
                                    onChange={(e) => setCustomDateTo(e.target.value)}
                                    className="px-2 py-1 border rounded text-sm"
                                />
                            </div>
                        )}

                        {/* Sort */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Ordenar:</span>
                            <select
                                value={sortField}
                                onChange={(e) => setSortField(e.target.value as SortField)}
                                className="px-2 py-1 border rounded text-sm"
                            >
                                <option value="date">Fecha</option>
                                <option value="name">Nombre</option>
                                <option value="status">Estado</option>
                                <option value="institution">Institución</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="px-2 py-1 border rounded text-sm hover:bg-slate-100"
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>

                        {/* Reset Filters */}
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('ALL');
                                setInstitutionFilter('ALL');
                                setGenderFilter('ALL');
                                setDateRangeFilter('ALL');
                            }}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded text-sm"
                        >
                            🔄 Limpiar
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <p className="text-4xl mb-2">📭</p>
                        <p>No hay estudiantes que coincidan con los filtros</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100 text-left text-xs font-medium text-slate-600 uppercase">
                            <tr>
                                <th className="px-4 py-3">Estudiante</th>
                                <th className="px-4 py-3 hidden md:table-cell">Email Asignado</th>
                                <th className="px-4 py-3 hidden lg:table-cell">Email Google</th>
                                <th className="px-4 py-3 hidden md:table-cell">Fecha</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-3 py-3 text-center w-12">📱</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStudents.map((student) => {
                                const status = getStatus(student);
                                return (
                                    <tr key={student.studentId} className={`hover:bg-slate-50 ${status === 'MISMATCH' ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-slate-800">{getName(student)}</p>
                                                <p className="text-xs text-slate-500">
                                                    ID: {student.studentId} • {student.institution} • {student.gender || 'N/A'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <p className="text-slate-700 font-mono text-xs break-all">{getAssignedEmail(student)}</p>
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            {getVerifiedEmail(student) ? (
                                                <p className={`font-mono text-xs break-all ${status === 'VERIFIED' ? 'text-emerald-600' : 'text-red-600 font-bold'}`}>
                                                    {getVerifiedEmail(student)}
                                                </p>
                                            ) : (
                                                <p className="text-slate-400 italic text-xs">Sin verificar</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <p className="text-slate-600 text-xs font-mono">{formatDateTime(student.verifiedAt)}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                                                status === 'MISMATCH' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {status === 'VERIFIED' ? '✓ OK' : status === 'MISMATCH' ? '✕ Error' : '⏳'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {student.phone && (
                                                <a
                                                    href={`https://wa.me/57${student.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white inline-flex items-center justify-center transition-all"
                                                >
                                                    📱
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-3 border-t bg-slate-50 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Mostrando <strong>{filteredStudents.length}</strong> de {stats.total}
                </p>
                <button
                    onClick={exportToXLSX}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
                >
                    📊 Exportar Excel
                </button>
            </div>
        </div>
    );

    const renderNotificationsTab = () => (
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">🔔 Centro de Notificaciones</h3>
                {unreadCount > 0 && (
                    <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm">
                        {unreadCount} sin leer
                    </span>
                )}
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <p className="text-4xl mb-2">🔕</p>
                    <p>No hay notificaciones</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => (
                        <div
                            key={alert.id}
                            onClick={() => markAlertAsRead(alert.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${alert.read
                                ? 'bg-white border-slate-200'
                                : 'bg-blue-50 border-blue-200 shadow-sm'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`font-medium ${alert.read ? 'text-slate-700' : 'text-blue-800'}`}>
                                        {alert.title}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">{alert.message}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${alert.priority === 'high' ? 'bg-red-100 text-red-600' :
                                    alert.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                    {alert.priority}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">{formatDateTime(alert.timestamp)}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderBroadcastTab = () => (
        <div className="p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800">📢 Enviar Mensaje Masivo</h3>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de mensaje</label>
                        <div className="flex gap-2">
                            {(['info', 'warning', 'urgent'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setBroadcastType(type)}
                                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${broadcastType === type
                                        ? type === 'info' ? 'bg-blue-500 text-white' :
                                            type === 'warning' ? 'bg-amber-500 text-white' :
                                                'bg-red-500 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200'
                                        }`}
                                >
                                    {type === 'info' ? 'ℹ️ Info' : type === 'warning' ? '⚠️ Aviso' : '🚨 Urgente'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Audiencia</label>
                        <select
                            value={broadcastTarget}
                            onChange={(e) => setBroadcastTarget(e.target.value as typeof broadcastTarget)}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="all">👥 Todos ({stats.total})</option>
                            <option value="pending">⏳ Pendientes ({stats.pending})</option>
                            <option value="verified">✓ Verificados ({stats.verified})</option>
                            <option value="ietac">🏫 IETAC ({stats.ietac})</option>
                            <option value="sg">🎓 SG ({stats.sg})</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                        <input
                            type="text"
                            value={broadcastTitle}
                            onChange={(e) => setBroadcastTitle(e.target.value)}
                            placeholder="Título del mensaje..."
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
                        <textarea
                            value={broadcastBody}
                            onChange={(e) => setBroadcastBody(e.target.value)}
                            placeholder="Escribe tu mensaje aquí..."
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg resize-none"
                        />
                    </div>

                    <button
                        onClick={sendBroadcast}
                        disabled={sending || !broadcastTitle || !broadcastBody}
                        className={`w-full py-3 rounded-lg font-medium transition-all ${sending || !broadcastTitle || !broadcastBody
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg'
                            }`}
                    >
                        {sending ? '⏳ Enviando...' : '📤 Enviar Mensaje'}
                    </button>
                </div>

                {/* Preview */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vista previa</label>
                    <div className={`rounded-xl p-4 border-2 ${broadcastType === 'info' ? 'bg-blue-50 border-blue-200' :
                        broadcastType === 'warning' ? 'bg-amber-50 border-amber-200' :
                            'bg-red-50 border-red-200'
                        }`}>
                        <p className={`font-bold ${broadcastType === 'info' ? 'text-blue-800' :
                            broadcastType === 'warning' ? 'text-amber-800' :
                                'text-red-800'
                            }`}>
                            {broadcastTitle || 'Título del mensaje'}
                        </p>
                        <p className="text-slate-600 mt-2 text-sm">
                            {broadcastBody || 'El contenido de tu mensaje aparecerá aquí...'}
                        </p>
                        <p className="text-xs text-slate-400 mt-4">
                            Se enviará a: {
                                broadcastTarget === 'all' ? `Todos (${stats.total})` :
                                    broadcastTarget === 'pending' ? `Pendientes (${stats.pending})` :
                                        broadcastTarget === 'verified' ? `Verificados (${stats.verified})` :
                                            broadcastTarget === 'ietac' ? `IETAC (${stats.ietac})` :
                                                `SG (${stats.sg})`
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl">
            <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🎛️</span>
                            </div>
                            <div>
                                <h1 className="text-white font-bold text-xl">Centro de Control Administrativo</h1>
                                <p className="text-white/70 text-sm">Gestión unificada de verificaciones, notificaciones y comunicaciones</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setLoading(true); loadStudents(); }}
                                disabled={loading}
                                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all disabled:opacity-50"
                                title="Refrescar"
                            >
                                <span className={loading ? 'animate-spin' : ''}>🔄</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="shrink-0 px-6 border-b bg-slate-50">
                    <div className="flex gap-1">
                        {([
                            { id: 'verification', label: '📊 Verificaciones', badge: stats.pending },
                            { id: 'notifications', label: '🔔 Notificaciones', badge: unreadCount },
                            { id: 'broadcast', label: '📢 Broadcast', badge: 0 }
                        ] as { id: TabType; label: string; badge: number }[]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 text-sm font-medium transition-all relative ${activeTab === tab.id
                                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab.label}
                                {tab.badge > 0 && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'verification' && renderVerificationTab()}
                    {activeTab === 'notifications' && renderNotificationsTab()}
                    {activeTab === 'broadcast' && renderBroadcastTab()}
                </div>
            </div>
        </div>
    );
}
