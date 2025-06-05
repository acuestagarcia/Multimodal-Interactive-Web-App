const fs = require('fs').promises;
const path = require('path');
const USER_ROUTINES_FILE = path.join(__dirname, '../Databases/userRoutinesFile.json');
const ROUTINES_FILE = path.join(__dirname, '../Databases/routines.json');

//Función para obtener todas las rutinas disponibles
async function getRoutines(userId) {
    try {
        const raw = await fs.readFile(ROUTINES_FILE, 'utf-8');
        const defs = JSON.parse(raw);
        return { success: true, data: defs };
    } catch (e) {
        console.error("Error leyendo routines.json:", e);
        return { success: false, error: "Error accediendo a rutinas globales." };
    }
}  

//Función para obtener una rutina en concreto
async function getRoutine(routineName, routineGroup) {
    try{
        const Filedata = await fs.readFile(ROUTINES_FILE, 'utf-8');
        const routineList = JSON.parse(Filedata);
        
        const routinesOfGroup = routineList[routineGroup];
        if (!routinesOfGroup) {
            console.error(`No hay rutinas del tipo "${routineType}".`);
            return null;
        }

        const foundRoutine = routinesOfGroup.find(routine => routine.name === routineName);
        if (!foundRoutine) {
            console.error(`Rutina llamada "${routineName}" no existe dentro del tipo "${routineGroup}".`);
            return null;
        }

        return foundRoutine;
    } catch (error) {
        return null;
    }
}

// Función para guardar en el JSON file
async function saveUserRoutines(data) {
    const { userId, routineName, routineGroup } = data; 
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
        console.error(`Llamada inválida a saveUserRoutines: falta userId o es inválido: ${userId}`);
        return { success: false, error: 'userId inválido o faltante' };
    }
    if (!routineName || typeof routineName !== 'string' || !routineName.trim()) {
        console.error(`Llamada inválida a saveUserRoutines: falta routineName o es inválido: ${routineName}`);
        return { success: false, error: 'routineName inválido o faltante' };
    }
    if (!routineGroup || typeof routineGroup !== 'string' || !routineGroup.trim()) {
        console.error(`Llamada inválida a saveUserRoutines: falta routineGroup o es inválido: ${routineGroup}`);
        return { success: false, error: 'routineGroup inválido o faltante' };
    }

    try {
        const Filedata = await fs.readFile(USER_ROUTINES_FILE, 'utf-8');
        const usersRoutines = JSON.parse(Filedata);

        let routine = await getRoutine(routineName, routineGroup);
        if (!routine){
            console.error("Error guardando la rutina de un usuario no se ha encontrado dicha rutina");
            return { success: false, error: "Error guardando la rutina de un usuario: no se ha encontrado dicha rutina" }; 
        }
        routine['numberExercisesCompleted'] = 0;

        usersRoutines[userId] = routine;
        await fs.writeFile(USER_ROUTINES_FILE, JSON.stringify(usersRoutines, null, 2), 'utf-8');
        return { success: true, data: routine };
    } catch (error) {
        console.error("Error guardando la rutina de un usuario:", error.message);
        return { success: false, error: "Error guardando la rutina de un usuario" }; 
    }
}

//Función para obtener la rutina en curso de un usuario
async function getUserRoutine(userId) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
        console.error(`Llamada inválida a getUserRoutine: falta userId o es inválido: ${userId}`);
        return { success: false, error: 'userId inválido o faltante' };
    }
    try{
        const Filedata = await fs.readFile(USER_ROUTINES_FILE, 'utf-8');
        const routineList = JSON.parse(Filedata);
        
        if (!routineList[userId]){
            console.error('Error obteniendo la rutina de un usuario: el usuario no existe');
            return { success: false, error: "El usuario del que se ha intentado obtener una rutina no existe" }; 
        }

        const routine = routineList[userId];
        if (!routine) {
            console.error(`No hay rutina registrada para el usuario "${userId}".`);
            return { success: false, error: 'No hay rutina registrada para el usuario' };
        }

        return { success: true, data: routine};
    } catch (error) {
        console.error("Error obteniendo la rutina de un usuario:", error.message);
        return { success: false, error: "Error obteniendo la rutina de un usuario" }; 
    }
}

// Función para obtener siguiente ejercicio
async function getNextExercise(userId) {
    try {
        const raw = await fs.readFile(USER_ROUTINES_FILE, 'utf-8');
        const all  = JSON.parse(raw);
        const entry = all[userId];
        if (!entry) {
            return { success:false, error: "No routine found for user." };
        }
        // usa el campo numberExercisesCompleted como índice
        const idx = entry.numberExercisesCompleted || 0;
        if (idx >= entry.exercises.length) {
            return { success:true, message: "Routine completed!" };
        }
        const nextExercise = entry.exercises[idx];
        // avanza el contador
        entry.numberExercisesCompleted = idx + 1;
        await fs.writeFile(USER_ROUTINES_FILE, JSON.stringify(all,null,2), 'utf-8');
        return { success:true, data: { nextExercise, exerciseIndex: idx} };
    } catch(err) {
        console.error("Error getting next exercise:", err);
        return { success:false, error: "Error accessing routine data." };
    }
}

module.exports = { getRoutines,
                saveUserRoutines,
                getUserRoutine,
                getNextExercise
            };
