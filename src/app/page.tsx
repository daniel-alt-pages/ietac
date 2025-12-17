"use client";

import { useState, useMemo, useEffect } from 'react';
import Sidebar from '@/components/Dashboard/Sidebar';
import Header from '@/components/Dashboard/Header';
import StudentTable from '@/components/Dashboard/StudentTable';
import { studentData } from '@/lib/data';
import { subscribeToConfirmations, updateConfirmation } from '@/lib/firebase';

export default function Home() {
  // Load filters from localStorage or use defaults
  const [searchTerm, setSearchTerm] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('institutionFilter') || 'ALL';
    }
    return 'ALL';
  });
  const [nameFilter, setNameFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nameFilter') || 'ALL';
    }
    return 'ALL';
  });
  const [lastnameFilter, setLastnameFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastnameFilter') || 'ALL';
    }
    return 'ALL';
  });
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('institutionFilter', institutionFilter);
      localStorage.setItem('nameFilter', nameFilter);
      localStorage.setItem('lastnameFilter', lastnameFilter);
    }
  }, [institutionFilter, nameFilter, lastnameFilter]);

  // Subscribe to Firebase real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToConfirmations((newConfirmations) => {
      setConfirmations(newConfirmations);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    let data = studentData;

    // Filter by institution
    if (institutionFilter !== 'ALL') {
      data = data.filter(student => student.institution === institutionFilter);
    }

    // Filter by name (alphabetical)
    if (nameFilter !== 'ALL') {
      data = data.filter(student => {
        const firstName = student.first.replace(/^(IETAC|SG) - /, '');
        return firstName.toUpperCase().startsWith(nameFilter);
      });
    }

    // Filter by lastname (alphabetical)
    if (lastnameFilter !== 'ALL') {
      data = data.filter(student => {
        return student.last.toUpperCase().startsWith(lastnameFilter);
      });
    }

    // Filter by search term
    if (!searchTerm) return data;

    // Split search term into words and remove empty strings
    const searchPartials = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

    return data.filter(student => {
      // Create a single searchable string for the student
      const fullSearchableText = `
        ${student.first} 
        ${student.last} 
        ${student.id} 
        ${student.email}
      `.toLowerCase();

      // Check if EVERY partial word exists in the student's data
      return searchPartials.every(part => fullSearchableText.includes(part));
    });
  }, [searchTerm, institutionFilter, nameFilter, lastnameFilter]);

  const handleToggleConfirm = async (studentId: string) => {
    const currentStatus = confirmations[studentId] || false;
    // Optimistically update local state
    setConfirmations(prev => ({ ...prev, [studentId]: !currentStatus }));
    // Update Firebase (fire and forget for UI responsiveness, logic handles error logging)
    await updateConfirmation(studentId, !currentStatus);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          institutionFilter={institutionFilter}
          onInstitutionChange={setInstitutionFilter}
          nameFilter={nameFilter}
          onNameFilterChange={setNameFilter}
          lastnameFilter={lastnameFilter}
          onLastnameFilterChange={setLastnameFilter}
        />

        <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-pulse">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <p>Sincronizando base de datos...</p>
            </div>
          ) : (
            <StudentTable
              data={filteredData}
              confirmations={confirmations}
              onToggleConfirm={handleToggleConfirm}
            />
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">EduManager Pro v2.1 • Sincronizado en tiempo real</p>
          </div>
        </div>
      </main>
    </div>
  );
}
