"use client";

import { useState, useMemo, useEffect } from 'react';
import Sidebar from '@/components/Dashboard/Sidebar';
import Header from '@/components/Dashboard/Header';
import StudentTable from '@/components/Dashboard/StudentTable';
import { studentData } from '@/lib/data';
import { subscribeToConfirmations, updateConfirmation } from '@/lib/firebase';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});

  // Subscribe to Firebase real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToConfirmations((newConfirmations) => {
      setConfirmations(newConfirmations);
    });
    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return studentData;
    return studentData.filter(student =>
      student.first.toLowerCase().includes(term) ||
      student.last.toLowerCase().includes(term) ||
      student.id.includes(term) ||
      student.email.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleToggleConfirm = async (studentId: string) => {
    const currentStatus = confirmations[studentId] || false;
    // Optimistically update local state
    setConfirmations(prev => ({ ...prev, [studentId]: !currentStatus }));
    // Update Firebase
    await updateConfirmation(studentId, !currentStatus);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
          <StudentTable
            data={filteredData}
            confirmations={confirmations}
            onToggleConfirm={handleToggleConfirm}
          />

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">EduManager Pro v2.0 • Sincronizado en tiempo real</p>
          </div>
        </div>
      </main>
    </div>
  );
}
