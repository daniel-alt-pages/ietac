const fs = require('fs');

// Nombres correctos de IETAC proporcionados por el usuario
const ietacNames = [
    "IETAC | XIMENA ARIAS MANCO",
    "IETAC | CAMILO ANDRÉS ARROYO CASTRO",
    "IETAC | MARÍA ESTHER ACOSTA FERIA",
    "IETAC | JAIRO MANUEL BALTAZAR VILLERO",
    "IETAC | JHOANS SEBASTIÁN DURANGO ZABALA",
    "IETAC | ELICEO ELI FUENTES DÍAZ",
    "IETAC | LIZ VALERIA GIL HOYOS",
    "IETAC | HAROLD IVÁN HOYOS VERGARA",
    "IETAC | ISABELLA MANCHEGO LOZANO",
    "IETAC | MARÍA ANGÉLICA MORELO VILLEROS",
    "IETAC | HERNÁN ANDRÉS PALMERA PÉREZ",
    "IETAC | ADRIANA LUCÍA ROJAS CORDERO",
    "IETAC | JOHAN ANDRÉS SALCEDO BEDOYA",
    "IETAC | ARNEDIS SIBAJA BEGAMBRE",
    "IETAC | ALEXANDRA URZOLA MARTÍNEZ",
    "IETAC | DANIEL ANDRÉS ZABALA MONTIEL",
    "IETAC | LUIS MARIO ZABALA SÁNCHEZ",
    "IETAC | RONALDO ANDRÉS ZULETA GUERRA",
    "IETAC | KAREN SOFÍA ARRIETA VERGARA",
    "IETAC | ANA BELÉN BARÓN CEBALLOS",
    "IETAC | KAREN DAYANA CASTILLO PÉREZ",
    "IETAC | JUAN DAVID CORREA HERNÁNDEZ",
    "IETAC | LUIS DANIEL MENDOZA URIBE",
    "IETAC | ALEXANDRA JULIO ROMERO",
    "IETAC | YULISA RODRÍGUEZ RODRÍGUEZ",
    "IETAC | VIVIANA MARCELA ROMERO ZÚÑIGA",
    "IETAC | DAINER ANDRÉS SÁNCHEZ CASTRO",
    "IETAC | MARIANA DE JESÚS CABADIA PARRA",
    "IETAC | JANER CASTRO MONTALVO",
    "IETAC | DAVIER ESTEBAN OTERO URANGO",
    "IETAC | ELIANA MARCELA VERGARA GANDIA",
    "IETAC | LUISA FERNANDA BARÓN LUCAS",
    "IETAC | JORGE ANDRÉS PÉREZ MESTRA",
    "IETAC | YULEIMIS MURILLO GÓMEZ",
    "IETAC | NICOL TATIANA CERPA PEINADO",
    "IETAC | DAYANA MICHEL PEÑA TORDECILLA"
];

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

// Separar SG y IETAC
const sgStudents = students.filter(s => s.first.startsWith('SG'));
const ietacStudents = students.filter(s => s.first.startsWith('IETAC'));

console.log(`SG students: ${sgStudents.length}`);
console.log(`IETAC students (current): ${ietacStudents.length}`);
console.log(`IETAC names provided: ${ietacNames.length}`);

// Actualizar nombres de IETAC
// Intentar hacer match por apellido o ID
const updatedIetac = ietacStudents.map((student, index) => {
    if (index < ietacNames.length) {
        const newName = ietacNames[index];
        // Separar nombre y apellido del nuevo formato
        const cleanName = newName.replace('IETAC | ', '');
        const parts = cleanName.split(/\s+/);

        let firstName, lastName;
        if (parts.length >= 4) {
            firstName = parts.slice(0, 2).join(' ');
            lastName = parts.slice(2).join(' ');
        } else if (parts.length === 3) {
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        } else if (parts.length === 2) {
            firstName = parts[0];
            lastName = parts[1];
        } else {
            firstName = cleanName;
            lastName = '';
        }

        return {
            ...student,
            first: `IETAC - ${firstName}`,
            last: lastName
        };
    }
    return student;
});

console.log('\nEjemplos IETAC actualizados:');
updatedIetac.slice(0, 5).forEach(s => {
    console.log(`  ${s.first} | ${s.last}`);
});

// Combinar todos
const allStudents = [...updatedIetac, ...sgStudents];

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

export const studentData: Student[] = ${JSON.stringify(allStudents, null, 4)};
`;

fs.writeFileSync('src/lib/data.ts', output);
console.log(`\nTotal: ${allStudents.length} students`);
console.log('Successfully updated src/lib/data.ts');
