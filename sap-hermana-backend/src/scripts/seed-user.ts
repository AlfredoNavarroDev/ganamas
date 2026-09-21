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

  const passwordHash = await bcrypt.hash(password, 12);

  await AppDataSource.getRepository(User).upsert(
    { username, passwordHash },
    ['username'],
  );

  console.log(`Usuario "${username}" creado/actualizado correctamente.`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Error al sembrar el usuario:', err);
  process.exit(1);
});
