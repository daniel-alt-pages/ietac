# 📚 DOCUMENTACIÓN COMPLETA DEL PROYECTO
## Portal de Gestión SeamosGenios - PreICFES Intensivo

---

# 🎯 ¿QUÉ ES ESTE PROYECTO?

Imagina que tienes una **caja de herramientas mágica** para organizar a muchos estudiantes. Este proyecto es exactamente eso: una aplicación web (como una página de internet especial) que ayuda a:

1. 📋 **Guardar información** de todos los estudiantes (nombre, correo, contraseña, etc.)
2. ✅ **Crear cuentas de Gmail** para los estudiantes paso a paso
3. 👀 **Ver quién ya creó su cuenta** y quién falta
4. 📊 **Ver estadísticas** de cuántos estudiantes han terminado

Es como tener un **libro mágico** que sabe todo sobre los estudiantes y les ayuda a crear su cuenta de correo electrónico.

---

# 📁 ESTRUCTURA DEL PROYECTO

```
web5/
├── 📁 src/                    ← Aquí vive todo el código importante
│   ├── 📁 app/                ← Las páginas de la aplicación
│   │   ├── 📄 page.tsx        ← La página principal (el corazón)
│   │   ├── 📄 layout.tsx      ← El "marco" de la página
│   │   └── 📄 globals.css     ← Los estilos bonitos
│   ├── 📁 components/         ← Piezas reutilizables (como LEGO)
│   │   └── 📁 Dashboard/      ← Componentes del panel de control
│   │       ├── 📄 Header.tsx      ← La barra de arriba
│   │       ├── 📄 Sidebar.tsx     ← El menú lateral
│   │       ├── 📄 MobileNav.tsx   ← Menú para celulares
│   │       └── 📄 StudentTable.tsx ← La tabla de estudiantes
│   └── 📁 lib/                ← Herramientas y datos
│       ├── 📄 data.ts         ← Lista de estudiantes
│       ├── 📄 firebase.ts     ← Conexión a la base de datos
│       ├── 📄 exportExcel.ts  ← Exportar a Excel
│       └── 📄 exportIETAC.ts  ← Exportar solo IETAC
├── 📄 package.json            ← Lista de "ingredientes" del proyecto
└── 📄 README.md               ← Instrucciones básicas
```

---

# 🧩 EXPLICACIÓN DE CADA ARCHIVO

---

## 📄 1. `src/lib/data.ts` - LA LISTA DE ESTUDIANTES

### ¿Qué es?
Es como una **libreta de contactos gigante** donde guardamos TODA la información de cada estudiante.

### ¿Cómo funciona?

```typescript
// Primero, definimos QUÉ información queremos guardar de cada estudiante
// Es como hacer una ficha: "Cada estudiante tiene que tener estos datos"

export interface Student {
    first: string;       // 👤 Nombre (ejemplo: "IETAC - MARÍA")
    last: string;        // 👤 Apellidos (ejemplo: "PÉREZ GARCÍA")
    email: string;       // 📧 Usuario de email (ejemplo: "perezgarcia.sg.est")
    id: string;         // 🆔 Número de documento (ejemplo: "1066605786")
    password: string;    // 🔑 Contraseña (ejemplo: "MariaP.5786")
    gender: string;      // ⚧ Género ("Mujer" o "Hombre")
    phone: string;       // 📱 Teléfono (ejemplo: "3213841433")
    birth: string;       // 🎂 Fecha de nacimiento (ejemplo: "13 Nov 2009")
    institution: string; // 🏫 Institución ("IETAC" o "SG")
}
```

### Analogía para un niño:
Imagina que tienes muchas **tarjetas de colección** de Pokémon. Cada tarjeta tiene:
- El nombre del Pokémon → Aquí es el nombre del estudiante
- Su tipo → Aquí es la institución
- Su poder → Aquí es la contraseña
- Su número → Aquí es el ID

### Los estudiantes están organizados en dos grupos:

