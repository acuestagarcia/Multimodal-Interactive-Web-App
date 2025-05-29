const fs = require('fs').promises;
const path = require('path');
const SOCIAL_COMPETITION_FILE = path.join(__dirname, '../Databases/socialCompetition.json');
const FRIENDS_FILE = path.join(__dirname, '../Databases/userFriends.json');
const CREDENTIALS_FILE = path.join(__dirname, '../Databases/credentials.json');
let friendList = {}

async function addToStat(userId){
    try {
        const Filedata = await fs.readFile(SOCIAL_COMPETITION_FILE, 'utf-8');
        const completedExercises = JSON.parse(Filedata);
        if (!completedExercises[userId]) {
            completedExercises[userId] = 0;
        }
        // Sumar un ejercicio
        completedExercises[userId]++;
        await fs.writeFile(SOCIAL_COMPETITION_FILE, JSON.stringify(completedExercises, null, 4));
        return { success: true, data: completedExercises[userId] };
    }
    catch (error) {
        console.error('Error al marcar ejercicio como completado:', error);
        return { success: false, error: "Error al actualizar los ejercicios completados." };
    }
}

//En caso que un usuario quiesese ver sus estadísticas
async function seeStats(userId){
    try {
        const Filedata = await fs.readFile(SOCIAL_COMPETITION_FILE, 'utf-8');
        const completedExercises = JSON.parse(Filedata);
        if (!completedExercises[userId]) {
            return { success: false, error: "Error al obtener estadísticas: no se encontró el usuario" };
        }
        return { success: true, data: completedExercises[userId] };
    } catch (error){
        console.error(`Error al obtener estadísticas de "${userId}"`, error);
        return { success: false, error: "Error interno al obtener estadísticas" };
    }
}

//Para revisar si un usuario existe
async function checkUser(username, type) {
    try {
        const raw = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
        const creds = JSON.parse(raw);
        const key = type === 'Admin' ? 'Admins' : 'Users';
        if (!creds[key] || !creds[key][username]) {
            return -1;
        }
        return 1;
    } catch (e) {
        console.error('checkCredentials error:', e);
        return -1;
    }
}

//Para agregar un usuario a la red de amigos
async function addFriend(data){
    try{
        const Filedata = await fs.readFile(FRIENDS_FILE, 'utf-8');
        const friendList = JSON.parse(Filedata);
        if (!friendList[data.userId]) {
            friendList[data.userId] = [];
        }
        // Evitar añadir duplicados
        if ((!friendList[data.userId].includes(data.FriendId))) {
            if (await checkUser(data.FriendId) === 1){
                friendList[data.userId].push(data.FriendId);

                await fs.writeFile(FRIENDS_FILE, JSON.stringify(friendList, null, 4)); 
                return {success: true, data: data.FriendId}; 
            }
            else{
                console.log(`El usuario ${data.FriendId} no existe`);
                return {success: false, error: "El amigo no existe." }; 
            }
        } else {
            console.log(`El usuario ${data.FriendId} ya es amigo de ${data.userId}`);
            return {success: false, error: "Ya son amigos." };
        }
    } catch (error){
        console.error('Error al agregar amigo:', error);
        return {success: false, error: "Error interno al agregar amigo" };
    }
}

//Para borrar un amigo
async function deleteFriend(data){
    try{
        const Filedata = await fs.readFile(FRIENDS_FILE, 'utf-8');
        const friendList = JSON.parse(Filedata);
        if (!friendList[data.userId]) {
            console.log(`El usuario ${data.userId} no tiene amigos registrados`);
            return { error: "El usuario no tiene amigos registrados." };
        }
        if (await checkUser(data.FriendId) === 1){
            let index = friendList[data.userId].indexOf(data.FriendId);
            if (index !== -1) {
                friendList[data.userId].splice(index, 1);
                await fs.writeFile(FRIENDS_FILE, JSON.stringify(friendList, null, 4)); 
                return {success: true, data: data.FriendId}; 
            } else {
                console.log(`El usuario ${data.FriendId} no está en la lista`);
                return {success: false, error: "El amigo no estaba en la lista." };
            }
        }
        else{
            console.log(`El usuario ${data.FriendId} no existe`);
            return {success: false, error: "El amigo no existe." }; 
        }
    } catch (error){
        console.error('Error al eliminar amigo:', error);
        return {success: false, error: "Error interno al eliminar amigo" };
    }
}

//Para obtener la lista con los amigos de un usuario
async function getFriendsList(userId){
    try{
        const Filedata = await fs.readFile(FRIENDS_FILE, 'utf-8');
        const friendList = JSON.parse(Filedata);
        if (!friendList[userId]) {
            return { success: false, error: "El usuario no existe" }; 
        } else {
            return { success: true, data: friendList[userId] };  
        }
    } catch (error) {
        console.error('Error al obtener lista de amigos:', error);
        return { success: false, error: "Error al obtener lista de amigos" }; 
    }
}


module.exports = {
    addToStat,
    seeStats,
    addFriend,
    deleteFriend,
    getFriendsList,
};