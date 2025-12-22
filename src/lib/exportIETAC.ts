import { Student } from './data';
import * as XLSX from 'xlsx';

export function exportIETACToExcel(
    students: Student[],
    confirmations: Record<string, boolean>
): void {
    // Filtrar solo estudiantes IETAC
    const ietacStudents = students.filter(s =>
        s.first.toUpperCase().startsWith('IETAC')
    );

    // Preparar datos para Excel
    const excelData = ietacStudents.map(student => ({
        'ID': student.id,
        'Nombre': student.first.replace(/^IETAC\s*-\s*/i, ''),
        'Apellido': student.last,
        'Email': `${student.email}@gmail.com`,
        'Contraseña': student.password,
        'Teléfono': student.phone,
        'Género': student.gender,
        'Fecha Nacimiento': student.birth,
        'Estado': confirmations[student.id] ? 'CONFIRMADO' : 'PENDIENTE'
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajustar ancho de columnas
    const colWidths = [
        { wch: 12 }, // ID
        { wch: 20 }, // Nombre
        { wch: 20 }, // Apellido
        { wch: 35 }, // Email
        { wch: 15 }, // Contraseña
        { wch: 15 }, // Teléfono
        { wch: 10 }, // Género
        { wch: 15 }, // Fecha
        { wch: 12 }  // Estado
    ];
    ws['!cols'] = colWidths;

    // Añadir hoja al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes IETAC');

    // Generar nombre de archivo con fecha
    const fecha = new Date().toISOString().split('T')[0];
    const fileName = `IETAC_Estudiantes_${fecha}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, fileName);
}