```typescript
// Grupo 1: Estudiantes de IETAC (una escuela)
const studentDataIETAC: Student[] = [
    { first: "IETAC - XIMENA", last: "ARIAS MANCO", ... }
];

// Grupo 2: Estudiantes de SG (otra escuela)
const studentDataSG: Student[] = [
    { first: "SG - ANGIE SOFIA", last: "ALDANA ARIAS", ... }
];

// Al final, juntamos todos en una sola lista
export const studentData: Student[] = [...studentDataIETAC, ...studentDataSG];
```

### ¿Para qué sirve?
- 🔍 Buscar estudiantes por nombre o ID
- 📧 Saber qué correo y contraseña tiene cada uno
- 📞 Contactar a los estudiantes por teléfono

---

## 📄 2. `src/lib/firebase.ts` - LA NUBE MÁGICA

### ¿Qué es?
Es como tener una **caja fuerte en las nubes** (internet) donde guardamos información que puede verse desde cualquier computadora.

### Partes principales:

#### A) Configuración inicial
```typescript
// Estas son las "llaves" para abrir nuestra caja fuerte en la nube
const firebaseConfig = {
    apiKey: "...",           // La llave secreta
    projectId: "seamosgenios-portal",  // El nombre de nuestra caja
    // ... más configuración
};

// Abrimos la conexión con Firebase (la nube)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
```

#### B) Guardar confirmaciones
```typescript
// Cuando un estudiante dice "¡Ya creé mi cuenta!", guardamos eso
export async function saveConfirmation(data) {
    // Es como poner una etiqueta verde ✅ en su tarjeta
    await setDoc(doc(confirmationsCollection, data.studentId), {
        ...data,
        confirmed: true,        // "Sí, ya terminó"
        confirmedAt: new Date() // "Lo hizo a esta hora"
    });
}
```

### Analogía para un niño:
Imagina que tienes un **tablero de tareas** en la nube:
- Cuando haces tu tarea, pones una estrellita ⭐
- Todos pueden ver el tablero desde cualquier lugar
- Así los profes saben quién ya terminó

### Funciones especiales:

#### 🔐 Sistema de Seguridad
```typescript
// Si un estudiante hace cosas raras (avanza muy rápido), lo bloqueamos
export async function disableStudent(studentId, reason) {
    // Es como poner un candado 🔒 en su cuenta
}

// Si el admin quiere desbloquearlo
export async function enableStudent(studentId) {
    // Es como quitar el candado 🔓
}
```

#### 📊 Sistema de Actividad
```typescript
// Guardamos TODO lo que hacen los estudiantes
export async function saveActivityEvent(event) {
    // "María inició sesión a las 3pm"
    // "Pedro copió su contraseña"
    // "Ana confirmó su cuenta"
}
```

---

## 📄 3. `src/lib/exportExcel.ts` - CREAR ARCHIVOS DE EXCEL

### ¿Qué es?
Es como una **máquina que imprime listas** en formato Excel (esas hojas con cuadritos).

### ¿Cómo funciona?
```typescript
export function exportToExcel(students: Student[]) {
    // 1. Separamos los estudiantes por escuela
    const ietacStudents = students.filter(s => s.institution === 'IETAC');
    const sgStudents = students.filter(s => s.institution === 'SG');

    // 2. Creamos un libro de Excel nuevo
    const wb = XLSX.utils.book_new();  // Como abrir un cuaderno nuevo

    // 3. Creamos una hoja para cada grupo
    // Hoja 1: IETAC
    // Hoja 2: SG
    // Hoja 3: Todos

    // 4. Descargamos el archivo
    XLSX.writeFile(wb, 'Estudiantes_2024-12-21.xlsx');
}
```

### Analogía para un niño:
Es como cuando la maestra hace una **lista de asistencia**:
- Escribe los nombres en columnas ordenadas
- Cada fila es un estudiante
- Al final puede imprimir la lista

---

## 📄 4. `src/lib/exportIETAC.ts` - LISTA ESPECIAL PARA IETAC

### ¿Qué es?
Igual que el anterior, pero SOLO para los estudiantes de IETAC, con información extra sobre si ya confirmaron.

```typescript
export function exportIETACToExcel(students, confirmations) {
    // Solo tomamos estudiantes de IETAC
    const ietacStudents = students.filter(s => 
        s.first.toUpperCase().startsWith('IETAC')
    );

    // Agregamos una columna de "Estado"
    // ✅ CONFIRMADO o ⏳ PENDIENTE
}
```

