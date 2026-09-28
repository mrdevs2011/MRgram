/**
 * Sidebar pastidagi akkaunt bloki (avatar + ism + @username).
 * state.me auth.js tomonidan o'rnatiladi va profil tahrirlanganda
 * o'zgaradi — shuning uchun engil imzo-tekshiruv bilan yangilanadi.
 */
import { state } from './config.js';
import { $, esc, defAvi } from './utils.js';

let _sig = '';

function render() {
  const me = state.me;
  const box = $('sbAccount');
  if (!box) return;
  box.hidden = !me?.uid;
  if (!me?.uid) { _sig = ''; return; }

  const name = me.displayName || me.username || 'Profil';
  const user = me.username ? '@' + me.username : '';
  const av   = me.photoURL || defAvi(name);
  const sig  = [me.uid, name, user, av].join('|');
  if (sig === _sig) return;
  _sig = sig;

  $('sbAccAvi').innerHTML = `<img src="${esc(av)}" alt="" onerror="this.style.display='none'">`;
  $('sbAccName').textContent = name;
  $('sbAccUser').textContent = user;
  box.title = name;
}

$('sbAccount')?.addEventListener('click', () => {
  document.querySelector('.nav-btn[data-v="profile"]')?.click();
});

render();
setInterval(render, 1500);
