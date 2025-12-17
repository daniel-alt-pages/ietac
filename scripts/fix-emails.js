const fs = require('fs');

// Leer datos actuales
const currentData = fs.readFileSync('src/lib/data.ts', 'utf8');
const match = currentData.match(/export const studentData: Student\[\] = (\[[\s\S]*?\]);/);

let students = [];
if (match) {
    try {
        students = eval(match[1]);
    } catch (e) {
        console.error('Error parsing students:', e);
        process.exit(1);
    }
}

// Función para generar email institucional
function generateEmail(firstName, lastName) {
    // Limpiar y normalizar
    const cleanFirst = firstName
        .replace(/^(SG|IETAC) - /, '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/\s+/g, '.')
        .replace(/[^a-z.]/g, '');

    const cleanLast = lastName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/\s+/g, '.')
        .replace(/[^a-z.]/g, '');

    return `sg.estudiante.${cleanFirst}.${cleanLast}`;
}

// Actualizar emails de estudiantes SG
const updatedStudents = students.map(student => {
    if (student.first.startsWith('SG')) {
        const newEmail = generateEmail(student.first, student.last);
        return { ...student, email: newEmail };
    }
    return student;
});

console.log('Ejemplos de emails generados (SG):');
updatedStudents.filter(s => s.first.startsWith('SG')).slice(0, 5).forEach(s => {
    console.log(`  ${s.first} ${s.last} -> ${s.email}`);
});

console.log('\nEjemplos de emails IETAC (sin cambiar):');
updatedStudents.filter(s => s.first.startsWith('IETAC')).slice(0, 3).forEach(s => {
    console.log(`  ${s.first} ${s.last} -> ${s.email}`);
});

// Generar el archivo
const output = `export interface Student {
    first: string;
    last: string;
    email: string;
    id: string;
    password: string;
    gender: string;
    phone: string;
    birth: string;
}

export const studentData: Student[] = ${JSON.stringify(updatedStudents, null, 4)};
`;

fs.writeFileSync('src/lib/data.ts', output);
console.log(`\nTotal: ${updatedStudents.length} students`);
console.log('Successfully updated emails in src/lib/data.ts');
