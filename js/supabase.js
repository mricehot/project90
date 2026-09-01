/* ═══════════════════════════════════════════════
   PROJECT 90 — CLIENTE SUPABASE

   Requer, carregados ANTES deste arquivo:
     1. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2   (UMD → window.supabase)
     2. js/supabase-config.js                                  (URL + anon key)

   Expõe:  window.sb   → instância do cliente
═══════════════════════════════════════════════ */
(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Project 90] supabase-js não carregou. Confira a tag <script> do CDN.');
    return;
  }
  if (!window.SUPABASE_URL || window.SUPABASE_URL.indexOf('SEU-PROJETO') !== -1) {
    console.warn('[Project 90] Configure js/supabase-config.js com a URL e a anon key do seu projeto.');
  }

  window.sb = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // processa o retorno do OAuth do Google
        storageKey: 'p90-auth',
        flowType: 'pkce'
      }
    }
  );
})();
