// src/public/handController.js
import {
    FilesetResolver,
    HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let handLandmarker = null;

/**
 * Carga (una sola vez) el modelo de Hand Landmarker.
 * @returns {Promise<HandLandmarker>}
 */
export async function loadHandDetector() {
    if (handLandmarker) return handLandmarker;
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
    });
    return handLandmarker;
}

/**
 * Procesa un frame de vídeo y devuelve los resultados.
 * @param {HTMLVideoElement} videoEl 
 * @param {number} timestamp 
 * @returns {import("@mediapipe/tasks-vision").HandLandmarkerResult}
 */
export function detectHands(result, time) {
    return handLandmarker.detectForVideo(videoEl, time);
}

/**
 * Dibuja los landmarks de la mano en el canvas.
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array<Array<{x:number,y:number}>>} hands 
 * @param {number} width 
 * @param {number} height 
 */
export function drawHands(ctx, hands, width, height) {
    ctx.save();
    ctx.strokeStyle = "#FFD700";
    ctx.fillStyle   = "#FFA500";
    ctx.lineWidth   = 2;
    for (const hand of hands) {
        // Conexiones básicas de mano (0–4 dedo pulgar, etc.)
        const connections = [
            [0,1],[1,2],[2,3],[3,4],    // pulgar
            [0,5],[5,6],[6,7],[7,8],    // índice
            [0,9],[9,10],[10,11],[11,12],// medio
            [0,13],[13,14],[14,15],[15,16],// anular
            [0,17],[17,18],[18,19],[19,20] // meñique
        ];
        for (const [i,j] of connections) {
            const a = hand[i], b = hand[j];
            ctx.beginPath();
            ctx.moveTo(a.x*width, a.y*height);
            ctx.lineTo(b.x*width, b.y*height);
            ctx.stroke();
        }
        // dibuja los puntos
        for (const p of hand) {
            ctx.beginPath();
            ctx.arc(p.x*width, p.y*height, 3, 0, 2*Math.PI);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Detecta patrones de manos (por ejemplo: puño, palma abierta, señal de OK, etc.)
 * @param {Array<Array<{x:number,y:number}>>} hands – listas de landmarks normalizados
 * @param {string} pattern – nombre del patrón a detectar
 * @param {Object} state – objeto de estado para este patrón
 */
export function detectHandPattern(hands, pattern, state) {
    if (!hands.length) return;
    const hand  = hands[0];
    const wrist = hand[0];
  
    if (pattern === 'fist') {
        // conteo dedos plegados
        let closed = 0;
        for (const tipIdx of [4,8,12,16,20]) {
            const tip = hand[tipIdx], pip = hand[tipIdx-2];
            const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            if (dTip < dPip) closed++;
        }
        const isFist = closed >= 4; // cuatro dedos plegados → puño
        // edge-trigger
        if (isFist && !state.prevFist) {
            console.log('🔒 Puño detectado');
            state.fistDetected = true;
        }
        state.fist     = isFist;
        return;
    }
  
    if (pattern === 'thumbs_up' && state.fistDetected) {
        // sólo si antes detectamos puño
        if (!state.fistDetected) return;
    
        // 1) pulgar hacia arriba: punta encima de muñeca
        const tip4 = hand[4];
        const thumbUp = tip4.y < wrist.y - 0.02;
    
        // 2) demás dedos plegados
        const others = [8,12,16,20].every(i => {
            const tip = hand[i], pip = hand[i-2];
            return tip.y > pip.y + 0.02;
        });
    
        const isThumbs = thumbUp && others;
        // edge-trigger para disparar y consumir fistDetected
        if (isThumbs && !state.prevThumbsUp) {
            console.log('👍 Pulgar arriba detectado');
            state.fistDetected = false; // consumido
        }
        return;
    }
}
/**
 * Cuenta cuántos dedos están extendidos (tip sobre pip).
 * @param {Array<{x:number,y:number}>} hand 
 * @returns {number}
 */
export function countExtendedFingers(hand) {
    const wrist = hand[0];
    let extended = 0;
    // índices de las puntas: pulgar(4), índice(8), medio(12), anular(16), meñique(20)
    for (const tipIdx of [4,8,12,16,20]) {
      const tip = hand[tipIdx];
      const pip = hand[tipIdx - 2];
      // si la punta está más lejos de la muñeca que la pip → extendido
      const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
      const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
      if (dTip > dPip) extended++;
    }
    return extended;
  }