-- Guruh sozlamalarida public @username ni saqlash uchun ustun darajasidagi UPDATE huquqi.
-- (RLS groups_update baribir faqat guruh admini/adminga ruxsat beradi.)
grant update (username) on public.groups to authenticated;
