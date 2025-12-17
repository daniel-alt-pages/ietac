import * as fs from 'fs';
import * as path from 'path';

interface Student {
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

// Función para normalizar nombres (remover acentos y convertir a minúsculas)
function normalizeForEmail(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/g, 'n')
        .trim();
}

// Función para extraer primer nombre y primer apellido
function extractFirstNameAndLastName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts[1] || '';
    return { firstName, lastName };
}

// Función para generar email basado en el correo original del usuario
function generateEmailFromOriginal(originalEmail: string, fullName: string): string {
    // Extraer el dominio del correo original
    const domain = originalEmail.split('@')[1] || 'gmail.com';

    // Extraer primer nombre y primer apellido
    const { firstName, lastName } = extractFirstNameAndLastName(fullName);

    // Normalizar para el email
    const normalizedFirst = normalizeForEmail(firstName);
    const normalizedLast = normalizeForEmail(lastName);

    // Crear email con el formato: sg.estudiante.[nombre].[apellido]@[dominio-original]
    return `sg.estudiante.${normalizedFirst}.${normalizedLast}@${domain}`;
}

// Función para generar contraseña
function generatePassword(fullName: string, id: string): string {
    const { firstName, lastName } = extractFirstNameAndLastName(fullName);
    const lastFourDigits = id.slice(-4);

    // Normalizar nombres para remover acentos y caracteres especiales
    const normalizedFirstName = firstName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/gi, 'n')
        .replace(/[^a-zA-Z]/g, '');

    const normalizedLastName = lastName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/gi, 'n')
        .replace(/[^a-zA-Z]/g, '');

    // Formato: PrimerNombrePrimeraLetraApellido.UltimosCuatroDigitos
    const firstNameCapitalized = normalizedFirstName.charAt(0).toUpperCase() + normalizedFirstName.slice(1).toLowerCase();
    const lastNameInitial = normalizedLastName.charAt(0).toUpperCase();

    return `${firstNameCapitalized}${lastNameInitial}.${lastFourDigits}`;
}

// Función para determinar género basado en el nombre
function inferGender(fullName: string): string {
    const maleEndings = ['o', 'el', 'an', 'on', 'es', 'os'];
    const femaleEndings = ['a', 'ia', 'na', 'la', 'sa'];

    const firstName = fullName.trim().split(/\s+/)[0].toLowerCase();

    // Nombres específicos
    const maleNames = ['juan', 'jose', 'luis', 'carlos', 'miguel', 'daniel', 'santiago', 'andres', 'david', 'gabriel', 'cristian', 'jaider', 'josias', 'mathias', 'johan', 'ronaldo', 'marlong'];
    const femaleNames = ['maria', 'ana', 'sofia', 'valentina', 'camila', 'laura', 'paula', 'isabella', 'valeria', 'karen', 'natalia', 'sara', 'daniela', 'angie', 'karol', 'emma', 'salome', 'kiara', 'dulce', 'hanna', 'gabriela'];

    if (maleNames.some(name => firstName.includes(name))) return 'Hombre';
    if (femaleNames.some(name => firstName.includes(name))) return 'Mujer';

    // Inferir por terminación
    for (const ending of femaleEndings) {
        if (firstName.endsWith(ending)) return 'Mujer';
    }

    for (const ending of maleEndings) {
        if (firstName.endsWith(ending)) return 'Hombre';
    }

    return 'No especificado';
}

// Función para formatear fecha de nacimiento
function formatBirthDate(dateString: string): string {
    if (!dateString || dateString.trim() === '') return 'No especificada';

    try {
        const parts = dateString.split('/');
        if (parts.length !== 3) return dateString;

        const day = parts[0].padStart(2, '0');
        const monthNumber = parseInt(parts[1]);
        const year = parts[2];

        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = months[monthNumber - 1] || '';

        return `${day} ${monthName} ${year}`;
    } catch (error) {
        return dateString;
    }
}

