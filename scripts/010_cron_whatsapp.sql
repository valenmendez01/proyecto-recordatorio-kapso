-- 1. Habilitar extensiones necesarias
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Eliminar el job si ya existe para evitar duplicados
select cron.unschedule('send-daily-reminders');

-- 3. Crear el trabajo (Job)
-- Programar el recordatorio diario (9 AM Argentina / 12 PM UTC)
select
  cron.schedule(
    'send-daily-reminders', -- nombre del job
    '0 12 * * *',           -- Ejecución diaria a las 12:00 UTC
    $$
    select
      net.http_get(
        url:='https://tu-proyecto.vercel.app/api/whatsapp/send-reminders',
        headers:='{"Authorization": "Bearer f67890123456789abcde"}'::jsonb
      ) as request_id;
    $$
  );

-- Nota: 
-- Reemplaza https://tu-proyecto.vercel.app por tu URL real de producción
-- Reemplaza el token f67890123456789abcde por uno seguro que guardes en tu .env como CRON_SECRET.


-- Para ejecutar en el momento (test):
-- SELECT
--   net.http_get(
--       url:='https://v0-four-step-booking-system.vercel.app/api/whatsapp/send-reminders',
--       headers:='{"Authorization": "Bearer f67890123456789abcde"}'::jsonb
--   ) as request_id;