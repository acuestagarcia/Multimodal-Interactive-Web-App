// src/public/poseDetector.js
import {
        FilesetResolver,
        PoseLandmarker
    } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";
  
let poseLandmarker = null;
export async function loadPoseDetector() {
    if (poseLandmarker) 
        return poseLandmarker;
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
			modelAssetPath:
				"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
			delegate: "GPU",
        },
        runningMode: "VIDEO",
		numPoses: 1,
		minPoseDetectionConfidence: 0.5,    // detección mínima
		minPosePresenceConfidence: 0.5,     // presencia mínima
		minTrackingConfidence: 0.5
    });
    return poseLandmarker;
}

/**
 * Suaviza landmarks promediando los últimos frames del buffer.
 * @param {Array<Array<{x:number,y:number}>>} buffer
 * @returns {Array<{x:number,y:number}>}
 */
export function smoothLandmarks(buffer) {
	const n = buffer.length;
	if (n === 0) return [];
	// Inicializa un array de ceros del tamaño de un frame
	const acc = buffer[0].map(() => ({ x: 0, y: 0 }));
	// Suma punto a punto
	for (const frame of buffer) {
		frame.forEach((pt, i) => {
			acc[i].x += pt.x;
			acc[i].y += pt.y;
		});
	}
	// Divide por n para promedio
	return acc.map(pt => ({ x: pt.x / n, y: pt.y / n }));
}
  
/**
 * Dibuja el esqueleto completo (tronco, brazos y piernas) sobre el canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number}>} lm – lista de landmarks normalizados
 * @param {number} w – ancho del canvas
 * @param {number} h – alto del canvas
 */
