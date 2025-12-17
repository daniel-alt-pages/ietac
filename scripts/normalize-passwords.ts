import * as fs from 'fs';
import * as path from 'path';

// Función para normalizar nombres (remover acentos)
function normalizePassword(password: string): string {
    return password
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/gi, 'n')
        .replace(/[^a-zA-Z0-9.]/g, '');
}

const dataPath = path.join(__dirname, '..', 'src', 'lib', 'data.ts');
let content = fs.readFileSync(dataPath, 'utf-8');

// Regex para encontrar passwords con posibles acentos
const passwordRegex = /password: "([^"]+)"/g;

content = content.replace(passwordRegex, (match, password) => {
    const normalized = normalizePassword(password);
    return `password: "${normalized}"`;
});

fs.writeFileSync(dataPath, content);
console.log('✅ Contraseñas normalizadas (sin acentos) en data.ts');
