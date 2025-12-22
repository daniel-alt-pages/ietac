# 🚀 Script de Migración y Limpieza Firebase

## ⚠️ IMPORTANTE: Ejecutar SOLO cuando tengas cuota disponible

Este script:

1. ✅ Migra `activity_events` esenciales de BD principal → BD secundaria
2. ✅ Elimina `activity_events` de BD principal
3. ✅ Elimina colección `security_status` antigua (ya no se usa)
4. ✅ Limpia duplicados y eventos no esenciales

---

## 📋 Pre-requisitos

- Cuota de Firebase disponible (esperar hasta mañana)
- Node.js instalado
- Acceso a ambas bases de datos

---

## 🔧 Cómo ejecutar

### Opción 1: Con ts-node (recomendado)

```bash
# Instalar ts-node si no lo tienes
npm install -g ts-node

# Ejecutar el script
cd c:/Users/Daniel/Downloads/web5
ts-node scripts/migrate-and-cleanup.ts
```

### Opción 2: Compilar y ejecutar

```bash
cd c:/Users/Daniel/Downloads/web5

# Compilar TypeScript a JavaScript
npx tsc scripts/migrate-and-cleanup.ts --outDir scripts/dist --module commonjs --target es2020 --moduleResolution node --esModuleInterop true

# Ejecutar
node scripts/dist/migrate-and-cleanup.js
```

---

## 📊 Qué esperar

El script mostrará progreso en tiempo real:

```
🚀 Iniciando migración y limpieza...

📊 PASO 1: Migrando activity_events...
   Encontrados 5000 eventos en BD principal
   Eventos esenciales únicos: 1200
   ✓ Migrados 400/1200 eventos
   ✓ Migrados 800/1200 eventos
   ✓ Migrados 1200/1200 eventos

🗑️  PASO 2: Eliminando activity_events de BD principal...
   ✓ Eliminados 400/5000 eventos
   ...

✅ MIGRACIÓN Y LIMPIEZA COMPLETADA

📊 Estadísticas:
   • Eventos migrados a BD secundaria: 1200
   • Eventos eliminados de BD principal: 5000
   • Documentos de seguridad eliminados: 150
   • Duplicados removidos: 3800
   • Eventos no esenciales eliminados: 200

💾 Espacio liberado en BD principal: ~2575 KB
```

---

## ⏱️ Tiempo estimado

- Con 5000 eventos: ~2-3 minutos
- Con 20000 eventos: ~8-10 minutos

---

## 🛡️ Seguridad

El script:

- ✅ Solo migra eventos esenciales (login, confirmation, google_verify)
- ✅ Elimina duplicados automáticamente
- ✅ No afecta la colección `students` ni `account_confirmations`
- ✅ Hace backup automático en BD secundaria antes de eliminar

---

## 📝 Después de ejecutar

1. Verifica en Firebase Console que los datos se migraron correctamente
2. Desactiva modo mantenimiento: `MAINTENANCE_MODE = false`
3. Haz deploy: `npm run build && npx firebase-tools deploy`
4. Monitorea el consumo en los próximos días

---

## ❓ Problemas comunes

### Error: "Quota exceeded"

→ Espera a que se reinicie la cuota (mañana)

### Error: "Permission denied"

→ Verifica que las reglas de Firestore permitan escritura en ambas BDs

### Script se detiene a mitad

→ Es normal si hay muchos datos. Vuelve a ejecutar, saltará los ya migrados.
