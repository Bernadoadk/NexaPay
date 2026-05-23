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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true, // autorise toutes les origines (dev uniquement)
  credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/products', productsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
