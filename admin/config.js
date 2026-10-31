window.VH_CONFIG = {
  supabaseUrl: "https://yffwjgwwkapdrpwyjwfp.supabase.co",
  supabaseKey: "sb_publishable_2AL5ZWdwunfhVlrVuAr9Ww_3boXE_iM",
  measurementsStorage: window.VH_DEPLOYMENT?.readOnlyData ? "local" : "database",
  measurementsSaveOnly: location.hostname.endsWith(".vercel.app") || window.VH_DEPLOYMENT?.readOnlyData === true,
  storageBucket: "vintage-media"
};
