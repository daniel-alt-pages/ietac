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

// Función para generar contraseña con el patrón correcto: NombreInicial.últimos4dígitos
function generatePassword(firstName, id) {
    // Limpiar nombre (quitar prefijo SG/IETAC)
    const cleanName = firstName.replace(/^(SG|IETAC) - /, '').trim();
    const nameParts = cleanName.split(/\s+/);

    // Primer nombre capitalizado
    const firstNamePart = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();

    // Inicial del segundo nombre (si existe)
    let initial = '';
    if (nameParts.length > 1 && nameParts[1]) {
        initial = nameParts[1].charAt(0).toUpperCase();
    }

    // Últimos 4 dígitos del ID
    const cleanId = id.replace(/\./g, '');
    const last4 = cleanId.slice(-4);

    return `${firstNamePart}${initial}.${last4}`;
}

// Función para generar email institucional
function generateEmail(firstName, lastName) {
    const cleanFirst = firstName
        .replace(/^(SG|IETAC) - /, '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .slice(0, 2) // Solo primeros 2 nombres
        .join('.');

    const cleanLast = lastName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)[0]; // Solo primer apellido

    return `sg.estudiante.${cleanFirst}.${cleanLast}`;
}

// Determinar institución desde el nombre
function getInstitution(firstName) {
    if (firstName.startsWith('IETAC')) return 'IETAC';
    if (firstName.startsWith('SG')) return 'SG';
    return 'SG';
}

// Actualizar todos los estudiantes
const updatedStudents = students.map(student => {
    const institution = getInstitution(student.first);
    const password = generatePassword(student.first, student.id);
    const email = generateEmail(student.first, student.last);

    return {
        ...student,
        email: email,
        password: password,
        institution: institution
    };
});

console.log('Ejemplos de contraseñas generadas:');
updatedStudents.slice(0, 5).forEach(s => {
    console.log(`  ${s.first} (ID: ${s.id}) -> ${s.password}`);
});

console.log('\nEjemplos de emails:');
updatedStudents.slice(0, 5).forEach(s => {
    console.log(`  ${s.first} -> ${s.email}`);
});

// Generar el archivo con el campo institution
const output = `export interface Student {
    first: string;
    last: string;
    email: string;
    id: string;
    password: string;
    gender: string;
    phone: string;
    birth: string;
    institution: string;
}

export const studentData: Student[] = ${JSON.stringify(updatedStudents, null, 4)};
`;

fs.writeFileSync('src/lib/data.ts', output);
console.log(`\nTotal: ${updatedStudents.length} students`);
console.log('Successfully updated src/lib/data.ts with correct passwords and institution field');
