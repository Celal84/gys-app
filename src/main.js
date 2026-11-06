import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';
import { gysApp } from './app.js';
import './styles.css';

window.Alpine = Alpine;
Alpine.data('gysApp', gysApp);
Alpine.start();
registerSW({ onRegisteredSW() {}, onRegisterError(error) { console.warn('Çevrimdışı kayıt tamamlanamadı.', error.name); } });