---

## 📄 5. `src/app/page.tsx` - EL CEREBRO DE LA APLICACIÓN

### ¿Qué es?
Esta es la **página principal** donde TODO sucede. Es como el cerebro que controla todo el cuerpo.

### Tipos de usuarios que pueden entrar:

```typescript
// Hay 3 tipos de "puertas de entrada"
type AppView = 
    | 'login'           // 🚪 Pantalla de inicio de sesión
    | 'admin-dashboard' // 👑 Panel del administrador principal
    | 'ietac-dashboard' // 🏫 Panel del coordinador de IETAC
    | 'student-flow'    // 🎓 Proceso del estudiante
```

### El flujo del estudiante:

```typescript
// Cuando un estudiante entra, sigue estos pasos (como un juego)
type StudentStep = 
    | 'credentials'         // 📋 Ver sus datos
    | 'device-selection'    // 📱💻 ¿Celular o computadora?
    | 'pc-qr'              // 📷 Escanear código QR
    | 'guide-intro'        // 👋 Introducción
    | 'guide-1-name'       // 👤 Paso 1: Escribir nombre
    | 'guide-2-basic'      // 📅 Paso 2: Datos básicos
    | 'guide-3-email'      // 📧 Paso 3: Crear correo
    | 'guide-4-password'   // 🔑 Paso 4: Poner contraseña
    | 'confirmation-final' // ✅ ¡Listo!
```

### Credenciales de administradores:

```typescript
// Administrador principal (ve TODO)
const ADMIN_ID = '431302100';
const ADMIN_BIRTH = '20/07/2023';

// Coordinador de IETAC (solo ve IETAC)
const IETAC_ADMIN_ID = '3117930027';
const IETAC_ADMIN_BIRTH = '27/05/1990';
```

### Funciones importantes:

#### 📋 Copiar al portapapeles
```typescript
const copyToClipboard = async (text, fieldId) => {
    // Cuando tocas un dato, se copia automáticamente
    await navigator.clipboard.writeText(text);
    
    // Mostramos un mensaje bonito
    setToastData({
        message: '¡Copiado!',
        instruction: 'Pégalo en Google',
        emoji: '📋'
    });
};
```

#### 🔐 Iniciar sesión
```typescript
const handleLogin = async () => {
    // 1. Verificar si es administrador
    if (loginId === ADMIN_ID && loginBirth === ADMIN_BIRTH) {
        setView('admin-dashboard');  // Ir al panel de admin
        return;
    }

    // 2. Buscar si es un estudiante
    const student = studentData.find(s => 
        s.id === loginId && s.birth === loginBirth
    );

    if (student) {
        // 3. Verificar seguridad (no bloqueado, no sesión duplicada)
        // 4. Guardar que inició sesión
        // 5. Mostrar el proceso de creación de cuenta
    }
};
```

### Analogía para un niño:
Imagina un **parque de diversiones**:
- La entrada (`login`) → Muestras tu boleto
- Si eres trabajador del parque (`admin`) → Puedes ver todas las atracciones
- Si eres visitante (`student`) → Tienes un camino de juegos para completar

---

## 📄 6. `src/app/layout.tsx` - EL MARCO DE LA PÁGINA

### ¿Qué es?
Es como el **marco de una foto**. Todas las páginas tienen este marco alrededor.

```typescript
export default function RootLayout({ children }) {
    return (
        <html lang="es">           {/* El idioma es español */}
            <body className={inter.className}>
                {children}          {/* Aquí va el contenido */}
            </body>
        </html>
    );
}
```

### Metadatos:
```typescript
export const metadata = {
    title: "SeamosGenios | PreICFES Intensivo",  // El título en la pestaña
    description: "Plataforma de gestión..."       // Descripción para Google
};
```

---

## 📄 7. `src/app/globals.css` - LOS ESTILOS BONITOS

### ¿Qué es?
Es como el **libro de colores y decoraciones**. Dice cómo deben verse las cosas.

### Partes principales:

