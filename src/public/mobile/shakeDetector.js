// src/public/mobile/shakeDetector.js

let socketInstance = null; // Guardaremos la instancia del socket aquí
let lastShakeTime = 0;
const SHAKE_THRESHOLD = 15; // Sensibilidad - ¡Necesita ajuste/pruebas! (m/s^2)
const COOLDOWN_PERIOD = 2000; // Milisegundos de espera entre detecciones

/**
 * Maneja los eventos de movimiento del dispositivo para detectar agitación.
 * @param {DeviceMotionEvent} event 
 */
function handleDeviceMotion(event) {
    // Comprueba si ha pasado suficiente tiempo desde la última detección
    const now = Date.now();
    if (now - lastShakeTime < COOLDOWN_PERIOD) {
        return; // Aún en cooldown, no hacer nada
    }

    // Accede a la aceleración 
    const acceleration = event.acceleration || event.accelerationIncludingGravity;

    if (!acceleration || acceleration.x === null || acceleration.y === null || acceleration.z === null) {
        console.warn('Datos de aceleración no disponibles o incompletos.');
        return;
    }

    const { x, y, z } = acceleration;

    // Comprueba si alguna de las aceleraciones supera el umbral
    if (Math.abs(x) > SHAKE_THRESHOLD || Math.abs(y) > SHAKE_THRESHOLD || Math.abs(z) > SHAKE_THRESHOLD) {
        console.log(`¡Dispositivo agitado! X=${x?.toFixed(2)}, Y=${y?.toFixed(2)}, Z=${z?.toFixed(2)}`);

        // Actualiza el tiempo de la última detección
        lastShakeTime = now;

        // Envía la señal al servidor a través del socket
        if (socketInstance) {
            socketInstance.emit('shake');
            console.log('Evento "shake" enviado al servidor.');
        } else {
            console.error('Instancia de socket no disponible en sensorInput.js');
        }
    }
}

/**
 * Inicializa la detección de agitación.
 * @param {Socket} socket - La instancia del cliente Socket.IO.
 */
export function initShakeDetection(socket) {
    if (!socket) {
        console.error("Se requiere una instancia de Socket.IO para initShakeDetection.");
        return;
    }
    socketInstance = socket; // Guarda la instancia para usarla en el handler
    
    console.log('Esperando por shake...');
    
    // Comprueba si la API DeviceMotionEvent es compatible
    if (window.DeviceMotionEvent && typeof window.addEventListener === 'function') {
        console.log('API DeviceMotionEvent soportada. Intentando añadir listener.');

        //  Gestión de Permisos
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('devicemotion', handleDeviceMotion);
                        console.log('Permiso de movimiento concedido. Listener añadido.');
                    } else {
                        console.warn('Permiso de movimiento no concedido.');
                        alert('Debes habilitar los permisos de movimiento para usar esta funcionalidad.');
                    }
                })
                .catch(error => {
                    console.error('Error solicitando permiso de movimiento:', error);
                    alert('Error al solicitar permisos para los sensores.');
                });
        } else {
            // Caso estándar para navegadores que no requieren permisos explícitos
            window.addEventListener('devicemotion', handleDeviceMotion);
            console.log('Listener de devicemotion añadido (sin solicitud de permiso explícita requerida).');
        }
    } else {
        console.warn('La API DeviceMotionEvent no es soportada por este navegador/dispositivo.');
        alert('Tu navegador o dispositivo no soporta la detección de movimiento.');
    }
}

/**
 * Detiene la detección de agitación (si es necesario en el futuro).
 */
export function stopShakeDetection() {
    window.removeEventListener('devicemotion', handleDeviceMotion);
    console.log('Listener de devicemotion eliminado.');
    socketInstance = null; // Limpia la referencia al socket
}