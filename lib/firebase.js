import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyAQqVENhMjVPYyauNr4O1Z0SXvb1I5qUBM',
  authDomain: 'plancasa-d6785.firebaseapp.com',
  projectId: 'plancasa-d6785',
  storageBucket: 'plancasa-d6785.firebasestorage.app',
  messagingSenderId: '804042107473',
  appId: '1:804042107473:web:c7d0388851c45dd27ee670',
};
export const firebaseApp = initializeApp(firebaseConfig);
// Chave do site reCAPTCHA Enterprise usada pelo App Check (protege a cota da IA). Firebase Console → App Check → Apps.
export const APP_CHECK_SITE_KEY = '6LcrjQYuAAAAAMvhgvV0e1h0MWhOQGdIhRocDKO_';
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// E-mails com acesso ao painel de administração. Use os mesmos e-mails em firestore.rules.
export const ADMIN_EMAILS = ['pedrocavalcant159@gmail.com'];
export const isAdmin = user => Boolean(user?.email && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase()));

// Clientes entram com um usuário simples; o Firebase Auth recebe um e-mail interno.
export const USER_DOMAIN = 'acesso.entrenos.app';
export const loginToEmail = login => {
  const value = String(login || '').trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${USER_DOMAIN}`;
};
export const emailToLogin = email => String(email || '').replace(`@${USER_DOMAIN}`, '');
