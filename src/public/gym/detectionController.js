// src/public/gym/detectionController.js
import { loadPoseDetector, smoothLandmarks, drawSkeleton, detectByTorso, detectDipTransitionAngle, detectPullUps, detectSquats } from './poseDetector.js';
import { loadHandDetector, drawHands, detectHandPattern, countExtendedFingers} from './handController.js';

export async function initDetection({
	videoEl, canvas,
	repCountEl, showToast, 
	timerSetDur, timerDisplayEl,
	timerRestDur, restDisplayEl,          
	onSetComplete, onRestComplete,       
	onExerciseCompleted,
	onHandPauseToggle,
	onSkipRest
}){
    const ctx       = canvas.getContext('2d');
    // Duraciones iniciales (en segundos) recibidas desde gym.js
    const initialSetDuration  = timerSetDur  ?? 0;
    const initialRestDuration = timerRestDur ?? 0;
	let exerciseType = null;
	function setExerciseType(type) {
	  	exerciseType = type;
	}
	// 1) Estado para TODOS los ejercicios
	const state = {
		// contador único
		repCount: 0,
		// sets
		currentSet:     	1,
    	targetReps:     	0,
    	targetSets:     	0,
		// flags internos para los detectores
		lastTorsoDown:    	false,
		lastDipDownAngle:	false,
		pullUpState:     	'down',
		ready:           	false,
		upHoldStart:     	null,
		lmBuffer:        	[],
		squatState:      	'up',
		squatBuffer:     	[],
		// mano
		stateprevExt5: 		false,
		prevExt1: 			false
	};
	const detector  = await loadPoseDetector();
	const handDet  = await loadHandDetector();
	let rafId       = null;
	let lastTimestamp = 0;
	let isResting = false;
	let isPaused = false;
	let pausedSet = null;
	let pausedRest = null;
	/* ============================ Contador de tiempo ============================ */
	function formatTime(sec) {
		const m = String(Math.floor(sec/60)).padStart(2,'0');
		const s = String(sec%60).padStart(2,'0');
		return `${m}:${s}`;
	}
	let setTimerInterval = null;
  	let restTimerInterval = null;
	function clearSetTimer()   { if (setTimerInterval) clearInterval(setTimerInterval); }
	function clearRestTimer()  { if (restTimerInterval) clearInterval(restTimerInterval); }

	function startSetTimer(remaining = initialSetDuration) {
	    clearRestTimer();
	    clearSetTimer();

	    timerDisplayEl.textContent = formatTime(remaining);

	    setTimerInterval = setInterval(() => {
	        remaining--;
	        timerDisplayEl.textContent = formatTime(Math.max(0, remaining));
	        if (remaining <= 0) {
	            clearSetTimer();
	            onSetComplete?.();            // el set ha expirado
	        }
	    }, 1000);
	}

	function startRestTimer(remaining = initialRestDuration) {
	    isResting = true;
	    clearSetTimer();
	    clearRestTimer();

	    restDisplayEl.textContent = formatTime(remaining);

	    restTimerInterval = setInterval(() => {
	        remaining--;
	        restDisplayEl.textContent = formatTime(Math.max(0, remaining));
	        if (remaining <= 0) {
	            clearRestTimer();
	            isResting = false;
	            onRestComplete?.();           // descanso terminado
	            startSetTimer();              // volvemos al set
	        }
	    }, 1000);
	}
	// Detiene temporizadores y loop
	function pause() {
		if (isPaused) return;
		isPaused = true;
		// guardo restantes
		pausedSet  = parseTimeToSec(timerDisplayEl.textContent);
		pausedRest = parseTimeToSec(restDisplayEl.textContent);
		clearSetTimer();
		clearRestTimer();
		cancelAnimationFrame(rafId);
	}
	// Reanuda según donde estuvieras
	function resume() {
	    if (!isPaused) return;
	    isPaused = false;

	    if (isResting) {
	        startRestTimer(pausedRest);  // reanuda descanso
	    } else {
	        startSetTimer(pausedSet);    // reanuda set
	    }

	    // y volvemos a arrancar detección
	    rafId = requestAnimationFrame(processFrame);
	}
	// Helper para convertir "MM:SS" → segs
	function parseTimeToSec(mmss) {
		const [m,s] = mmss.split(':').map(Number);
		return m*60 + s;
	}
	/* ============================ ============================ ============================ */
	/* ============================ reps x sets ============================ */
	// setTargets: exposible al exterior
	function setTargets(sets, reps) {
		state.targetSets  = sets;
		state.targetReps  = reps;
		state.currentSet  = 1;
		state.repCount    = 0;
		// inicia cuenta atrás
		startSetTimer();
		repCountEl.textContent =
			`Reps ${state.repCount}/${state.targetReps} • ` +
			`Set ${state.currentSet}/${state.targetSets}`;
	}
	// Función auxiliar para resetear TODO el estado
	function resetState() {
		state.repCount           = 0;
		state.currentSet         = 1;
		state.lastTorsoDown      = false;
		state.lastDipDownAngle   = false;
		state.pullUpState        = 'down';
		state.ready              = false;
		state.upHoldStart        = null;
		state.lmBuffer.length    = 0;
		state.squatState         = 'up';
		state.squatBuffer.length = 0;
		state.prevExt5 			 = false,
		state.prevExt1 			 = false
		repCountEl.textContent   = '';
	}
	// Exponer setTargets al exterior
	window.__detectionController__ = { setTargets };
	/* ============================ ============================ ============================ */
	/* ============================ Detección de pose ============================ */
    async function startCamera() {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		videoEl.srcObject = stream;
		await new Promise(r=>videoEl.onloadedmetadata=r);
		await videoEl.play();
		startDetection();
	}

    function stopCamera() {
		if (videoEl.srcObject) {
			videoEl.srcObject.getTracks().forEach(t => t.stop());
			videoEl.srcObject = null;
		}
	}

     // 2) Resetea TODO al arrancar detección
	function startDetection() {
		// Cancelamos cualquier loop anterior
		if (rafId) cancelAnimationFrame(rafId);
		resetState();		// <-- limpia TODOS los contadores y buffers
        // Arranca el temporizador del set la primera vez que iniciamos detección
        if (!setTimerInterval) {
            startSetTimer();
        }
		// Aseguramos que el vídeo está listo
		rafId = requestAnimationFrame(processFrame);
	}
	async function processFrame(time) {
		if (!videoEl.videoWidth) {
			rafId = requestAnimationFrame(processFrame);
			return;
		}
		// 1) convertimos a microsegundos ...
		let ts = Math.round(time * 1000);
		// 2) forzamos monotonicidad estricta
		if (ts <= lastTimestamp) ts = lastTimestamp + 1;
		lastTimestamp = ts;
		const res = detector.detectForVideo(videoEl, ts);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	
		if (res.landmarks?.length) {
			// suavizado
			state.lmBuffer.push(res.landmarks[0]);
			if (state.lmBuffer.length > 5) state.lmBuffer.shift();
			const lm = smoothLandmarks(state.lmBuffer);
			drawSkeleton(ctx, lm, canvas.width, canvas.height);
		
			// mano
			const hr = await handDet.detectForVideo(videoEl, ts);
			if (hr.landmarks && hr.landmarks.length > 0) {
				drawHands(ctx, hr.landmarks, canvas.width, canvas.height);
				// 2) Highlight: vuelve a dibujar la mano "0" en verde
				const ctrl = hr.landmarks[0];
				ctx.save();
				ctx.strokeStyle = '#0f0';
				ctx.fillStyle   = '#f00';
				ctx.lineWidth   = 3;
				// conexiones (igual que en drawHands)
				const conns = [
					[0,1],[1,2],[2,3],[3,4],
					[0,5],[5,6],[6,7],[7,8],
					[0,9],[9,10],[10,11],[11,12],
					[0,13],[13,14],[14,15],[15,16],
					[0,17],[17,18],[18,19],[19,20]
				];
				for (const [i,j] of conns) {
					const a = ctrl[i], b = ctrl[j];
					ctx.beginPath();
					ctx.moveTo(a.x*canvas.width, a.y*canvas.height);
					ctx.lineTo(b.x*canvas.width, b.y*canvas.height);
					ctx.stroke();
				}
				// puntos
				for (const p of ctrl) {
					ctx.beginPath();
					ctx.arc(p.x*canvas.width, p.y*canvas.height, 5, 0, 2*Math.PI);
					ctx.fill();
				}
				ctx.restore();
				const extCount = countExtendedFingers(ctrl);
				// 5 dedos → pausa/continúa
				if (extCount === 5 && !state.prevExt5) {
					onHandPauseToggle?.();
				}
				state.prevExt5 = (extCount === 5);

				// 1 dedo → skip descanso
				if (extCount === 1 && !state.prevExt1) {
					onSkipRest?.();
				}
				state.prevExt1 = (extCount === 1);
			}
			// elige detector según ejercicio
			let didCount = false;
			switch (exerciseType) {
				case 'pushups':
					didCount = detectByTorso(lm, state);
					break;
				case 'dips':
					didCount = detectDipTransitionAngle(lm, state);
					break;
				case 'pullups':
					didCount = detectPullUps(lm, state);
					break;
				case 'squats':
					didCount = detectSquats(lm, state);
					break;
			}
		
			if (didCount && !isResting) {
				state.repCount++;
		
				// Cuando alcanzas las reps objetivo…
				if (state.repCount >= state.targetReps) {
					clearSetTimer();      // para el timer de set
					state.repCount = 0;
					const finishedSet = state.currentSet;
					state.currentSet++;
					showToast(`✅ Has completado el set ${state.currentSet - 1}/${state.targetSets}`);
					onSetComplete?.(finishedSet);
					startRestTimer();
					// Si ya no quedan más sets, notificamos
					if (state.currentSet > state.targetSets) {
						onExerciseCompleted?.();
					}
				}
		
				// Actualiza el contador en pantalla
				repCountEl.textContent =
					`Reps ${state.repCount}/${state.targetReps} • ` +
					`Set ${Math.min(state.currentSet, state.targetSets)}/${state.targetSets}`;
			}
		}
		
		rafId = requestAnimationFrame(processFrame);
	}
	/* ============================ ============================ ============================ */
	return {
		start: async () => {
			await startCamera();          // siempre cámara
		},
		stop: () => {
			cancelAnimationFrame(rafId);
			clearSetTimer(); clearRestTimer();
		},
		setTargets,
		startSetTimer,
		startRestTimer,
		clearRestTimer,
		setExerciseType,
		pause,
		resume,
		_exitRest: () => { isResting = false; }
	};
}
