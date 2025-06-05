// src/handlers/socketHandler.js
const connectedScreens = new Map(); // Asocia screenId -> socket
// Asocia userId -> socket de móvil autenticado
const connectedUsers = new Map();

const fs = require('fs').promises; 

// Importar las funciones necesarias de otros ficheros
const { getRoutines, saveUserRoutines, getUserRoutine, getNextExercise } = require('./routineHandler');
// Login y Registro 
const { addCredentials, checkCredentials } = require('./credentialHandler');	
const { addToStat, seeStats, addFriend, deleteFriend, getFriendsList}  = require('./socialHandler');

const userStateFile = 'src/Databases/userStateFile.json'; // Persiste info temporal de la conexión
let userStates = {}; // Clave: socket.id, Valor: { id: socket.id, screenId: null }
loadUserStates()

// Función mejorada que puede enviar a ambos dispositivos
function broadcastToSession(io, screenId, userId, event, data) {
	// Emitir a la sala (que incluye la pantalla y posiblemente otros móviles conectados)
	io.to(screenId).emit(event, data);
	
	// Si tenemos el userId, también enviamos directamente al usuario específico
	// (útil si el móvil no está en la sala pero necesita el mensaje)
	if (userId && connectedUsers.has(userId)) {
	  connectedUsers.get(userId).emit(event, data);
	}
}

