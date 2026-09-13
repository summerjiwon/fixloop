insert into public.locations (id, name, address)
values
  ('00000000-0000-0000-0000-000000000001', '부평 데모점', '데모 주소'),
  ('00000000-0000-0000-0000-000000000002', '송도 데모점', '데모 주소')
on conflict (id) do update set name = excluded.name, address = excluded.address;

insert into public.assets (location_id, name, category, zone)
select '00000000-0000-0000-0000-000000000001', '좌석 A-12', 'chair', 'Zone A'
where not exists (select 1 from public.assets where location_id = '00000000-0000-0000-0000-000000000001' and name = '좌석 A-12');