export function drawSkeleton(ctx, lm, w, h) {
	// Conexiones que queremos trazar
	const connections = [
		[11,12], [11,13], [13,15], [12,14], [14,16], // brazos
		[11,23], [12,24], // hombros ↔ caderas
		[23,24],           // caderas
		[23,25], [25,27],  // pierna izquierda
		[24,26], [26,28]   // pierna derecha
	];
	ctx.save();
	// Línea fina y neutra
	ctx.strokeStyle = '#000';
	ctx.lineWidth   = 1.5;
	for (const [i,j] of connections) {
		const a = lm[i], b = lm[j];
		ctx.beginPath();
		ctx.moveTo(a.x * w, a.y * h);
		ctx.lineTo(b.x * w, b.y * h);
		ctx.stroke();
	}
	// Articulaciones
	ctx.fillStyle = '#444';
	for (const idx of [11,12,13,14,15,16,23,24,25,26,27,28]) {
		const p = lm[idx];
		ctx.beginPath();
		ctx.arc(p.x * w, p.y * h, 3, 0, 2*Math.PI);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * Devuelve true si acabas de bajar en una flexión.
 */
export function detectByTorso(lm, state) {
	const shoulderY = (lm[11].y + lm[12].y) / 2;
	const hipY      = (lm[23].y + lm[24].y) / 2;
	const down      = (hipY - shoulderY) > 0.05;
	const didCount  = down && !state.lastTorsoDown;
	state.lastTorsoDown = down;
	return didCount;
}

// Calcula el ángulo A‑B‑C en grados
export function calculateAngle(A, B, C) {
    const ABx = A.x - B.x, ABy = A.y - B.y;
    const CBx = C.x - B.x, CBy = C.y - B.y;
    const dot = ABx*CBx + ABy*CBy;
    const mag = Math.hypot(ABx, ABy)*Math.hypot(CBx, CBy) + 1e-6;
    const cos = Math.min(Math.max(dot/mag, -1), 1);
    return (Math.acos(cos)*180)/Math.PI;
}

/**
 * Estado dipCount y lastDipDownAngle en el mismo state.
 * Umbrales up=120°, down=90° por defecto.
 * Devuelve true cuando completes un dip.
 */
export function detectDipTransitionAngle(lm, state) {
	state.lastDipDownAngle    ??= false;
	state.upThresholdAngle    ??= 120;
	state.downThresholdAngle  ??= 90;
  
	const leftAngle  = calculateAngle(lm[11], lm[13], lm[15]);
	const rightAngle = calculateAngle(lm[12], lm[14], lm[16]);
	const angle      = Math.min(leftAngle, rightAngle);
  
	let didCount = false;
	if (!state.lastDipDownAngle && angle < state.downThresholdAngle) {
	  	state.lastDipDownAngle = true;
	} else if (state.lastDipDownAngle && angle > state.upThresholdAngle) {
		state.lastDipDownAngle = false;
		didCount = true;
	}
	return didCount;
}
/**
 * Detecta pull‑ups usando un buffer de landmarks y un estado de hold.
 * @param {Array} lm – landmarks
 * @param {Object} state – objeto compartido con:
 *    state.pullUpState: 'down'|'up',
 *    state.ready: boolean,
 *    state.upHoldStart: timestamp|null,
 *    state.lmBuffer: array de frames,
 */
/**
 * Devuelve true cuando completes un pull‑up.
 */
export function detectPullUps(lm, state) {
	state.pullUpState     ??= 'down';
	state.ready           ??= false;
	state.upHoldStart     ??= null;
	state.lmBuffer        ??= [];
	const requiredHold    = 2000;
	const upThresh        = 0.02;
	const downThresh      = 0.02;
	state.lmBuffer.push(lm);
	if (state.lmBuffer.length > 5) state.lmBuffer.shift();
	// Media de landmarks
	const smooth = state.lmBuffer.reduce((acc, frame) => {
			frame.forEach((pt, i) => {
				acc[i].x += pt.x; acc[i].y += pt.y;
			});
			return acc;
	}, state.lmBuffer[0].map(_ => ({ x: 0, y: 0 })))
	.map(pt => ({ x: pt.x/state.lmBuffer.length, y: pt.y/state.lmBuffer.length }));
  
	const shoulderY = (smooth[11].y + smooth[12].y)/2;
	const elbowY    = (smooth[13].y + smooth[14].y)/2;
	const diff      = shoulderY - elbowY;
	const now       = Date.now();
  
	// 1) Hold arriba
	if (!state.ready) {
		if (diff < -upThresh) {
			state.upHoldStart ||= now;
			if (now - state.upHoldStart >= requiredHold) state.ready = true;
		} else {
			state.upHoldStart = null;
		}
		return false;
	}
  
	// 2) Máquina de estados
	let didCount = false;
	if (state.pullUpState === 'down' && diff < -upThresh) {
	  	state.pullUpState = 'up';
	} else if (state.pullUpState === 'up' && diff > downThresh) {
		state.pullUpState = 'down';
		didCount = true;
	}
	return didCount;
}

/**
 * Cuenta sentadillas detectando la transición de rodillas extendidas ↔ flexionadas
 * usando un buffer de landmarks para suavizar.
 *
 * Devuelve true cuando completes una sentadilla.
 */
export function detectSquats(lm, state) {
	state.squatState  ??= 'up';
	state.squatBuffer ??= [];
	const upThresh   = 150;
	const downThresh = 110;
	const bufSize    = 5;
  
	state.squatBuffer.push(lm);
	if (state.squatBuffer.length > bufSize) state.squatBuffer.shift();
	// Media de landmarks
	const smooth = state.squatBuffer.reduce((acc, frame) => {
		frame.forEach((pt, i) => {
			acc[i].x += pt.x; acc[i].y += pt.y;
		});
		return acc;
	}, state.squatBuffer[0].map(_ => ({ x: 0, y: 0 })))
	.map(pt => ({ x: pt.x / state.squatBuffer.length, y: pt.y / state.squatBuffer.length }));
  
	// calcula ángulo mínimo de ambas rodillas…
	const angle = Math.min(
		calculateAngle(smooth[23], smooth[25], smooth[27]),
		calculateAngle(smooth[24], smooth[26], smooth[28])
	);
  
	let didCount = false;
	if (state.squatState === 'up' && angle < downThresh) {
	  	state.squatState = 'down';
	} else if (state.squatState === 'down' && angle > upThresh) {
		state.squatState = 'up';
		didCount = true;
	}
	return didCount;
}