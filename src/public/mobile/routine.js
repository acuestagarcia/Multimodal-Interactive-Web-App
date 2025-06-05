// src/public/mobile/routine.js
import { initShakeDetection } from '/public/mobile/shakeDetector.js';
import { initVoiceDetection, startVoiceRecognition } from '/public/mobile/voiceDetector.js';
(() => {
	// --- Autenticación ---
	const currentUserId = sessionStorage.getItem('fitGameUserId');
	if (!currentUserId) {
		// No ha iniciado sesión, redirigir a login
		window.location.href = 'login.html';
		return; // Parar ejecución del script
	}

	const dashboard     = document.getElementById('dashboard');
	const routineSelect = document.getElementById('routine-select');
	const screenConnect = document.getElementById('screen-connect');
	let currentWindow;

	// Helper para mostrar u ocultar vistas
	function showWindow(windowName) {
		const views = { dashboard, routineSelect, screenConnect };
		Object.values(views).forEach(v => v.classList.add('hidden'));
		views[windowName].classList.remove('hidden');
		currentWindow = windowName;
	}

	const socket = io();

	// Listener para confirmación de autenticación
	socket.on('authenticated', (response) => {
	  if (!response.success) {
	    alert(`Error de autenticación: ${response.error}`);
	    window.location.href = 'login.html';
	    return;
	  }
	  
      // Inicializar APIs del móvil (migrado desde mobileApis.js)
      initShakeDetection(socket);
      initVoiceDetection(socket);

		// 1) Decidir vista
		const screen = sessionStorage.getItem('currentScreen');
		const routine = sessionStorage.getItem('currentRoutine');
		const nextView = !screen ? 'screenConnect' : !routine ? 'routineSelect' : 'dashboard';
		showWindow(nextView);

		// 2) Inicializar datos
		if (nextView === 'dashboard') handleDashboard();
		else if (nextView === 'routineSelect') handleRoutineSelect();
		else handleScreenConnect();
	});

	// --- SELECCIÓN DE RUTINA ---
	// Obtener rutinas disponibles para cada grupo y los ejercicios de los que se compone cada rutina (routines.json)
	
	function handleRoutineSelect(){
		const routineCards = document.getElementById('routineCards');

		socket.emit('ask_routine_list');
		socket.on('get_routine_list', (routinesObject) => {
			if (routinesObject.success){
				const routinesList = routinesObject.data;
				routineFilter.innerHTML = '<option value="">Todos los grupos</option>';
				routineCards.innerHTML = '';
				for (const routineGroup in routinesList){
					const routineGroupElem = document.createElement('option');
					routineGroupElem.textContent = routineGroup;
					routineFilter.appendChild(routineGroupElem);
	
					const routines = routinesList[routineGroup];
					for (const routine of routines){
	
						const routineCard = document.createElement('div');
						routineCard.classList.add("card");
						routineCard.classList.add("routine-card");
						routineCard.classList.add(routineGroup);
						routineCard.classList.add("hidden");
	
						const titleEl = document.createElement('h3');
						titleEl.textContent = routine.name;
						titleEl.classList.add('routine-title');
						routineCard.appendChild(titleEl);
						
						for (const routineExercise of routine.exercises){
							const routineExerciseElem = document.createElement('p');
							routineExerciseElem.textContent = routineExercise.name;
							routineCard.appendChild(routineExerciseElem);
						}
	
						routineCards.appendChild(routineCard);
	
						// Añadir listener para seleccionar esta rutina
						routineCard.addEventListener('click', () => {
							const currentRoutineName = routineCard.querySelector('h3').textContent;
							sessionStorage.setItem('currentRoutine', currentRoutineName);

							// Ir a la selección de pantalla
							showWindow('dashboard');
							const currentScreenId = sessionStorage.getItem('currentScreen');
							socket.emit('select_routine', {userId: currentUserId, screenId: currentScreenId, routineName : currentRoutineName, routineGroup: routineGroup});
							socket.once('response_selected_routine', (response) => {
								if (!response.success){
									alert(response.error);
								}
								handleDashboard();
							})
						});
					}
				}
			} else{
				alert(routinesObject.error);
			}
		});

		const routineFilter = document.getElementById('routineFilter');

		// Obtener rutinas de un determinado grupo
		routineFilter.addEventListener('change', () => {
			const group = routineFilter.value; 
			Array.from(routineCards.children).forEach(card => {
			if (!group || card.classList.contains(group)) {
				card.classList.remove('hidden');
			} else {
				card.classList.add('hidden');
			}
			});
		});
	
	}

	// --- SELECCIÓN DE PANTALLA ---
	function handleScreenConnect(){
		const connectBtn = document.getElementById('connectScreenBtn');
		const screenIdInput = document.getElementById('screenIdInput');
		connectBtn.addEventListener('click', () => {
			const screenId = screenIdInput.value.trim();
			if (!screenId) {
				alert('Por favor, introduce un ID de pantalla.');
				return;
			}
			socket.emit('connect_screen', { userId: currentUserId, screenId });
			socket.once('response_connect_screen', (response) => {
				if (!response.success){
					alert(response.error);
				}
				else{
					sessionStorage.setItem('currentScreen', screenId);
					showWindow('routineSelect');
					handleRoutineSelect();
				}
			})
		});
	}

function completedExerciseRefreshUI(btn, exerciseIndex){
	// Actualiza la barra de progreso
	const newProgress = (33 * (exerciseIndex + 1)) === 99 ? 100 : 33 * (exerciseIndex + 1);
	document.getElementById('routineHeader').style.setProperty('--progress', newProgress + '%');

	// Oculta el botón actual y muestra el siguiente
	if (btn){
		btn.classList.add('hidden');
		if (btn.id[3] != 3){
			const btnNumber = parseInt(btn.id.replace('btn', ''), 10);
			const nextBtn = document.getElementById('btn' + (btnNumber + 1));
			if (nextBtn) nextBtn.classList.remove('hidden');
		}
	}
}

	// --- GESTIÓN DE RUTINA (DASHBOARD PRINCIPAL) ---
	// Obtener rutina actual del usuario

	function handleDashboard(){
		socket.emit('ask_user_routine', currentUserId);
		socket.on('get_user_routine', (routineObject) => {
			if (routineObject.success) {
				const routine = routineObject.data;

				// Actualizar header
				const titleEl = document.querySelector('#routineHeader .routine-title');
				titleEl.textContent = routine.name;
				const progressValue = (33 * routine.numberExercisesCompleted) === 99 ? 100 : 33 * routine.numberExercisesCompleted;
				document.getElementById('routineHeader').style.setProperty('--progress', progressValue + '%');

				// Crear ejercicios
				const exerciseList = document.getElementById('exerciseList');
				exerciseList.innerHTML = '';
				const template = document.getElementById('exercise-template');
				routine.exercises.forEach((exercise, i) => {
					const clone = template.content.cloneNode(true);
					clone.querySelector('.exercise-title').textContent = exercise.name;
					clone.querySelector('.sets').textContent = 'Sets: ' + exercise.sets;
					clone.querySelector('.reps').textContent = 'Repeticiones: ' + exercise.reps;
					const btn = clone.querySelector('button');
					btn.id = 'btn' + (i+1);
					btn.addEventListener('click', () => {
						completedExerciseRefreshUI(btn, i);
						const currentScreenId = sessionStorage.getItem('currentScreen');
						socket.emit('exercise_completed', { userId: currentUserId, screenId: currentScreenId});
					});
					exerciseList.appendChild(clone);
				});

				if (routine.numberExercisesCompleted < 3){
					const currentBtn = document.getElementById('btn' + (routine.numberExercisesCompleted + 1));
					currentBtn.classList.remove('hidden');
				}
			} else {
				alert(routineObject.error);
			}	
		});

		socket.on('response_exercise_completed', (response) => {
			if (!response.success){
				alert(response.error);
			}
			// Parchear la UI según el ejercicio que devuelva el servidor
			// El servidor debe enviarnos la posición (0‑based) del ejercicio completado
			const exerciseIndex = response.data.exerciseIndex;
			const btn = document.getElementById('btn' + (exerciseIndex + 1));
			completedExerciseRefreshUI(btn, exerciseIndex);
		})

		const btnFinish = document.getElementById('btnFinish');

		// “Terminar rutina” → elegir nueva
		btnFinish.addEventListener('click', () => {
			const currentScreenId = sessionStorage.getItem('currentScreen');
			// comunicar a la pantalla del gimnasio que también tiene que terminar la rutina
			socket.emit('end_routine', { userId: currentUserId, screenId: currentScreenId });
			// Borrar la rutina y pantalla actual de la sesión
			sessionStorage.removeItem('currentRoutine');
			sessionStorage.removeItem('currentScreen');
			showWindow('screenConnect');
			handleScreenConnect();
		});

	}

	// Agrega un botón para iniciar el reconocimiento de voz
	const voiceButton = document.getElementById('voiceButton');
	// Evento para iniciar el reconocimiento de voz al hacer clic en el botón
	voiceButton.addEventListener('click', () => {
		startVoiceRecognition();
	});

	// --- Mandar identificación de usuario al cliente ---
	socket.on('connect', () => {
		socket.emit('authenticate', { userId: currentUserId });
	});
})();