```css
/* Colores principales de la página */
:root {
    --background: #f8fafc;  /* Fondo gris clarito */
    --foreground: #1e293b;  /* Texto oscuro */
}

/* La barra de desplazamiento (scroll) personalizada */
::-webkit-scrollbar {
    width: 8px;  /* Delgadita y elegante */
}

/* Animaciones mágicas */
@keyframes fadeIn {
    /* Las cosas aparecen suavemente */
    from { opacity: 0; }
    to { opacity: 1; }
}
```

### Analogía para un niño:
Es como un **libro de instrucciones de Lego** que dice:
- "Los botones son azules"
- "Los títulos son grandes"
- "Cuando algo aparece, haz una animación bonita"

---

## 📄 8. `src/components/Dashboard/Header.tsx` - LA BARRA DE ARRIBA

### ¿Qué es?
Es la **barra de navegación** que ves arriba de la pantalla con:
- 🔍 Barra de búsqueda
- 🏫 Filtro por institución (IETAC, SG, Todos)
- 🔔 Campana de notificaciones
- 📥 Botón de descargar Excel
- 🚪 Botón de salir

### Componente de filtro alfabético:
```typescript
const AlphabetFilter = ({ label, value, onChange }) => {
    // Muestra las letras A-Z para filtrar
    // Si clickeas "M", solo ves estudiantes que empiezan con M
    
    return (
        <div>
            <button>Todos</button>
            <button>A</button>
            <button>B</button>
            {/* ... hasta la Z */}
        </div>
    );
};
```

### El panel de notificaciones:
```typescript
// Cuando clickeas la campana 🔔, ves:
// - Cuántos estudiantes iniciaron sesión hoy
// - Cuántos confirmaron su cuenta
// - Lista de actividad reciente
```

### Analogía para un niño:
Es como el **menú de un videojuego** arriba de la pantalla:
- Puedes buscar cosas
- Ver tus notificaciones
- Filtrar por categorías

---

## 📄 9. `src/components/Dashboard/Sidebar.tsx` - EL MENÚ LATERAL

### ¿Qué es?
Es el **menú de navegación** al lado izquierdo (solo en computadoras).

```typescript
export default function Sidebar({ activeView, onViewChange }) {
    return (
        <aside>
            {/* Logo */}
            <GraduationCap />  {/* Iconito de graduación */}
            <span>EduManager</span>

            {/* Opciones del menú */}
            <NavButton label="Base de Datos" />      {/* Ver estudiantes */}
            <NavButton label="Estadísticas" />       {/* Ver gráficos */}
            <NavButton label="Configuración" />      {/* Ajustes */}

            {/* Usuario actual */}
            <div>
                <span>Admin User</span>
                <span>🟢 Online</span>
            </div>
        </aside>
    );
}
```

### Analogía para un niño:
Es como la **lista de canales de TV**:
- Canal 1: Ver datos
- Canal 2: Ver estadísticas
- Canal 3: Configuración

---

## 📄 10. `src/components/Dashboard/MobileNav.tsx` - MENÚ PARA CELULARES

### ¿Qué es?
Cuando usas la app en el celular, el menú lateral no cabe. Entonces usamos un **botón flotante** que abre un menú.

```typescript
export default function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Botón flotante circular (FAB) */}
            <button onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? <X /> : <Menu />}  {/* X para cerrar, ☰ para abrir */}
            </button>

            {/* Cuando está abierto, muestra opciones */}
            {isOpen && (
                <div>
                    <button>📊 Estadísticas</button>
                    <button>📋 Estudiantes</button>
                    <button>🚪 Salir</button>
                </div>
            )}
        </>
    );
}
```

### Analogía para un niño:
Es como un **control remoto mágico** que aparece cuando lo necesitas:
- Tocas el botón y aparecen opciones
- Tocas de nuevo y desaparece

---

## 📄 11. `src/components/Dashboard/StudentTable.tsx` - LA TABLA DE ESTUDIANTES

### ¿Qué es?
Es donde ves la **lista completa de estudiantes** con todos sus datos.

### Dos modos de visualización:

#### 🖥️ En computadora: Tabla
```typescript
<table>
    <thead>
        <tr>
            <th>#</th>
            <th>✓</th>
            <th>Nombre</th>
            <th>Apellidos</th>
            <th>Email</th>
            <th>Contraseña</th>
            <th>Teléfono</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody>
        {/* Cada fila es un estudiante */}
    </tbody>
</table>
```

