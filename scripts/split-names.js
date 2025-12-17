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

console.log(`Processing ${students.length} students...`);

// Función para separar nombre y apellido en estudiantes SG
function splitName(fullName) {
    // Remover prefijo "SG - "
    const cleanName = fullName.replace(/^SG - /, '').trim();
    const parts = cleanName.split(/\s+/);

    if (parts.length >= 4) {
        // 2 nombres + 2 apellidos (o más apellidos)
        const firstName = parts.slice(0, 2).join(' ');
        const lastName = parts.slice(2).join(' ');
        return { first: `SG - ${firstName}`, last: lastName };
    } else if (parts.length === 3) {
        // 1 nombre + 2 apellidos
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
        return { first: `SG - ${firstName}`, last: lastName };
    } else if (parts.length === 2) {
        // 1 nombre + 1 apellido
        return { first: `SG - ${parts[0]}`, last: parts[1] };
    } else {
        // Solo 1 palabra, dejarlo como está
        return { first: fullName, last: '' };
    }
}

// Procesar cada estudiante
const processedStudents = students.map(student => {
    if (student.first.startsWith('SG') && student.last === '') {
        const { first, last } = splitName(student.first);
        return { ...student, first, last };
    }
    return student;
});

// Verificar algunos ejemplos
console.log('\nEjemplos procesados:');
processedStudents.filter(s => s.first.startsWith('SG')).slice(0, 5).forEach(s => {
    console.log(`  ${s.first} | ${s.last}`);
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

export const studentData: Student[] = ${JSON.stringify(processedStudents, null, 4)};
`;

fs.writeFileSync('src/lib/data.ts', output);
console.log('\nSuccessfully updated src/lib/data.ts with separated names');
