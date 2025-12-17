import * as XLSX from 'xlsx';
import { Student } from './data';

export function exportToExcel(students: Student[]) {
    // Separar por institución
    const ietacStudents = students.filter(s => s.institution === 'IETAC');
    const sgStudents = students.filter(s => s.institution === 'SG');

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Función para convertir estudiantes a datos de hoja
    const toSheetData = (data: Student[]) => data.map((s, i) => ({
        '#': i + 1,
        'Nombre': s.first.replace(/^(IETAC|SG) - /, ''),
        'Apellidos': s.last,
        'Usuario Email': s.email,
        'Contraseña': s.password,
        'ID/Documento': s.id,
        'Teléfono': s.phone,
        'Fecha Nacimiento': s.birth,
        'Género': s.gender
    }));

    // Crear hoja IETAC
    if (ietacStudents.length > 0) {
        const wsIETAC = XLSX.utils.json_to_sheet(toSheetData(ietacStudents));
        // Ajustar anchos de columna
        wsIETAC['!cols'] = [
            { wch: 4 },   // #
            { wch: 25 },  // Nombre
            { wch: 20 },  // Apellidos
            { wch: 35 },  // Usuario Email
            { wch: 15 },  // Contraseña
            { wch: 12 },  // ID
            { wch: 12 },  // Teléfono
            { wch: 14 },  // Fecha
            { wch: 10 }   // Género
        ];
        XLSX.utils.book_append_sheet(wb, wsIETAC, 'IETAC');
    }

    // Crear hoja SG
    if (sgStudents.length > 0) {
        const wsSG = XLSX.utils.json_to_sheet(toSheetData(sgStudents));
        wsSG['!cols'] = [
            { wch: 4 },
            { wch: 25 },
            { wch: 20 },
            { wch: 35 },
            { wch: 15 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, wsSG, 'SG');
    }

    // Crear hoja con TODOS
    const wsAll = XLSX.utils.json_to_sheet(toSheetData(students));
    wsAll['!cols'] = [
        { wch: 4 },
        { wch: 25 },
        { wch: 20 },
        { wch: 35 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAll, 'Todos');

    // Generar y descargar
    const fileName = `Estudiantes_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