function handleSocketConnection(io) {
	io.on('connection', (socket) => {
		console.log(`Cliente conectado inicialmente con socket.id: ${socket.id}`);

		// --- RELACIONADOS CON EL REGISTRO E INICIO DE SESIÓN --- 

		// Listener para el mensaje de identificación del cliente 
		socket.on('authenticate', async ({ userId }) => {
		  // Validación básica
		  if (!userId) {
		    socket.emit('authenticated', { success: false, error: 'Falta userId' });
		    return;
		  }

		  // Guarda la referencia del socket para este usuario
		  connectedUsers.set(userId, socket);
		  // Persistir estado de conexión
		  userStates[userId] = userStates[userId] || {};
		  userStates[userId].socketId = socket.id;
		  await saveUserStates();

		  // Únete a una sala privada del usuario
		  socket.join(`user_${userId}`);
		  console.log(`Usuario autenticado: ${userId} con socket ${socket.id}`);
		  // Confirma al cliente la autenticación
		  socket.emit('authenticated', { success: true, userId });
		});

		// Registro de Pantallas (Gym Screens) 
		socket.on('register_screen', (data) => {
			const screenId = data.screenId;
			if (screenId) {
				console.log(`Pantalla registrada: ${screenId} con socket ${socket.id}`);
				connectedScreens.set(screenId, socket); // Guardar referencia
				socket.join(screenId); // Unirse a una sala con su propio ID
			} else {
				console.warn(`Intento de registro de pantalla sin screenId desde socket ${socket.id}`);
			}
		});

		// Inicio de sesión de usuarios
		socket.on('login', async ({ username, password, type }) => {
			const ok = await checkCredentials(username, password, type);
			if (ok === 1) {
				socket.emit('successful_login', { username, type });
			} else {
				socket.emit('failed_login', { code: ok });
			}
		});

		// Conexión del móvil a una pantalla
		socket.on('connect_screen', (data) => {
			const { userId, screenId } = data;
			const gymSocket = connectedScreens.get(screenId);

			if (!gymSocket) {                          // monitor offline?
				socket.emit('response_connect_screen', { success: false, error:'Pantalla no disponible' });
				return;
			}

			// El móvil se une a la misma sala
			socket.join(screenId);  
			userStates[userId] = { 
				socketId: socket.id, 
				screenId: screenId,
				connectedAt: new Date().toISOString()
			};
			saveUserStates();

			// Informar a ambos de la conexión
			broadcastToSession(io, screenId, userId, 'response_connect_screen', { 
				success: true, 
				data: {
				userId,
				screenId,
				timestamp: new Date().toISOString()
				}
			});
		});

		// Registro de usuarios
		socket.on('register', async ({ username, password, type }) => {
			const r = await addCredentials(username, password, type);
			if (r === 1) socket.emit('successful_register');
			else socket.emit('failed_register', { code: r });
		});

		// --- RELACIONADOS CON LA RUTINA Y LOS EJERCICIOS ---

		//Para obtener todas las rutinas disponibles
		socket.on('ask_routine_list', async (data = {}) => {
			// data.userId vendrá si el cliente se lo pasa
			const result = await getRoutines(data.userId);
			socket.emit('get_routine_list', result);
		});
		
		//El usuario selecciona una rutina
		socket.on('select_routine', async (data) => { 
		 	const result = await saveUserRoutines(data);
			const { userId, screenId, routineName, routineGroup } = data;
			console.log(`Socket del móvil que ha pedido la rutina: ${socket.id}`);
			// Enviar la rutina a el móvil y la pantalla del gimnasio
			broadcastToSession(io, screenId, userId, 'response_selected_routine', result);
		});

		//Para obtener la rutina en curso de un usuario
		socket.on('ask_user_routine', async (data) => {
			const result = await getUserRoutine(data);
			socket.emit('get_user_routine', result);
		});

		socket.on('exercise_completed', async (data) => {
		  
			// 1) Obtenemos siguiente ejercicio y stats
			const next  = await getNextExercise(data.userId);
			const stats = await addToStat(data.userId);
		  
			const { userId, screenId } = data;
			// 2) Emitimos a el móvil y la pantalla del gimnasio
			broadcastToSession(io, screenId, userId, 'response_exercise_completed', next);
		});

        // --- PAUSA DE RUTINA DESDE EL MÓVIL ------------------------------
        socket.on('shake', () => {
            // Intentamos averiguar a qué pantalla está vinculado este móvil
            let screenId = null;
            let userId   = null;

            // Revisamos userStates para encontrar la coincidencia socketId → screenId
            for (const [uid, state] of Object.entries(userStates)) {
                if (state.socketId === socket.id) {
                    screenId = state.screenId;
                    userId   = uid;
                    break;
                }
            }

            if (!screenId) {
                console.warn(`Shake recibido pero no se pudo determinar screenId para socket ${socket.id}`);
                return;
            }

            console.log(`Shake recibido de usuario ${userId}. Enviando 'pause_routine' a pantalla ${screenId}`);
            // Enviamos a la pantalla (y de paso al propio móvil) la orden de pausar
            broadcastToSession(io, screenId, userId, 'shake', { by: userId });
        });

        // --- RUTINA · COMANDOS DE VOZ -----------------------------------
        socket.on('pause_routine', (data = {}) => {
            const { userId, screenId } = data;
            if (!screenId) return;
            console.log(`Voz: pausa rutina en pantalla ${screenId} (user ${userId})`);
            broadcastToSession(io, screenId, userId, 'pause_routine', { by: userId });
        });

        socket.on('continue_routine', (data = {}) => {
            const { userId, screenId } = data;
            if (!screenId) return;
            console.log(`Voz: continuar rutina en pantalla ${screenId} (user ${userId})`);
            broadcastToSession(io, screenId, userId, 'continue_routine', { by: userId });
        });

        socket.on('end_routine', (data = {}) => {
            const { userId, screenId } = data;
            if (!screenId) return;
            console.log(`Voz: finalizar rutina en pantalla ${screenId} (user ${userId})`);
            broadcastToSession(io, screenId, userId, 'end_routine', { by: userId });
        });
		
		// --- RELACIONADOS CON LA RED SOCIAL, LOS AMIGOS Y EL MARCADOR ---
		
		//En caso que un usuario quisiese ver sus estadísticas
		socket.on('see_stats_friends', async (data) => {
			const completedExercisesFriends = [];
			for (const friend of data.friendsList){
				const completedExercises = await seeStats(friend);
				if (completedExercises.success){
					completedExercisesFriends.push ({friend: friend, score: completedExercises.data});
				}
			}
			socket.emit("completed_exercises_friends", completedExercisesFriends)
		}); 

		//Para agregar un usuario a la red de amigos
		socket.on('add_friend', async (data) => {
			const result = await addFriend(data)
			socket.emit('friend_added', result);
		});

		//Para borrar un amigo
		socket.on('delete_friend', async (data) => {
			const result = await deleteFriend(data)
			socket.emit('friend_deleted', result);
		});

		//Para obtener todos los amigos de un usuario
		socket.on('ask_friend_list', async ({ userId }) => {
			const result = await getFriendsList(userId)
			socket.emit('get_friend_list', result);
		});
	})
}

//  Función para cargar estados de conexión 
async function loadUserStates() {
  try {
        // Comprueba si el archivo existe primero
        await fs.access(userStateFile);
        const data = await fs.readFile(userStateFile, 'utf-8');
        // Evita Parse Error en archivo vacío
        if (data.trim() === '') {
            userStates = {};
        } else {
            userStates = JSON.parse(data);
        }
        console.log('Estados de conexión (userStates) cargados.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // El archivo no existe, inicializa vacío y crea el archivo
            console.log('userStateFile.json no encontrado, inicializando vacío.');
            userStates = {};
            await saveUserStates(); // Crea el archivo vacío
        } else {
            console.error("Error cargando userStates:", error.message);
            userStates = {}; // Default a vacío en otros errores
        }
    }
}

//  Función para guardar estados de conexión 
async function saveUserStates() {
    try {
        await fs.writeFile(userStateFile, JSON.stringify(userStates, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error guardando userStates:", error.message);
    }
}

module.exports = {
    handleSocketConnection,
};