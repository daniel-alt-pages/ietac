"use client";

import { useState, useEffect } from 'react';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs
} from 'firebase/firestore';
import { dbSecondary } from '@/lib/firebase';

interface BroadcastMessage {
    id: string;
    title: string;
    body: string;
    type: 'info' | 'warning' | 'urgent';
    targetAudience: string;
    sentBy: string;
    sentAt: string;
    recipientCount: number;
}

interface BroadcastHistoryProps {
    onClose: () => void;
}

export default function BroadcastHistory({ onClose }: BroadcastHistoryProps) {
    const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'warning' | 'urgent'>('all');

    useEffect(() => {
        loadBroadcasts();
    }, []);

    async function loadBroadcasts() {
        try {
            const broadcastsQuery = query(
                collection(dbSecondary, 'broadcast_messages'),
                orderBy('sentAt', 'desc'),
                limit(50)
            );
            const snapshot = await getDocs(broadcastsQuery);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BroadcastMessage[];
            setBroadcasts(data);
        } catch (error) {
            console.error('Error loading broadcasts:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredBroadcasts = broadcasts.filter(b => {
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            if (!b.title.toLowerCase().includes(search) &&
                !b.body.toLowerCase().includes(search)) {
                return false;
            }
        }
        if (typeFilter !== 'all' && b.type !== typeFilter) return false;
        return true;
    });

    const typeConfig = {
        info: { icon: 'ℹ️', color: 'blue', label: 'Informativo', bg: 'bg-blue-100', text: 'text-blue-600' },
        warning: { icon: '⚠️', color: 'amber', label: 'Advertencia', bg: 'bg-amber-100', text: 'text-amber-600' },
        urgent: { icon: '🚨', color: 'red', label: 'Urgente', bg: 'bg-red-100', text: 'text-red-600' }
    };

    const audienceLabels: Record<string, string> = {
        all: '👥 Todos',
        pending: '⏳ Pendientes',
        verified: '✅ Verificados',
        ietac: '🏫 IETAC',
        sg: '📚 SG'
    };

    function formatDate(dateStr: string) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const stats = {
        total: broadcasts.length,
        totalRecipients: broadcasts.reduce((acc, b) => acc + b.recipientCount, 0),
        byType: {
            info: broadcasts.filter(b => b.type === 'info').length,
            warning: broadcasts.filter(b => b.type === 'warning').length,
            urgent: broadcasts.filter(b => b.type === 'urgent').length
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-lg">Historial de Broadcasts</h2>
                                <p className="text-white/70 text-sm">Mensajes masivos enviados</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-6 py-3 bg-slate-50 border-b grid grid-cols-4 gap-4 shrink-0">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        <p className="text-xs text-slate-500">Total enviados</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-slate-800">{stats.totalRecipients}</p>
                        <p className="text-xs text-slate-500">Destinatarios</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{stats.byType.info}</p>
                        <p className="text-xs text-slate-500">Informativos</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{stats.byType.urgent}</p>
                        <p className="text-xs text-slate-500">Urgentes</p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="px-6 py-3 border-b flex items-center gap-3 shrink-0">
                    {/* Búsqueda */}
                    <div className="relative flex-1">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar mensajes..."
                            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>

                    {/* Filtro de tipo */}
                    <div className="flex items-center gap-1">
                        {(['all', 'info', 'warning', 'urgent'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${typeFilter === t
                                        ? t === 'all'
                                            ? 'bg-slate-800 text-white'
                                            : `${typeConfig[t].bg} ${typeConfig[t].text}`
                                        : 'bg-white border text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                {t === 'all' ? 'Todos' : typeConfig[t].icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de broadcasts */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredBroadcasts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <span className="text-4xl mb-2">📢</span>
                            <p className="text-sm">No hay mensajes que mostrar</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredBroadcasts.map((broadcast) => (
                                <div
                                    key={broadcast.id}
                                    className={`p-4 rounded-xl border-2 ${typeConfig[broadcast.type].bg
                                        } ${typeConfig[broadcast.type].text.replace('text-', 'border-').replace('600', '200')}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">{typeConfig[broadcast.type].icon}</span>
                                                <h3 className={`font-semibold ${typeConfig[broadcast.type].text}`}>
                                                    {broadcast.title}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-slate-700">
                                                {broadcast.body}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span>{audienceLabels[broadcast.targetAudience] || broadcast.targetAudience}</span>
                                                <span>•</span>
                                                <span>👤 {broadcast.recipientCount} destinatarios</span>
                                                <span>•</span>
                                                <span>{formatDate(broadcast.sentAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-slate-50 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
