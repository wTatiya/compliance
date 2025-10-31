import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService]
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  it('returns a healthy response shape', () => {
    const result = appController.getHealth();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toEqual(expect.any(String));
  });
});
