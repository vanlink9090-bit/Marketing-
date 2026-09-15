// Fill these in after you deploy. None of these are truly secret except
// APP_SECRET, which only offers light protection — good enough for a
// personal tool, not a substitute for real auth if you ever share this URL.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://gytcjlbkmnhnpycyisib.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5dGNqbGJrbW5obnB5Y3lpc2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTY4NDksImV4cCI6MjEwNDk3Mjg0OX0.-mhj-3WQcv8N0Ao9E-9RyTT1D_WZXJ64qynRjtVa4fo',
  APP_SECRET: 'pmDeNmIpT5mms7ByUOOoadlq2cx06QBHkutwHBgcH8o',
  GOOGLE_CLIENT_ID: '625331772715-o3ik8vfink3pequ2ahvcu11hqb6ceii3.apps.googleusercontent.com',
  // Must exactly match the redirect URI you authorize in Google Cloud Console
  // AND the GOOGLE_REDIRECT_URI secret set on the oauth-callback function.
  GOOGLE_REDIRECT_URI: 'https://gytcjlbkmnhnpycyisib.supabase.co/functions/v1/clever-service',
  // Real per-function URLs — Supabase assigned random slugs instead of the
  // names we asked for, so these map our logical names to the actual URLs.
  FUNCTIONS: {
    oauthStatus: 'https://gytcjlbkmnhnpycyisib.supabase.co/functions/v1/dynamic-endpoint',
    sendCampaign: 'https://gytcjlbkmnhnpycyisib.supabase.co/functions/v1/smooth-handler',
    checkReplies: 'https://gytcjlbkmnhnpycyisib.supabase.co/functions/v1/smart-worker',
    sendFollowups: 'https://gytcjlbkmnhnpycyisib.supabase.co/functions/v1/rapid-responder',
  },
};
