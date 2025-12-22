# 🚀 Guía Maestra: Firebase Plan Gratuito (Spark)

Esta guía está diseñada para que saques el máximo provecho a Firebase **sin pagar un solo peso** y sin ingresar tarjeta de crédito. Tu proyecto es pequeño y el plan gratuito es más que suficiente si lo configuras bien.

---

## 🎁 ¿Qué obtienes GRATIS exactemente?

Con el **Plan Spark** tienes estos recursos mensuales/diarios de por vida:

1. **Base de Datos (Firestore)**:
    * **50,000 lecturas al día** (¡Es mucho! Suficiente para ~500-1000 usuarios activos diarios)
    * **20,000 escrituras al día**
    * **1 GB de almacenamiento** total (Para textos y datos es una inmensidad)

2. **Hosting (Si decides usar Firebase Hosting)**:
    * 10 GB de almacenamiento
    * 360 MB de transferencia al día

3. **Autenticación**:
    * 50,000 usuarios activos al mes (MAUs)

4. **Analytics**:
    * Ilimitado y gratuito siempre

---

## 🛠️ Configuración Paso a Paso (100% Gratis)

### Paso 1: Crear Proyecto

1. Ve a [console.firebase.google.com](https://console.firebase.google.com).
2. Crea un nuevo proyecto ("SeamosGenios").
3. **Desactiva** "Google Analytics" en este paso inicial para simplificar (lo activaremos manual después).
4. ¡Listo! Ya tienes el plan Spark activo por defecto.

### Paso 2: Activar Base de Datos (Firestore)

1. Menú izquierdo > **Compilación** > **Firestore Database**.
2. Clic en **"Crear base de datos"**.
3. Ubicación: Elige `nam5 (us-central)` o la que te sugiera por defecto.
4. Reglas de seguridad: Elige **"Comenzar en modo de prueba"** (Cámbialas luego siguiendo el paso 3).

### Paso 3: Proteger tus Límites (Reglas de Seguridad)

Para evitar que alguien malintencionado gaste tus 50,000 lecturas gratis, usa estas reglas. Ve a la pestaña **Reglas**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regla 1: Solo permitir crear eventos (logs), no leerlos masivamente
    match /activity_events/{eventId} {
      allow create: if true;  // Cualquiera puede registrar actividad
      allow read: if false;   // Nadie puede leer todo sin permiso (ahorra lecturas)
      allow update, delete: if false;
    }

    // Regla 2: Confirmaciones de cuenta
    match /account_confirmations/{docId} {
      allow read, write: if true; // Necesario para que la app funcione
    }
  }
}
```

### Paso 4: Activar Analytics (Opcional pero recomendado)

Es gratis y no consume recursos de base de datos.

1. Menú izquierdo > **Analytics**.
2. Clic en "Habilitar".
3. Sigue los pasos y obtén tu `Measurement ID`.

---

## 💡 Trucos para Ahorrar Recursos (Optimización)

Para que tus 50,000 lecturas rindan como si fueran 1 millón:

### 1. Usa `localStorage` (Ya implementado)

Tu aplicación ya guarda las credenciales en el navegador del estudiante.

* **Beneficio**: Cada vez que el estudiante entra de nuevo, lee de su navegador, NO de tu base de datos.
* **Costo**: 0 lecturas.

### 2. Evita el "Botón de Pánico" (Refresh masivo)

En el panel de administrador, evita recargar la página (F5) compulsivamente.

* Firebase usa "Listeners" que solo descargan los datos *nuevos*. Si recargas la página, descarga TODOS de nuevo.

### 3. Índices Simples

Firestore te pedirá crear índices si haces búsquedas complejas. Hazlo desde la consola (te dará un enlace directo en el error). Esto hace las consultas más rápidas y baratas.

---

## 🚨 ¿Qué pasa si llego al límite?

Si un día tienes un éxito rotundo y superas las 50,000 operaciones:

1. La app **no te cobrará nada** (no tiene tu tarjeta).
2. Simplemente mostrará un error de "Quota exceeded" y dejará de cargar datos **solo por el resto del día**.
3. A las 00:00 (hora del pacífico) se reinicia el contador y todo vuelve a funcionar gratis.

---

## ✅ Resumen para IETAC

* **Costo mensual**: $0
* **Riesgo financiero**: Nulo
* **Capacidad**: Suficiente para toda la institución y más.
* **Mantenimiento**: Mínimo.

¡Disfruta tu infraestructura gratuita profesional!
