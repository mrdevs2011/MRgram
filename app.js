
window.addEventListener('open-mention', async (e) => {
  const username = e.detail;
  try {
    const { sb } = await import('./modules/core/config.js');
    const { data } = await sb.from('profiles').select('id').ilike('username', username).maybeSingle();
    if (data?.id) {
      const { openUserProfileModal } = await import('./modules/profile/profile.js');
      openUserProfileModal(data.id);
    } else {
      const { toast } = await import('./modules/core/utils.js');
      toast("Foydalanuvchi topilmadi", "error");
    }
  } catch (err) {
    console.error('Mention click error:', err);
  }
});
