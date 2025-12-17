const fs = require('fs');

// Datos de IETAC del backup (convertidos al formato nuevo)
const ietacStudents = [
    { first: "IETAC - XIMENA", last: "ARIAS MANCO", email: "sg.estudiante.ximena.arias@gmail.com", id: "1066605786", password: "1066605786", gender: "Mujer", phone: "3213841433", birth: "13 Nov 2009" },
    { first: "IETAC - CAMILO ANDRÉS", last: "ARROYO CASTRO", email: "sg.estudiante.camilo.arroyo@gmail.com", id: "1066605793", password: "1066605793", gender: "Hombre", phone: "3235647879", birth: "05 Abr 2010" },
    { first: "IETAC - MARÍA ESTHER", last: "ACOSTA FERIA", email: "sg.estudiante.maria.acosta@gmail.com", id: "1066605450", password: "1066605450", gender: "Mujer", phone: "3105118499", birth: "24 Oct 2009" },
    { first: "IETAC - JAIRO MANUEL", last: "BALTAZAR VILLERO", email: "sg.estudiante.jairo.baltazar@gmail.com", id: "1063290755", password: "1063290755", gender: "Hombre", phone: "3146676105", birth: "11 Oct 2009" },
    { first: "IETAC - JHOANS SEBASTIÁN", last: "DURANGO ZABALA", email: "sg.estudiante.jhoans.durango@gmail.com", id: "1063789927", password: "1063789927", gender: "Hombre", phone: "3137974214", birth: "20 Oct 2009" },
    { first: "IETAC - ELICEO ELI", last: "FUENTES DÍAZ", email: "sg.estudiante.eliceo.fuentes@gmail.com", id: "1133790795", password: "1133790795", gender: "Hombre", phone: "3217064315", birth: "19 Ago 2009" },
    { first: "IETAC - LIZ VALERIA", last: "GIL HOYOS", email: "sg.estudiante.liz.gil@gmail.com", id: "1063292674", password: "1063292674", gender: "Mujer", phone: "3234030521", birth: "18 Oct 2009" },
    { first: "IETAC - HAROLD IVÁN", last: "HOYOS VERGARA", email: "sg.estudiante.harold.hoyos@gmail.com", id: "1148438187", password: "1148438187", gender: "Hombre", phone: "3122860764", birth: "19 Mar 2008" },
    { first: "IETAC - ISABELLA", last: "MANCHEGO LOZANO", email: "sg.estudiante.isabella.manchego@gmail.com", id: "1063295017", password: "1063295017", gender: "Mujer", phone: "3206191655", birth: "08 May 2010" },
    { first: "IETAC - MARÍA ANGÉLICA", last: "MORELO VILLEROS", email: "sg.estudiante.maria.morelo@gmail.com", id: "1070815365", password: "1070815365", gender: "Mujer", phone: "3234365594", birth: "13 Ago 2007" },
    { first: "IETAC - HERNÁN ANDRÉS", last: "PALMERA PÉREZ", email: "sg.estudiante.hernan.palmera@gmail.com", id: "1101447212", password: "1101447212", gender: "Hombre", phone: "3234839571", birth: "02 Jun 2007" },
    { first: "IETAC - ADRIANA LUCÍA", last: "ROJAS CORDERO", email: "sg.estudiante.adriana.rojas@gmail.com", id: "1038117449", password: "1038117449", gender: "Mujer", phone: "3148090148", birth: "04 Mar 2010" },
    { first: "IETAC - JOHAN ANDRÉS", last: "SALCEDO BEDOYA", email: "sg.estudiante.johan.salcedo@gmail.com", id: "1066606386", password: "1066606386", gender: "Hombre", phone: "3204750293", birth: "10 Oct 2010" },
    { first: "IETAC - ARNEDIS", last: "SIBAJA BEGAMBRE", email: "sg.estudiante.arnedis.sibaja@gmail.com", id: "1063290456", password: "1063290456", gender: "Mujer", phone: "3107241623", birth: "14 Oct 2009" },
    { first: "IETAC - ALEXANDRA", last: "URZOLA MARTÍNEZ", email: "sg.estudiante.alexandra.urzola@gmail.com", id: "1067898547", password: "1067898547", gender: "Mujer", phone: "3235640423", birth: "23 Mar 2009" },
    { first: "IETAC - DANIEL ANDRÉS", last: "ZABALA MONTIEL", email: "sg.estudiante.daniel.zabala@gmail.com", id: "1066605887", password: "1066605887", gender: "Hombre", phone: "3128989638", birth: "04 Mar 2010" },
    { first: "IETAC - LUIS MARIO", last: "ZABALA SÁNCHEZ", email: "sg.estudiante.luis.zabala@gmail.com", id: "1066606169", password: "1066606169", gender: "Hombre", phone: "3114262393", birth: "10 Abr 2010" },
    { first: "IETAC - RONALDO ANDRÉS", last: "ZULETA GUERRA", email: "sg.estudiante.ronaldo.zuleta@gmail.com", id: "1063363727", password: "1063363727", gender: "Hombre", phone: "3127038167", birth: "07 Abr 2010" },
    { first: "IETAC - KAREN SOFÍA", last: "ARRIETA VERGARA", email: "sg.estudiante.karen.arrieta@gmail.com", id: "114869587", password: "114869587", gender: "Mujer", phone: "3104004760", birth: "07 Sep 2010" },
    { first: "IETAC - ANA BELÉN", last: "BARÓN CEBALLOS", email: "sg.estudiante.ana.baron@gmail.com", id: "1033373778", password: "1033373778", gender: "Mujer", phone: "3133984933", birth: "01 Mar 2010" },
    { first: "IETAC - KAREN DAYANA", last: "CASTILLO PÉREZ", email: "sg.estudiante.karen.castillo@gmail.com", id: "1063292595", password: "1063292595", gender: "Mujer", phone: "3148177142", birth: "17 Abr 2010" },
    { first: "IETAC - JUAN DAVID", last: "CORREA HERNÁNDEZ", email: "sg.estudiante.juan.correa@gmail.com", id: "1066572003", password: "1066572003", gender: "Hombre", phone: "3217229477", birth: "30 Sep 2007" },
    { first: "IETAC - LUIS DANIEL", last: "MENDOZA URIBE", email: "sg.estudiante.luis.mendoza@gmail.com", id: "1148695425", password: "1148695425", gender: "Hombre", phone: "3105074210", birth: "11 Feb 2009" },
    { first: "IETAC - ALEXANDRA", last: "JULIO ROMERO", email: "sg.estudiante.alexandra.julio@gmail.com", id: "1148695426", password: "1148695426", gender: "Mujer", phone: "3216335419", birth: "10 Feb 2010" },
    { first: "IETAC - YULISA", last: "RODRÍGUEZ RODRÍGUEZ", email: "sg.estudiante.yulisa.rodriguez@gmail.com", id: "1133790727", password: "1133790727", gender: "Mujer", phone: "3237650952", birth: "10 Sep 2009" },
    { first: "IETAC - VIVIANA MARCELA", last: "ROMERO ZÚÑIGA", email: "sg.estudiante.viviana.romero@gmail.com", id: "1066573694", password: "1066573694", gender: "Mujer", phone: "3108218930", birth: "16 Ene 2010" },
    { first: "IETAC - DAINER ANDRÉS", last: "SÁNCHEZ CASTRO", email: "sg.estudiante.dainer.sanchez@gmail.com", id: "1063295162", password: "1063295162", gender: "Hombre", phone: "3145180611", birth: "19 Jun 2009" },
    { first: "IETAC - MARIANA DE JESÚS", last: "CABADIA PARRA", email: "sg.estudiante.mariana.cabadia@gmail.com", id: "1148438017", password: "1148438017", gender: "Mujer", phone: "3148441560", birth: "06 Feb 2008" },
    { first: "IETAC - JANER", last: "CASTRO MONTALVO", email: "sg.estudiante.janer.castro@gmail.com", id: "1148695511", password: "1148695511", gender: "Hombre", phone: "3105353181", birth: "03 Abr 2009" },
    { first: "IETAC - DAVIER ESTEBAN", last: "OTERO URANGO", email: "sg.estudiante.davier.otero@gmail.com", id: "1067286561", password: "1067286561", gender: "Hombre", phone: "3148945915", birth: "06 Jul 2007" },
    { first: "IETAC - ELIANA MARCELA", last: "VERGARA GANDIA", email: "sg.estudiante.eliana.vergara@gmail.com", id: "1063293969", password: "1063293969", gender: "Mujer", phone: "3025714175", birth: "21 Jun 2008" },
    { first: "IETAC - LUISA FERNANDA", last: "BARÓN LUCAS", email: "sg.estudiante.luisa.baron@gmail.com", id: "1148437906", password: "1148437906", gender: "Mujer", phone: "3114062955", birth: "15 Dic 2008" },
    { first: "IETAC - JORGE ANDRÉS", last: "PÉREZ MESTRA", email: "sg.estudiante.jorge.perez@gmail.com", id: "1148695420", password: "1148695420", gender: "Hombre", phone: "3146640429", birth: "14 Mar 2010" },
    { first: "IETAC - YULEIMIS", last: "MURILLO GÓMEZ", email: "sg.estudiante.yuleimis.murillo@gmail.com", id: "1133790340", password: "1133790340", gender: "Mujer", phone: "3218863178", birth: "12 Oct 2004" },
    { first: "IETAC - NICOL TATIANA", last: "CERPA PEINADO", email: "sg.estudiante.nicol.cerpa@gmail.com", id: "1148438554", password: "1148438554", gender: "Mujer", phone: "3012478928", birth: "17 Dic 2008" },
    { first: "IETAC - DAYANA MICHEL", last: "PEÑA TORDECILLA", email: "sg.estudiante.dayana.pena@gmail.com", id: "1148695628", password: "1148695628", gender: "Mujer", phone: "3218976781", birth: "06 May 2010" }
];

// Leer datos actuales de SG
const currentData = fs.readFileSync('src/lib/data.ts', 'utf8');
const sgMatch = currentData.match(/export const studentData: Student\[\] = (\[[\s\S]*?\]);/);

let sgStudents = [];
if (sgMatch) {
    try {
        sgStudents = eval(sgMatch[1]);
    } catch (e) {
        console.error('Error parsing SG students:', e);
    }
}

console.log(`IETAC students: ${ietacStudents.length}`);
console.log(`SG students: ${sgStudents.length}`);

// Fusionar: IETAC primero, luego SG
const allStudents = [...ietacStudents, ...sgStudents];

// Eliminar duplicados por ID
const uniqueMap = new Map();
allStudents.forEach(s => uniqueMap.set(s.id, s));
const uniqueStudents = Array.from(uniqueMap.values());

console.log(`Total unique students: ${uniqueStudents.length}`);

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

export const studentData: Student[] = ${JSON.stringify(uniqueStudents, null, 4)};
`;

fs.writeFileSync('src/lib/data.ts', output);
console.log('Successfully merged IETAC + SG data into src/lib/data.ts');
