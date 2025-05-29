
# FitGame – Interactive Gym Assistant

**FitGame** is a prototype web-based application designed to optimize users' gym time by synchronizing their mobile devices with gym screens. Developed as a final project for the *Sistemas Interactivos e Ubicuos* course (Computer Science Degree, UC3M, 2024–2025), it leverages multiple input methods and real-time feedback to enhance the workout experience.

## Features

- **Routine Tracking**: Follow your routine step-by-step without touching your phone.
- **Exercise Detection**: Count repetitions and verify correct form using gesture and pose recognition.
- **Multimodal Interaction**: Interact using voice commands, gestures, mobile shaking, or touch.
- **Social System**: Add friends, compete through a ranking system, and stay motivated.
- **Dual Screen Mode**: Gym screen displays synchronized progress in real-time.

## Technologies Used

- **JavaScript, HTML, CSS** – Frontend and backend logic.
- **Socket.IO** – Real-time bidirectional communication.
- **APIs**:
  - `SpeechRecognition` – Voice command support.
  - `DeviceMotionEvent` – Shake detection.
  - `MediaPipe` – Pose estimation for gesture control and repetition counting.
- **HTTPS** – Secure communication (using local, self-signed certificates).
- **JSON** – Data format for storing user credentials, routines, etc.

## Project Structure

```
├── src/
│   ├── Databases/
│   │   ├── credentials.json
│   │   ├── routines.json
│   │   ├── socialCompetition.json
│   │   ├── userFriends.json
│   │   ├── userRoutinesFile.json
│   │   └── userStateFile.json
│   ├── handlers/
│   │   ├── credentialHandler.js
│   │   ├── routineHandler.js
│   │   ├── socialHandler.js
│   │   └── socketHandler.js
│   ├── https/
│   │   ├── MiServidorHTTPS.crt
│   │   └── MiServidorHTTPS.key
│   ├── interface/
│   │   ├── avatar-default.svg
│   │   ├── fitgame.html
│   │   ├── gym.html
│   │   ├── login.html
│   │   ├── profile.html
│   │   ├── routine.html
│   │   ├── social.html
│   │   └── styles.css
│   └── public/
│       ├── gym/
│       │   ├── detectionController.js
│       │   ├── gym.js
│       │   ├── handController.js
│       │   └── poseDetector.js
│       └── mobile/
│           ├── login.js
│           ├── routine.js
│           ├── shakeDetector.js
│           ├── social.js
│           ├── voiceDetector.js
│           └── sessionElements.js
├── server.mjs
├── package-lock.json
├── package.json
├── README.md
```

## How to Run

1. **Start the server**
   ```bash
   node src/server.js
   ```

2. **Open Gym View**  
   In a browser on the gym screen or computer running the server:
   ```
   https://<Server-IP>:3000/gym.html
   ```

3. **Open Mobile View**  
   In a browser on the user's mobile device:
   ```
   https://<Server-IP>:3000/fitgame.html
   ```

   ⚠️ Accept browser warning for untrusted certificate by clicking “Advanced” → “Proceed”.

4. **Ensure Same Network**  
   Both devices must be connected to the same Wi-Fi network for the local IP link to work.

5. **Login & Test**
   - Register with a username and password.
   - Select "Calistenia Básica" routine to test pose-based counting.
   - Use code `GYM01` to sync with the gym screen.

## Demo Videos

https://www.youtube.com/playlist?list=PLTfn7UGyA95UMQnm2iWZpwV-Lk42lAYp8

