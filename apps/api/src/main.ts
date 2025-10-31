import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
  await app.listen({ port, host: '0.0.0.0' });
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { bootstrap };
