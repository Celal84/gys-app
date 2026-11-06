import Alpine from 'alpinejs';
import { registerSW } from 'virtual:pwa-register';
import { gysApp } from './app.js';
import './styles.css';
import './features.css';

window.Alpine = Alpine;
Alpine.data('gysApp', gysApp);
Alpine.start();
const update=registerSW({onNeedRefresh(){window.__gysUpdateReady=true;window.dispatchEvent(new Event('gys-update-ready'));},onRegisterError(error){console.warn('Çevrimdışı kayıt tamamlanamadı.',error.name);}});
window.addEventListener('gys-apply-update',()=>update(true));
