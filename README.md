# ⚡ Backend y Frontend de Trivia en Tiempo Real (Express + Socket.io)

Trivia interactiva en tiempo real (estilo Kahoot/HQ Trivia) para el ministerio Jóvenes En Victoria - **Gen412**, optimizado para soportar más de **200 conexiones concurrentes por sala** sin degradación del *Event Loop*.

---

## 🛠️ Arquitectura y Decisiones Técnicas

### 1. Configuración del Host (Pre-Lobby)
Antes de generar el PIN de la sala, el anfitrión puede configurar:
- **Tiempo por pregunta**: 10s, 20s, 30s (o personalizado en milisegundos).
- **Preguntas por bloque temático**: 1, 2, 3 o 5 preguntas por tema antes de alternar de bloque.

### 2. Bloques Temáticos Oficiales (`src/config/themes.js`)
Las preguntas se encuentran organizadas en 4 categorías:
1. **💼 Profesión (¿Y ahora qué?)**: Vocación, propósito, ética laboral y excelencia.
2. **💍 Noviazgo (Señor, confirma)**: Relaciones bíblicas, pureza, discernimiento y compatibilidad espiritual.
3. **🔥 Ministerio (Fuera de la banca)**: Servicio activo, Gran Comisión, liderazgo y dones espirituales.
4. **🧠 Emociones (Aleluya por fuera, caos por dentro)**: Salud mental, vulnerabilidad ante Dios, paz en Cristo y apoyo integral.

### 3. Evento `theme_change`
Cada vez que el juego transiciona hacia una nueva temática, el servidor emite el evento `theme_change` enviando la paleta de colores, icono y gradientes CSS correspondientes para actualizar dinámicamente el frontend.

### 4. Sistema de Avatares y Rachas (Streaks)
- Cada jugador cuenta con la estructura estricta:
  ```javascript
  {
    socketId: string,
    name: string,
    avatarId: string,
    score: number,
    streak: number,
    hasAnswered: boolean,
    lastAnswerTime: number | null,
    isActive: boolean
  }
  ```
- Al conectarse (`join_room`), el jugador puede elegir un avatar del catálogo predefinido o recibir uno aleatoriamente.
- Al responder correctamente de forma sucesiva, se acumulan rachas (`streak`) con bonificaciones dinámicas de puntos. Al fallar o expirar el tiempo, la racha se reinicia a 0.

### 5. Controles en Partida (Host)
El anfitrión cuenta con controles en tiempo real:
- **⏸️ Pausar partida (`pause_game`) / ▶️ Reanudar (`resume_game`)**: Congela el temporizador del servidor y bloquea el envío de respuestas.
- **⏭️ Saltar pregunta (`skip_question`)**: Cancela los temporizadores y revela de inmediato los resultados de la ronda.
- **⏹️ Forzar cierre de respuestas (`force_close_answers`)**: Cierra la ventana de recepción anticipadamente y computa la puntuación.

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos
- Node.js >= 18.x
- npm >= 9.x

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Iniciar Servidor
```bash
# Modo Producción
npm start

# Modo Desarrollo (con recarga automática)
npm run dev
```

El servidor estará disponible en `http://localhost:3000`.

---

## 🧪 Pruebas Automatizadas

```bash
# 1. Función de decaimiento temporal
node tests/scoring.test.js

# 2. Candado transaccional anti Race-Conditions
node tests/race-condition.test.js

# 3. Configuración de Host, Bloques Temáticos, Avatares y Controles
node tests/thematic-and-controls.test.js

# 4. Prueba de carga y concurrencia masiva (160 sockets simultáneos)
npm run test:load
```

---

## 📡 API de Eventos Socket.io

| Evento | Origen | Parámetros | Descripción |
|---|---|---|---|
| `create_room` | Host | `{ durationSeconds?, questionsPerTheme?, questions? }` | Genera sala con configuración Pre-Lobby. |
| `get_avatars` | Jugador | Callback | Obtiene el catálogo de avatares disponibles. |
| `join_room` | Jugador | `{ roomId, name, avatarId? }` | Valida sala y nombre, y asigna avatar y racha. |
| `start_game` | Host | `{ roomId }` | Inicia la partida temática. |
| `theme_change` | Servidor | `{ themeId, themeName, themeData }` | Notifica inicio de un nuevo bloque temático. |
| `pause_game` | Host | `{ roomId }` | Pausa el temporizador y bloquea envíos. |
| `resume_game` | Host | `{ roomId }` | Reanuda el juego con el tiempo restante. |
| `skip_question` | Host | `{ roomId }` | Salta la pregunta activa. |
| `force_close_answers` | Host | `{ roomId }` | Cierra la recepción de respuestas inmediatamente. |
| `submit_answer` | Jugador | `{ roomId, answerIndex }` | Procesa respuesta, lock, racha y decay score. |
| `next_question` | Host | `{ roomId }` | Avanza a la siguiente pregunta. |
| `question_results` | Servidor | `{ correctAnswer, leaderboard, optionCounts }` | Muestra resultados y ranking. |
| `game_finished` | Servidor | `{ podium, leaderboard }` | Fin de partida con podio. |