#### 📱 En celular: Tarjetas
```typescript
<div className="cards">
    {/* Cada estudiante es una tarjetita bonita */}
    <MobileCard student={student} />
</div>
```

### Funciones principales:

```typescript
// Marcar como confirmado ✅
const onToggleConfirm = (studentId) => {
    // Cambia de ⏳ a ✅ o viceversa
};

// Copiar datos al portapapeles
const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado!`);
};

// Enviar mensaje de WhatsApp con credenciales
const handleSendMessage = (student) => {
    const message = `Hola ${student.first}, 
        📧 Usuario: ${student.email}@gmail.com
        🔑 Contraseña: ${student.password}`;
    
    window.open(`https://wa.me/57${student.phone}?text=${message}`);
};
```

### Filtros de estado:
```typescript
// Puedes filtrar por estado de confirmación
const [statusFilter, setStatusFilter] = useState('ALL');

// Opciones:
// 'ALL'       → Ver todos
// 'CONFIRMED' → Solo los que ya confirmaron ✅
// 'PENDING'   → Solo los que faltan ⏳
```

### Analogía para un niño:
Es como un **álbum de cromos** digital:
- Cada cromo es un estudiante
- Puedes ver su foto, nombre y poder (contraseña)
- Puedes marcar cuáles ya tienes (confirmados)

---

## 📄 12. `package.json` - LA LISTA DE INGREDIENTES

### ¿Qué es?
Es como la **lista de ingredientes de una receta**. Dice qué necesita el proyecto para funcionar.

```json
{
    "name": "web5",                    // Nombre del proyecto
    "version": "0.1.0",                // Versión
    
    "scripts": {
        "dev": "next dev",             // Para programar
        "build": "next build",         // Para publicar
        "start": "next start"          // Para usar
    },
    
    "dependencies": {
        "next": "16.0.10",             // El framework principal
        "react": "19.2.1",             // La librería de interfaces
        "firebase": "^12.6.0",         // La nube mágica
        "framer-motion": "^12.23.26",  // Las animaciones
        "lucide-react": "^0.561.0",    // Los iconitos bonitos
        "xlsx": "^0.18.5"              // Para crear archivos Excel
    }
}
```

### Analogía para un niño:
Es como cuando haces un pastel:
- React = Harina (lo básico)
- Next.js = El horno (lo que hace que funcione)
- Firebase = La nube donde guardas fotos (la base de datos)
- Framer Motion = Los espolvoreos (animaciones bonitas)

---

# 🔐 SISTEMA DE SEGURIDAD

### ¿Qué protege la aplicación?

1. **Sesiones únicas**: Solo puedes estar conectado en UN dispositivo
2. **Velocidad de pasos**: Si avanzas muy rápido (como robot), te bloquea
3. **Infracciones**: Si haces 2 cosas malas, tu cuenta se bloquea
4. **Verificación de copiado**: Tienes que copiar los datos antes de avanzar

```typescript
// Sistema de infracciones
interface InfractionRecord {
    type: 'speed_violation' | 'duplicate_session' | 'manual_block';
    timestamp: string;
    details: string;
}

// Si avanzas muy rápido entre pasos
const STEP_TIME_LIMITS = {
    'credentials_to_google': 5,    // Mínimo 5 segundos para leer
    'google_step_1_to_2': 3,       // Mínimo 3 segundos entre pasos
    // ...
};
```

### Analogía para un niño:
Es como un **guardián en la puerta del castillo**:
- Si corres muy rápido, te detiene
- Si intentas entrar dos veces, te pregunta
- Si haces trampa, te saca

---

# 🎨 DISEÑO Y COLORES

### Paleta de colores:
- **Indigo (Azul-morado)**: Cosas de IETAC
- **Esmeralda (Verde)**: Cosas de SG
- **Slate (Gris)**: Fondos y textos neutros
- **Verde**: Confirmados ✅
- **Ámbar**: Pendientes ⏳
- **Rojo**: Errores y salir

### Componentes bonitos:
- **Cards**: Tarjetas con sombras suaves
- **Badges**: Etiquetas de colores
- **Toasts**: Mensajitos que aparecen abajo
- **Modales**: Ventanas que aparecen encima

---

# 🚀 CÓMO FUNCIONA TODO JUNTO

## Flujo completo de un estudiante:

```
1. 🚪 INICIO DE SESIÓN
   └─→ Escribe su ID y fecha de nacimiento
   └─→ El sistema verifica en la lista de estudiantes
   └─→ Si está, entra al flujo

