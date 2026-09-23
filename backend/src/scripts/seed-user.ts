import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../data-source';
import { User } from '../entities/user.entity';

async function seed() {
  const username = process.env.SEED_USERNAME;
  const password = process.env.SEED_PASSWORD;

  if (!username || !password) {
    throw new Error('SEED_USERNAME y SEED_PASSWORD deben estar definidos en el .env');
  }

  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOneBy({ username });

  if (existing) {
    console.log(`Usuario "${username}" ya existe, se omite el seed.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await userRepo.insert({ username, passwordHash });
    console.log(`Usuario "${username}" creado correctamente.`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Error al sembrar el usuario:', err);
  process.exit(1);
});
