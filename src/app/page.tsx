"use client";

import { useState, useMemo } from 'react';
import Sidebar from '@/components/Dashboard/Sidebar';
import Header from '@/components/Dashboard/Header';
import StudentTable from '@/components/Dashboard/StudentTable';
import { studentData } from '@/lib/data';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return studentData;
    return studentData.filter(student =>
      student.first.toLowerCase().includes(term) ||
      student.last.toLowerCase().includes(term) ||
      student.pass.includes(term) ||
      student.email.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        <div className="flex-1 overflow-auto p-6 scroll-smooth">
          <StudentTable data={filteredData} />

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">EduManager Pro v1.0 • Next.js Edition</p>
          </div>
        </div>
      </main>
    </div>
  );
}
