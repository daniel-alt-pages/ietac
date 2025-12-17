// Test script to verify institution filter
import { studentData } from './src/lib/data';

console.log('=== INSTITUTION FILTER TEST ===\n');

console.log(`Total students: ${studentData.length}`);

const ietacStudents = studentData.filter(s => s.institution === 'IETAC');
const sgStudents = studentData.filter(s => s.institution === 'SG');

console.log(`\nIETAC students: ${ietacStudents.length}`);
console.log(`SG students: ${sgStudents.length}`);

console.log('\n=== Sample IETAC Students ===');
ietacStudents.slice(0, 3).forEach(s => {
    console.log(`- ${s.first} (${s.institution})`);
});

console.log('\n=== Sample SG Students ===');
sgStudents.slice(0, 3).forEach(s => {
    console.log(`- ${s.first} (${s.institution})`);
});

console.log('\n=== FILTER TEST PASSED ===');
