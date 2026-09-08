alter table public.profiles
  add column is_test_account boolean not null default false;

update public.profiles
set is_test_account = true
where id in (
  'a7afd360-28f9-4839-ab7e-79a87d4d2b7c', -- test-congregant@poimen.test
  '043ce9c5-5f8e-4d8a-8bd6-eaff15d7d504', -- test-priest@poimen.test
  '75a99c02-1fd3-41f3-a213-100340c3640f', -- test-servant@poimen.test
  'e0b5e1f8-ae4c-40da-a4aa-32e15e018b1b', -- markfam123+priest@gmail.com
  '74595306-04e1-48dd-b2f0-a4d8528b12ca', -- markfam1996@gmail.com
  'a8487e19-1ff1-46e6-82cc-ac13ccaf5d99', -- appreview.priest@example.com
  'c241442b-1fb2-48f4-b5ae-6a23ec090241', -- appreview.congregant@example.com
  '2753f1fb-979e-4098-8078-14d1c5f98c3d', -- appreview.congregant2@example.com
  '1285b056-c634-4394-9146-38001fac89c7'  -- appreview.congregant3@example.com
);
