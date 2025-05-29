// src/public/mobile/app.js
(() => {
    document.addEventListener('DOMContentLoaded', () => {
        // 1) Leemos siempre de sessionStorage
        const userId      = sessionStorage.getItem('fitGameUserId');
        const loginLink   = document.getElementById('loginLink');
        const profileLink = document.getElementById('profileLink');
        const greetingEl  = document.getElementById('greeting');
    
        // 2) Cambiar entre "Perfil" e "Inicio de sesión"
        if (loginLink && profileLink) {
            loginLink.style.display   = userId ? 'none' : '';
            profileLink.style.display = userId ? ''    : 'none';
        }
    
        // 3) Saludo al usuario
        if (greetingEl) {
            greetingEl.textContent = userId 
            ? `Bienvenido, ${userId}` 
            : '';
        }
    
        // 4) Cerrar sesión en profile.html (o cualquier otra página con #logoutBtn)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Borra de sessionStorage
                sessionStorage.removeItem('fitGameUserId');
                window.location.href = 'fitgame.html';
            });
        }

        // 5) Abrir y cerrar el menú
        const toggle = document.getElementById('navToggle');
        const menu   = document.querySelector('nav ul');
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                menu.classList.toggle('open');
                document.body.classList.toggle('menu-open');
                toggle.classList.toggle('open');                               // estado
                toggle.textContent = menu.classList.contains('open') ? '✕' : '☰'; // icono
            });
        }
    });
})();
  