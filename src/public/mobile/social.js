// src/public/mobile/social.js
(() => {
	// --- Autenticación ---
	const currentUserId = sessionStorage.getItem('fitGameUserId');
	if (!currentUserId) {
		// No ha iniciado sesión, redirigir a login
		window.location.href = 'login.html';
		return; // Parar ejecución del script
	}

	const socket = io();


    // --- Elementos del DOM ---
    const friendsDiv = document.getElementById('friendList');
    const scoreboard = document.getElementById('scoreboard');
    const btnAddFriend = document.getElementById('btnAddFriend');
    const btnDelFriend = document.getElementById('btnDeleteFriend');

    // --- Funciones Auxiliares ---
    const updateFriendListUI = (friends) => {
        friendsDiv.innerHTML = ''; // Limpiar lista actual
        for (const friend of friends) {
            const friendElem = document.createElement('div');
            friendElem.classList.add('friend');
            friendElem.textContent = friend;
            friendsDiv.appendChild(friendElem);
        }
    };

    const updateScoreboardUI = (completedExercisesFriends) => {
        scoreboard.innerHTML = ''; // Limpiar marcador actual
        // Ordenar a los amigos por puntuación de mayor a menor
        completedExercisesFriends.sort((a, b) => b.score - a.score);
        // Añadir a los amigos al marcador
        for (const friendAndScore of completedExercisesFriends) {
            const friendScoreDiv = document.createElement('div');
            friendScoreDiv.classList.add('card');

            const friendElem = document.createElement('div');
            friendElem.classList.add('friend');
            friendElem.textContent = friendAndScore.friend;

            const scoreElem = document.createElement('div');
            scoreElem.classList.add('score');
            scoreElem.textContent = friendAndScore.score;

            friendScoreDiv.appendChild(friendElem);
            friendScoreDiv.appendChild(scoreElem);

            scoreboard.appendChild(friendScoreDiv);
        }
    };

    const fetchFriendsAndScores = () => {
        socket.emit('ask_friend_list', { userId: currentUserId });
    };

    socket.on('authenticated', (response) => {
        if (!response.success) {
            alert(`Error de autenticación: ${response.error}`);
            window.location.href = 'login.html';
            return;
        }
        // Solicitar datos iniciales al conectar e identificar
        fetchFriendsAndScores();
    });

    // --- Listeners de Socket.IO ---
    socket.on('connect', () => {
        console.log('Socket conectado, identificando usuario:', currentUserId);
        socket.emit('authenticate', { userId: currentUserId });

    });

    socket.on('get_friend_list', (response) => {
		if (response.success){
			updateFriendListUI(response.data);
			// Pedir estadísticas incluyendo al usuario actual
			const usersForStats = [...response.data, currentUserId];
			socket.emit('see_stats_friends', { friendsList: usersForStats });
		}
		else {
			alert(`No se ha podido obtener la lista de amigos: ${response.error}`)
		}
    });

    socket.on('completed_exercises_friends', (completedExercisesFriends) => {
        updateScoreboardUI(completedExercisesFriends);
    });

    socket.on('friend_added', (response) => {
		if (response.success){
			alert('¡Amigo añadido!');
			fetchFriendsAndScores(); // Recargar lista y marcador
		}
		else {
			alert(`No se ha podido añadir al amigo: ${response.error}`)
		}
    });

    socket.on('friend_deleted', (response) => {
		if (response.success){
			alert('¡Amigo eliminado!');
			fetchFriendsAndScores(); // Recargar lista y marcador
		}
		else {
			alert(`No se ha podido eliminar al amigo: ${response.error}`)
		}
    });

    // --- Listeners de Eventos UI ---
    btnAddFriend.addEventListener('click', () => {
        const fid = prompt('ID de tu amigo');
        // Verificar que el usuario no canceló el prompt
        if (fid) {
            socket.emit('add_friend', { userId: currentUserId, FriendId: fid });
        }
    });

    btnDelFriend.addEventListener('click', () => {
        const fid = prompt('ID de tu amigo');
        // Verificar que el usuario no canceló el prompt
        if (fid) {
            socket.emit('delete_friend', { userId: currentUserId, FriendId: fid });
        }
    });
})();