import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: { findOne: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns an access token when credentials are valid', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'hermana',
      passwordHash,
    });

    const result = await service.login({
      username: 'hermana',
      password: 'correct-password',
    });

    expect(result).toEqual({ accessToken: 'signed-jwt' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      username: 'hermana',
    });
  });

  it('throws UnauthorizedException when the user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ username: 'missing', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'hermana',
      passwordHash,
    });

    await expect(
      service.login({ username: 'hermana', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
