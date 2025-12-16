"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

type Toast = {
    id: number;
    message: string;
};

type ToastContextType = {
    showToast: (message: string) => void;
};

// Create the context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Provider Component
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2500);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] border border-slate-700 pointer-events-auto"
                        >
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <div>
                                <p className="text-sm font-semibold">Copiado al portapapeles</p>
                                <p className="text-xs text-slate-400 truncate max-w-[200px]">{toast.message}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

// Custom Hook
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within a ToastProvider");
    return context;
};
