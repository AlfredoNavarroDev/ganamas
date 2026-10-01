import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Business } from '../entities/business.entity';

describe('BusinessService', () => {
  let service: BusinessService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value: Partial<Business>) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'business-1', ...value })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: getRepositoryToken(Business), useValue: repository },
      ],
    }).compile();

    service = module.get(BusinessService);
  });

  it('creates a business scoped to the owner', async () => {
    const result = await service.create('owner-1', { name: 'Frutas' });

    expect(repository.create).toHaveBeenCalledWith({
      owner: { id: 'owner-1' },
      name: 'Frutas',
    });
    expect(result).toMatchObject({ id: 'business-1', name: 'Frutas' });
  });

  it("lists only the owner's active businesses by default", async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll('owner-1', true);

    expect(repository.find).toHaveBeenCalledWith({
      where: { owner: { id: 'owner-1' }, active: true },
    });
  });

  it('throws NotFoundException when updating a business the owner does not have', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update('owner-1', 'missing', { active: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists dailyProfitGoal as-is when updating', async () => {
    repository.findOne.mockResolvedValue({ id: 'business-1', name: 'Frutas' });

    await service.update('owner-1', 'business-1', { dailyProfitGoal: '200.00' });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ dailyProfitGoal: '200.00' }),
    );
  });
});
