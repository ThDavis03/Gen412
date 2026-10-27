/**
 * Gestor de Candados Transaccionales en memoria.
 * Evita condiciones de carrera ("race conditions") causadas por ráfagas de paquetes
 * simultáneos o doble envío desde el mismo socket client.
 */
class TransactionLockManager {
  constructor() {
    this.locks = new Map(); // key -> { timestamp, timeoutId }
  }

  /**
   * Intenta adquirir un candado para una clave específica.
   * @param {string} key - Clave única (ej. `roomId:socketId:questionIndex`).
   * @param {number} ttlMs - Tiempo de vida máximo del candado como salvaguarda ante fallos (default 5000ms).
   * @returns {boolean} true si se adquirió con éxito, false si ya estaba bloqueado.
   */
  acquire(key, ttlMs = 5000) {
    if (this.locks.has(key)) {
      return false; // Ya está bloqueado
    }

    // Auto-limpieza de emergencia por si un error no controlado impide liberar
    const timeoutId = setTimeout(() => {
      this.release(key);
    }, ttlMs);

    this.locks.set(key, {
      timestamp: Date.now(),
      timeoutId,
    });

    return true;
  }

  /**
   * Libera el candado asociado a la clave.
   * @param {string} key - Clave única.
   */
  release(key) {
    const entry = this.locks.get(key);
    if (entry) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      this.locks.delete(key);
    }
  }

  /**
   * Comprueba si una clave se encuentra actualmente bloqueada.
   * @param {string} key - Clave única.
   * @returns {boolean}
   */
  isLocked(key) {
    return this.locks.has(key);
  }

  /**
   * Limpia todos los candados asociados a una sala (útil cuando se cierra la sala o finaliza).
   * @param {string} roomId - ID de la sala.
   */
  clearRoomLocks(roomId) {
    const prefix = `${roomId}:`;
    for (const [key, entry] of this.locks.entries()) {
      if (key.startsWith(prefix)) {
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        this.locks.delete(key);
      }
    }
  }
}

// Instancia singleton para compartir en toda la aplicación
const globalLockManager = new TransactionLockManager();

module.exports = {
  TransactionLockManager,
  globalLockManager,
};
