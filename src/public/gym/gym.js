// src/public/gym/gym.js
import { initDetection } from './detectionController.js';

/* ───────────────────────── funciones helper ───────────────────────── */
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function showToast(msg, ok = true) {
  const box = document.createElement('div');
  box.className = 'toast';
  box.textContent = msg;
  if (!ok) box.style.background = '#e53935';
  document.body.append(box);
  setTimeout(() => box.remove(), 4_000);
}

/* ───────────────────────── constantes ──────────────────────── */
const SCREEN_ID = 'GYM01';
const EXERCISE_CODE = {
  Flexiones:   'pushups',
  Dominadas:   'pullups',
  Dips:        'dips',
  Sentadillas: 'squats',
};

/* ───────────────────────── referencias al DOM ───────────────────────── */
const greetingEl           = document.getElementById('greeting');
const routineNameEl        = document.getElementById('currentRoutineName');
const currentExerciseEl    = document.getElementById('currentExercise');
const nextExerciseEl       = document.getElementById('nextExercise');
const repCountEl           = document.getElementById('repCount');
const setTimerDisplayEl    = document.getElementById('setTimerDisplay');
const restTimerDisplayEl   = document.getElementById('restTimerDisplay');
const videoEl              = document.getElementById('video');
const canvas               = document.getElementById('canvas');

/* ───────────────────────── estado ──────────────────────────── */
const socket               = io();
let   currentUserId        = null;
let   currentRoutine       = null;
let   currentExercises     = [];
let   currentExerciseIdx   = 0;
let   timerSetDur          = 0;
let   timerRestDur         = 0;
let   controller           = null;
let   paused               = false;

/* ───────────────────────── refrescar la rutina ─────────────────────── */
function refreshRoutineUI() {
	if (!currentRoutine) return;
  
	routineNameEl.textContent = currentRoutine.name;
  
	const curr = currentRoutine.exercises[currentExerciseIdx] ?? null;
	currentExerciseEl.textContent = curr ? `Actual: ${curr.name}` : 'Actual: –';

	const next = currentRoutine.exercises[currentExerciseIdx + 1] ?? null;
	nextExerciseEl.textContent = next ? `Próximo: ${next.name}` : 'Próximo: –';

	if (curr) {
	  repCountEl.textContent = `Reps 0/${curr.reps} • Set 0/${curr.sets}`;

	  setTimerDisplayEl.textContent  = formatTime(currentRoutine.timerSet);
	  restTimerDisplayEl.textContent = formatTime(currentRoutine.timerRest);

	  timerSetDur  = currentRoutine.timerSet;
	  timerRestDur = currentRoutine.timerRest;
	} else {
	  // No hay ejercicio actual -> limpiamos contadores y temporizadores
	  repCountEl.textContent        = '';
	  setTimerDisplayEl.textContent = '--:--';
	  restTimerDisplayEl.textContent= '--:--';
	}
}

  /* ───────────────────────── empezar el reconocimiento de postura ──────────────────── */
async function startDetectionSession() {
	if (!controller) {
	  controller = await initDetection({
		videoEl,
		canvas,
		repCountEl,
		showToast,
		timerSetDur,
		timerDisplayEl: setTimerDisplayEl,
		timerRestDur,
		restDisplayEl: restTimerDisplayEl,
		onSetComplete,
		onRestComplete,
		onExerciseCompleted,
		onHandPauseToggle,
		onSkipRest,
	  });
	}
	const curr = currentRoutine.exercises[currentExerciseIdx];
	controller.setExerciseType(EXERCISE_CODE[curr.name]);
	controller.setTargets(curr.sets, curr.reps);
	await controller.start();
}

/* ───────────────────────── sockets ────────────────────────── */
socket.emit('register_screen', { screenId: SCREEN_ID });

socket.on('response_connect_screen', ({ success, data, error }) => {
  if (!success) { showToast(error || 'Error de conexión', false); return; }
  currentUserId = data.userId;
  greetingEl.textContent = `Conectado con ${currentUserId}`;
});

socket.on('response_selected_routine', async ({ success, data, error }) => {
  if (!success) { showToast(error || 'Error al cargar la rutina', false); return; }
  currentRoutine     = data;
  currentExerciseIdx = currentRoutine.numberExercisesCompleted ?? 0;
  currentExercises   =  currentRoutine.exercises;
  refreshRoutineUI();
  await startDetectionSession();          // arranca cámara + detección
});

socket.on('response_exercise_completed', ({ success, data, error }) => {
  console.log("He llegado");
  if (!success) return;

  currentExerciseIdx++;

  refreshRoutineUI();

  const curr = currentExercises[currentExerciseIdx];

  // Si ya no quedan más ejercicios, mostramos mensaje y salimos
  if (!curr) {
    showToast('✅ Rutina terminada');
    controller?.stop();         // detiene cámara, detección y temporizadores
    paused = false;             // por si estaba en pausa
    return;
  }

  if (controller) {
    controller.setExerciseType(EXERCISE_CODE[curr.name]);
    controller.setTargets(curr.sets, curr.reps);
  }

  showToast(`🔜 Ahora: ${curr.name} — ${curr.sets}×${curr.reps}`);
});

socket.on('shake', () => {
  if (!controller) return;        // nada que controlar
  if (!paused) {
    controller.pause();
    paused = true;
    showToast('⏸ Rutina pausada por el móvil');
  } else {
    controller.resume();
    paused = false;
    showToast('▶️ Rutina reanudada');
  }
});

socket.on('pause_routine', () => {
  if (!controller || paused) return;
  controller.pause();
  paused = true;
  showToast('⏸ Rutina pausada (voz)');
});

socket.on('continue_routine', () => {
  if (!controller || !paused) return;
  controller.resume();
  paused = false;
  showToast('▶️ Rutina reanudada (voz)');
});

socket.on('end_routine', () => {
  if (!controller) return;
  controller.stop();
  paused = false;
  currentRoutine     = null;
  currentExerciseIdx = 0;
  currentExercises   = [];
  refreshRoutineUI();
  showToast('🏁 Rutina finalizada');
});

/* ─────────────── detection callbacks & helpers ────────────── */
function onSetComplete() {
  showToast('🔔 Set terminado, empieza descanso');
  controller?.startRestTimer();
}

function onRestComplete() {
  showToast('🔔 Descanso acabado, de vuelta al set');
  controller?.startSetTimer();
}

function onExerciseCompleted() {
  socket.emit('exercise_completed', { userId: currentUserId, screenId: SCREEN_ID });
}

function onHandPauseToggle() {
  if (!controller) return;
  if (!paused) controller.pause();
  else         controller.resume();
  paused = !paused;
}

function onSkipRest() {
  if (!controller) return;
  controller.clearRestTimer();
  controller._exitRest();
  controller.startSetTimer();
  showToast('⏭ Descanso saltado');
}
