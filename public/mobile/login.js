// src/public/mobile/login.js
(() => {
	const socket = io();
	const loginForm     = document.getElementById('loginForm');
	const registerForm  = document.getElementById('registerForm');
	const registerBtn   = document.getElementById('register_btn');
	const loginBtn      = document.getElementById('login_btn');
	const loginPanel    = document.getElementById('login-panel');
	const registerPanel = document.getElementById('register-panel');
  
	// Toggle entre paneles
	registerBtn.addEventListener('click', ev => {
		ev.preventDefault();
		loginPanel.classList.add('hidden');
		registerPanel.classList.remove('hidden');
	});
	loginBtn.addEventListener('click', ev => {
		ev.preventDefault();
		registerPanel.classList.add('hidden');
		loginPanel.classList.remove('hidden');
	});
  
	// Login
	loginForm.addEventListener('submit', ev => {
		ev.preventDefault();
		const user = loginForm.user.value.trim();
		const pass = loginForm.password.value.trim();
		socket.emit('login', { username: user, password: pass, type: 'User' });
	});
  
	// Register
	registerForm.addEventListener('submit', ev => {
		ev.preventDefault();
		const user = registerForm.user.value.trim();
		const pass = registerForm.password.value.trim();
		socket.emit('register', { username: user, password: pass, type: 'User' });
	});
  
	// Respuestas del servidor
	socket.on('successful_login', data => {
		sessionStorage.setItem('fitGameUserId', data.username);
		window.location.href = 'routine.html';
	});
	socket.on('failed_login', ({ code }) => {
		alert(code === 0
			? 'Usuario o contraseña incorrectos'
			: 'Error interno. Inténtalo más tarde.');
	});
  
	socket.on('successful_register', () => {
		alert('Registro correcto. Ahora puedes iniciar sesión.');
		registerPanel.classList.add('hidden');
		loginPanel.classList.remove('hidden');
	});
	socket.on('failed_register', ({ code }) => {
		alert(code === 0
			? 'Ese usuario ya existe'
			: 'Error interno al registrar.');
	});
})();
  