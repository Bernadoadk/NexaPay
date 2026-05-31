import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { clientsRouter } from './routes/clients';
import { quotesRouter } from './routes/quotes';
import { productsRouter } from './routes/products';
import { dashboardRouter } from './routes/dashboard';
import { paymentsRouter } from './routes/payments';
import { uploadRouter } from './routes/upload';
import { creditsRouter } from './routes/credits';
import { aiRouter } from './routes/ai';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';

const app = express();

const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
const corsOrigins = [
  frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    // Préviews Vercel (ex. nexapay-xxx.vercel.app)
    if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  limit: '1mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/products', productsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('[Health] DB:', err);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      hint: 'Vérifiez DATABASE_URL (Neon pooled) et exécutez npx prisma db push',
    });
  }
});

app.use(errorHandler);

export default app;
