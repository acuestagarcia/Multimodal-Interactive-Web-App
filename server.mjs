import https from 'https';
import fs from 'fs';
import express from 'express';
import { Server } from 'socket.io';
import path from 'path';
import { handleSocketConnection } from './handlers/socketHandler.js';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar las opciones de HTTPS (certificado y clave privada)
const options = {
    key: fs.readFileSync(path.join(__dirname, 'https', 'MiServidorHTTPS.key')),
    cert: fs.readFileSync(path.join(__dirname, 'https', 'MiServidorHTTPS.crt')),
};

const app = express(); // Instancia de Express

// Sirve todos los archivos estáticos (HTML, CSS, JS, imágenes, etc.) 
// que estén dentro de la carpeta `interface` en la ruta raíz.
// Ejemplo: GET /gym.html → src/interface/gym.html
app.use(express.static(path.join(__dirname, 'interface')));  

// Sirve los archivos estáticos de la carpeta `public` 
// bajo el prefijo `/public`.
// Ejemplo: GET /public/gym.js → src/public/gym.js
app.use('/public', express.static(path.join(__dirname, 'public')));

// Crear servidor HTTPS
const server = https.createServer(options, app); // Servidor HTTPS basado en Express

const io = new Server(server); // Instancia del servidor Socket.IO

handleSocketConnection(io); // <--- Pasa 'io' a la función

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', async () => { 
    console.log(`Servidor corriendo en https://localhost:${PORT}/fitgame.html`);
});
