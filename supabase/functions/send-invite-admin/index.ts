/**
 * Função desativada por opção do projeto.
 * 
 * Motivo: uso exclusivo do SMTP Zoho via Supabase Auth (requestLogin),
 * dispensando e-mail customizado por Edge Function.
 * 
 * Caso queira reativar no futuro:
 *  - Ajuste o provedor para uma API HTTP (ex.: ZeptoMail/SendGrid/SES),
 *  - Configure as secrets via `supabase functions secrets set ...`,
 *  - Reimplemente o handler HTTP aqui.
 */

export {};
