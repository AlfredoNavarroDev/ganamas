import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { User } from '../entities/user.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
  ) {}

  create(ownerId: string, dto: CreateBusinessDto) {
    const business = this.businessRepository.create({
      owner: { id: ownerId } as User,
      name: dto.name,
    });
    return this.businessRepository.save(business);
  }

  findAll(ownerId: string, active: boolean) {
    return this.businessRepository.find({ where: { owner: { id: ownerId }, active } });
  }

  async update(ownerId: string, id: string, dto: UpdateBusinessDto) {
    const business = await this.businessRepository.findOne({
      where: { id, owner: { id: ownerId } },
    });
    if (!business) throw new NotFoundException('Business not found');
    Object.assign(business, dto);
    return this.businessRepository.save(business);
  }
}
