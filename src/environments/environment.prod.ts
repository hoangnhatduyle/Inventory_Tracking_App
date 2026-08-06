// Production environment. These values are PUBLIC (the anon key is the JWT
// public key used for unauthenticated requests; RLS still enforces auth).
// Secret values (service role key, OpenAI key) live only on the Vercel server.
export const environment = {
  production: true,
  supabaseUrl: 'https://gntdisphvkvvgahiuduq.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudGRpc3Bodmt2dmdhaGl1ZHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDYyNzcsImV4cCI6MjA5ODMyMjI3N30.PQoPxUVJVskHkg4rhO_ylUaPy6S-SU1GqsLLFQEraq0',
  apiBaseUrl: '',
  sentryDsn: '',
  environmentName: 'production',
  vapidPublicKey: 'BPslm83A3u1Z5Dmqe0ZKam-pwWtXlTLcTrLYVA-qr4UtvA2Bpdn1KcPPgPBX2gzcvoBqfwvNrRKd2eO9nqbXgLY',
};