// Función para limpiar número de teléfono
function cleanPhone(phone: string): string {
    return phone.replace(/\s+/g, '').replace(/-/g, '');
}

// Función para limpiar número de documento
function cleanDocumentNumber(docNumber: string): string {
    return docNumber.replace(/\./g, '').replace(/,/g, '').trim();
}

// Procesar CSV
function processCSV(csvPath: string): Student[] {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Saltar las primeras 4 líneas (encabezados)
    const dataLines = lines.slice(4);

    const students: Student[] = [];

    for (const line of dataLines) {
        if (!line.trim()) continue;

        // Parsear CSV manualmente (considerando comillas)
        const fields: string[] = [];
        let currentField = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                fields.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField); // Agregar el último campo

        if (fields.length < 8) continue;

        const originalEmail = fields[1]?.trim() || '';
        const fullName = fields[3]?.trim() || '';
        const phone = cleanPhone(fields[4]?.trim() || '');
        const documentNumber = cleanDocumentNumber(fields[6]?.trim() || '');
        const birthDate = fields[7]?.trim() || '';

        if (!fullName || !documentNumber) continue;

        // Split name into parts to extract last names
        const nameParts = fullName.trim().split(/\s+/);
        let lastName = '';

        if (nameParts.length >= 3) {
            lastName = nameParts.slice(-2).join(' ');
        } else if (nameParts.length === 2) {
            lastName = nameParts[1];
        }

        const student: Student = {
            first: `SG - ${fullName}`,
            last: lastName,
            email: generateEmailFromOriginal(originalEmail, fullName),
            id: documentNumber,
            password: generatePassword(fullName, documentNumber),
            gender: inferGender(fullName),
            phone: phone,
            birth: formatBirthDate(birthDate),
            institution: 'SG'
        };

        students.push(student);
    }

    return students;
}

// Generar archivo TypeScript
function generateTypeScriptFile(students: Student[], outputPath: string): void {
    let content = `export interface Student {\n`;
    content += `    first: string;\n`;
    content += `    last: string;\n`;
    content += `    email: string;\n`;
    content += `    id: string;\n`;
    content += `    password: string;\n`;
    content += `    gender: string;\n`;
    content += `    phone: string;\n`;
    content += `    birth: string;\n`;
    content += `    institution: string;\n`;
    content += `}\n\n`;
    content += `export const studentDataSG: Student[] = [\n`;

    students.forEach((student, index) => {
        const isLast = index === students.length - 1;
        content += `    { `;
        content += `first: "${student.first}", `;
        content += `last: "${student.last}", `;
        content += `email: "${student.email}", `;
        content += `id: "${student.id}", `;
        content += `password: "${student.password}", `;
        content += `gender: "${student.gender}", `;
        content += `phone: "${student.phone}", `;
        content += `birth: "${student.birth}", `;
        content += `institution: "${student.institution}" `;
        content += `}${isLast ? '' : ','}\n`;
    });

    content += `];\n`;

    fs.writeFileSync(outputPath, content, 'utf-8');
}

// Main
const csvPath = path.join(__dirname, '..', 'Base de datos SG FILTRADA.csv');
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'data-sg.ts');

console.log('Procesando CSV de SG...');
const students = processCSV(csvPath);
console.log(`Total de estudiantes procesados: ${students.length}`);

console.log('Generando archivo TypeScript...');
generateTypeScriptFile(students, outputPath);
console.log(`Archivo generado: ${outputPath}`);

console.log('\n✅ Proceso completado exitosamente!');
console.log('\nPrimeros 3 estudiantes:');
students.slice(0, 3).forEach((student, index) => {
    console.log(`\n${index + 1}. ${student.first} ${student.last}`);
    console.log(`   Email: ${student.email}`);
    console.log(`   ID: ${student.id}`);
    console.log(`   Password: ${student.password}`);
});
