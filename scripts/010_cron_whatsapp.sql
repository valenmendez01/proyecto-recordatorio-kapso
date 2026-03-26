
-- Ir a Integrations > Habilitar Cron
-- Jobs > Create Job

Name: send-daily-reminders
Schedule: */30 * * * *
Type: HTTP Request. Send an HTTP request to any URL.
Method: GET
Endpoint URL: https://url_de_la_app/api/whatsapp/send-reminders
Timeout: 5000 ms
HTTP Headers:
  Header name: Authorization
  Header value: Bearer codigo_secreto_para_el_cron_job
HTTP Request Body: dejarlo vacío (sin cuerpo para GET requests)


-- codigo_secreto_para_el_cron_job debe ser el mismo valor que pongas en tu archivo .env.local para la variable CRON_SECRET. Esto es una medida de seguridad para asegurarte de que solo tu cron job pueda acceder a ese endpoint y evitar accesos no autorizados.