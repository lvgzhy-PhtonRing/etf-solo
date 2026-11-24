-- ============================================================
-- 每日自动备份（pg_cron + pg_net）
-- 目标：每天 03:00 UTC（北京时间 11:00）调用 backup Edge Function
-- 执行前：
--   1. 在 Dashboard → Database → Extensions 启用 pg_cron、pg_net
--   2. 把 <ANON_KEY> 替换为 goofish 项目的 anon key
--   3. 先手动 POST 一次 functions/v1/backup，确认 solo-backups 桶出现文件
-- ============================================================

SELECT cron.unschedule('solo-backup') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'solo-backup'
);

SELECT cron.schedule(
  'solo-backup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://efysjvbbaxwalhbbjxdc.supabase.co/functions/v1/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'apikey', '<ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
