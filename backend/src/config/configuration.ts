export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  openai: {
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
    model: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
  },
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  patristicDataDir: process.env['PATRISTIC_DATA_DIR'] ?? '',
});
