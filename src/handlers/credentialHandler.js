const fs = require('fs').promises;
const path = require('path');
const CREDENTIALS_FILE = path.join(__dirname, '../Databases/credentials.json');
const USER_ROUTINES_FILE = path.join(__dirname, '../Databases/userRoutinesFile.json');

/**
 * Añade un nuevo usuario o admin.
 * @returns  1 = ok,  0 = ya existe, -1 = error interno
 */
async function addCredentials(username, password, type) {
    try {
        const raw = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
        const creds = JSON.parse(raw);
        const key = type === 'Admin' ? 'Admins' : 'Users';
        if (!creds[key]) creds[key] = {};
    
        if (creds[key][username]) {
            // ya existe
            return 0;
        }
    
        creds[key][username] = [password];
        await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');

        return 1;
    } catch (e) {
        console.error('addCredentials error:', e);
        return -1;
    }
}

/**
 * Comprueba credenciales de acceso.
 * @returns  1 = ok,  0 = usuario/password incorrectos, -1 = error interno
 */
async function checkCredentials(username, password, type) {
    try {
        const raw = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
        const creds = JSON.parse(raw);
        const key = type === 'Admin' ? 'Admins' : 'Users';
        if (!creds[key] || !creds[key][username]) {
            return 0;
        }
        return creds[key][username][0] === password ? 1 : 0;
    } catch (e) {
        console.error('checkCredentials error:', e);
        return -1;
    }
}


// Exportar la función para que pueda ser usada en otros archivos
module.exports = { addCredentials, checkCredentials };
