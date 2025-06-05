// src/public/mobile/voiceDetector.js

//REVIEW: ESTE SCRIPT DE JS NO ES UN IIFE
let recognition = null; // Variable para almacenar la instancia de SpeechRecognition
let socketInstance = null; // Variable para almacenar la instancia del socket

/**
 //Inicializa el reconocimiento de voz.
 * @param {Socket} socket - La instancia del cliente Socket.IO.
 */
export function initVoiceDetection(socket) {
    if (!socket) {
        console.error("Se requiere una instancia de Socket.IO para initVoiceDetection.");
        return;
    }
    socketInstance = socket; // Guarda la instancia del socket

    // Verifica si el navegador soporta SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('La API SpeechRecognition no es soportada por este navegador.');
        alert('Tu navegador no soporta el reconocimiento de voz.');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;

    // Procesar resultados y emitir evento al servidor
    recognition.addEventListener('result', (e) => {
        const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join('')
            .trim()
            .toLowerCase();

        // Log para imprimir lo que capturó el sensor de voz
        console.log(`Texto capturado por el sensor de voz: "${transcript}"`);
        
        // Identificadores de sesión para los eventos enviados al servidor
        const currentUserId   = sessionStorage.getItem('fitGameUserId');
        const currentScreenId = sessionStorage.getItem('currentScreen');

        if (transcript == "siguiente ejercicio"){
            const currentUserId = sessionStorage.getItem('fitGameUserId');
            const currentScreenId = sessionStorage.getItem('currentScreen');
            socket.emit('exercise_completed', { userId: currentUserId, screenId: currentScreenId});
            console.log(`Comando de voz enviado: "${transcript}"`);
        }else if (transcript == "terminar rutina"){
            socketInstance.emit('end_routine', { userId: currentUserId, screenId: currentScreenId });
            console.log(`Comando de voz enviado: "${transcript}"`);
        }else if (transcript == "pausar"){
            socketInstance.emit('pause_routine', { userId: currentUserId, screenId: currentScreenId });
            console.log(`Comando de voz enviado: "${transcript}"`);
        }else if (transcript == "continuar"){
                socketInstance.emit('continue_routine', { userId: currentUserId, screenId: currentScreenId });
                console.log(`Comando de voz enviado: "${transcript}"`);
        }else {
            alert('No se pudo entender comando, intente de nuevo');
        }
    });

    // Manejar errores de reconocimiento
    recognition.addEventListener('error', (err) => {
        console.error('Error de reconocimiento de voz:', err);
        alert('Error en el reconocimiento de voz. Intenta nuevamente.');
    });
}

// Inicia el reconocimiento de voz.

export function startVoiceRecognition() {
    if (recognition) {
        recognition.start();
        console.log('Reconocimiento de voz iniciado.');
    } else {
        console.error('El reconocimiento de voz no está inicializado.');
    }
}