2. 📋 VER CREDENCIALES
   └─→ Ve su nombre, correo y contraseña asignados
   └─→ Puede copiar cada dato tocándolo

3. 📱 SELECCIÓN DE DISPOSITIVO
   └─→ ¿Estás en celular o computadora?
   └─→ Si celular: Escanea QR para abrir en otro lado

4. 📚 GUÍA PASO A PASO
   └─→ Paso 1: Escribir nombre y apellidos
   └─→ Paso 2: Fecha de nacimiento y género
   └─→ Paso 3: Crear el correo electrónico
   └─→ Paso 4: Poner la contraseña
   └─→ Cada paso tiene verificación de tiempo

5. ✅ CONFIRMACIÓN FINAL
   └─→ ¿Ya creaste tu cuenta? ¡Confirma!
   └─→ Se guarda en Firebase que terminó
   └─→ El admin puede ver que ya confirmó
```

## Flujo del administrador:

```
1. 🔑 INICIA SESIÓN
   └─→ Con su ID especial de admin

2. 📊 VE EL DASHBOARD
   └─→ Lista de TODOS los estudiantes
   └─→ Estadísticas de confirmados vs pendientes
   └─→ Actividad en tiempo real

3. 🔧 ACCIONES
   └─→ Buscar estudiantes
   └─→ Filtrar por institución
   └─→ Ver quién está activo
   └─→ Contactar por WhatsApp
   └─→ Descargar Excel
   └─→ Bloquear/desbloquear estudiantes
```

---

# 📱 TECNOLOGÍAS USADAS

| Tecnología | ¿Qué hace? | Analogía |
|------------|------------|----------|
| **Next.js** | Framework principal | El motor del carro |
| **React** | Crear interfaces | Los ladrillos Lego |
| **TypeScript** | Código más seguro | Reglas del juego |
| **Tailwind CSS** | Estilos rápidos | Pinturas y colores |
| **Firebase** | Base de datos en la nube | La caja fuerte online |
| **Framer Motion** | Animaciones | Los efectos especiales |
| **Lucide Icons** | Iconitos bonitos | Las etiquetas visuales |
| **XLSX** | Crear archivos Excel | La impresora de listas |

---

# 🎯 RESUMEN FINAL

Este proyecto es como un **asistente digital super inteligente** que:

1. 📋 **Guarda** la información de estudiantes
2. 🎓 **Guía** paso a paso para crear cuentas Gmail
3. ✅ **Registra** quién ya terminó
4. 👀 **Muestra** estadísticas en tiempo real
5. 🔐 **Protege** contra mal uso
6. 📱 **Funciona** en celular y computadora

Todo esto usando tecnologías modernas y bonitas, como si fuera una **app profesional de verdad**.

---

# ❓ PREGUNTAS FRECUENTES

### ¿Cómo agrego un nuevo estudiante?
En el archivo `src/lib/data.ts`, agrega un nuevo objeto a la lista `studentDataIETAC` o `studentDataSG` siguiendo el mismo formato.

### ¿Cómo cambio los colores?
En `src/app/globals.css` puedes modificar las variables CSS o usar las clases de Tailwind en los componentes.

### ¿Cómo veo los datos de Firebase?
En la consola de Firebase: https://console.firebase.google.com
Proyecto: seamosgenios-portal

### ¿Cómo ejecuto el proyecto?
```bash
npm install    # Instalar dependencias
npm run dev    # Iniciar en modo desarrollo
```
El proyecto estará en: http://localhost:3000

---

**¡FIN DE LA DOCUMENTACIÓN!** 🎉

*Creado con ❤️ para que cualquiera pueda entender cómo funciona esta aplicación.*
