---
description: Guía para configurar Firebase y Google Auth correctamente
---

# 🔧 Configuración de Firebase + Google Authentication

## 🔴 Error Actual

```
auth/api-key-not-valid.-please-pass-a-valid-api-key.
```

Este error indica que la API Key de Firebase no es válida o no está correctamente configurada.

---

## ✅ PASO 1: Verificar tu configuración de Firebase

### 1.1 Abre el archivo de configuración

```
c:\Users\Daniel\Downloads\web5\src\lib\firebase.ts
```

Busca el objeto `firebaseConfig` al inicio del archivo. Debería verse así:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSy...",          // 👈 Esta debe ser válida
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 1.2 Obtener una API Key válida

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **seamosgenios-portal** (o el nombre de tu proyecto)
3. Clic en el ⚙️ (engranaje) → **Configuración del proyecto**
4. En la pestaña **General**, baja hasta **"Tus apps"**
5. Selecciona la app web (ícono `</>`)
6. Copia la configuración completa y reemplázala en `firebase.ts`

---

## ✅ PASO 2: Habilitar Google Auth en Firebase

### 2.1 Activar el proveedor de Google

1. En Firebase Console, ve a **Authentication** (menú lateral izquierdo)
2. Clic en la pestaña **Sign-in method**
3. Busca **Google** en la lista de proveedores
4. Clic en **Google** → **Habilitar** (toggle ON)
5. Ingresa un **email de soporte** (tu email)
6. **Guardar**

### 2.2 Verificar el dominio autorizado

1. En la misma sección de **Authentication**
2. Ve a la pestaña **Settings** → **Authorized domains**
3. Asegúrate de que `localhost` esté en la lista
4. Si no está, agrégalo manualmente

---

## ✅ PASO 3: Acceder a Google Cloud Console (DESDE Firebase)

> 🎯 **TIP**: Firebase crea automáticamente un proyecto en Google Cloud. Puedes acceder directamente desde Firebase Console.

### 3.1 Acceder a Google Cloud Console desde Firebase

1. **Abre Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com/)

2. **Selecciona tu proyecto**: `seamosgenios-portal`

3. **Clic en ⚙️ (engranaje)** → **Configuración del proyecto**

4. **Mira arriba del todo** - verás el nombre del proyecto y un enlace que dice:

   ```
   ID del proyecto: seamosgenios-portal
   ```

5. **Justo al lado**, hay un botón o enlace que dice **"Administrar cuenta de servicio"** o un ícono de enlace externo 🔗

6. **Alternativamente**, puedes ir directo a:

   ```
   https://console.cloud.google.com/apis/credentials?project=seamosgenios-portal
   ```

### 3.2 Una vez en Google Cloud Console - Verificar APIs

1. En el menú lateral izquierdo ☰, busca **"APIs y servicios"** (o "APIs & Services")

2. Clic en **"Biblioteca"** (Library)

3. **Busca y habilita estas APIs** (una por una):

   **API #1: Identity Toolkit API**

   ```
   🔍 Buscar: "Identity Toolkit"
   ✅ Clic en el resultado → Clic en "HABILITAR" (Enable)
   ```

   **API #2: Token Service API**

   ```
   🔍 Buscar: "Token Service API"
   ✅ Clic en el resultado → Clic en "HABILITAR" (Enable)
   ```

### 3.3 Verificar las Credenciales (API Keys)

1. En el menú lateral, clic en **"Credenciales"** (Credentials)

2. Verás una lista de **Claves de API** (API Keys)
   - Debería haber una llamada algo como **"Browser key (auto created by Firebase)"**

3. **Clic en esa API Key** para ver su configuración

4. **Verifica las "Restricciones de aplicaciones"**:
   - Si dice **"Ninguna"** → ✅ Está bien para desarrollo
   - Si dice **"Sitios web"** → Asegúrate de que incluya:

     ```
     http://localhost
     http://localhost:3000
     http://localhost:3000/*
     ```

5. **Verifica las "Restricciones de API"**:
   - Si dice **"No restringir clave"** → ✅ Está bien
   - Si dice **"Restringir clave"** → Asegúrate de que incluya:
     - Identity Toolkit API
     - Token Service API
     - Firebase Installations API

6. **GUARDAR** los cambios

### 3.4 Link Directo (Atajo)

Si el proyecto es `seamosgenios-portal`, puedes ir directamente a:

- **Credenciales**: <https://console.cloud.google.com/apis/credentials?project=seamosgenios-portal>
- **Biblioteca de APIs**: <https://console.cloud.google.com/apis/library?project=seamosgenios-portal>

---

## ✅ PASO 4: Archivo .env.local (Recomendado)

Para mayor seguridad, usa variables de entorno:

### 4.1 Crear archivo `.env.local`

```bash
# En la raíz del proyecto (c:\Users\Daniel\Downloads\web5\)
```

Contenido:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4.2 Actualizar firebase.ts

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
```

### 4.3 Reiniciar el servidor

```bash
# Detener el servidor actual (Ctrl+C)
npm run dev
```

---

## ✅ PASO 5: Verificación Final

### 5.1 Checklist

- [ ] API Key es válida (copiada directamente de Firebase Console)
- [ ] Google Auth está habilitado en Firebase Authentication
- [ ] `localhost` está en los dominios autorizados
- [ ] Identity Toolkit API está habilitada en Google Cloud Console
- [ ] No hay restricciones de dominio bloqueando localhost

### 5.2 Prueba rápida

1. Abre `http://localhost:3000`
2. Inicia sesión como estudiante
3. Clic en "Ya tengo mi cuenta - Verificar con Google"
4. Debería abrirse el popup de Google

---

## 🚨 Errores Comunes

### Error: `popup-closed-by-user`

- El usuario cerró el popup de Google manualmente
- No es un error de configuración

### Error: `auth/unauthorized-domain`

- Agrega `localhost` a los dominios autorizados en Firebase

### Error: `auth/api-key-not-valid`

- La API Key está mal copiada o expiró
- Genera una nueva desde Firebase Console

### Error: `auth/configuration-not-found`

- Google Auth no está habilitado en Firebase
- Ve a Authentication → Sign-in method → Google → Enable

---

## 📞 Soporte

Si después de seguir todos los pasos sigue fallando:

1. Verifica que el proyecto de Firebase esté en plan "Spark" (gratis) o "Blaze"
2. Revisa la consola de Firebase por cualquier alerta
3. Intenta crear una nueva API Key desde cero
