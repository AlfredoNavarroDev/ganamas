import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { DayClosing } from '../entities/day-closing.entity';
import { Business } from '../entities/business.entity';
import { User } from '../entities/user.entity';
import { ReportsService } from '../reports/reports.service';
import { ListClosingsQueryDto } from './dto/list-closings-query.dto';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ClosingService {
  constructor(
    @InjectRepository(DayClosing) private readonly closingRepository: Repository<DayClosing>,
    private readonly reportsService: ReportsService,
  ) {}

  private limaTodayRange(): { closedDate: string; from: string; to: string } {
    const closedDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const from = new Date(`${closedDate}T05:00:00.000Z`);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);

    return { closedDate, from: from.toISOString(), to: to.toISOString() };
  }

  async closeToday(businessId: string, userId: string): Promise<DayClosing> {
    const { closedDate, from, to } = this.limaTodayRange();
    const snapshot = await this.reportsService.summary(businessId, from, to);

    const closing = this.closingRepository.create({
      business: { id: businessId } as Business,
      closedDate,
      closedBy: { id: userId } as User,
      snapshot,
    });

    try {
      return await this.closingRepository.save(closing);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === UNIQUE_VIOLATION) {
        throw new ConflictException('El día ya fue cerrado.');
      }
      throw error;
    }
  }

  async findToday(businessId: string): Promise<DayClosing> {
    const { closedDate } = this.limaTodayRange();
    const closing = await this.closingRepository.findOne({
      where: { business: { id: businessId }, closedDate },
    });
    if (!closing) throw new NotFoundException('No hay cierre para hoy.');
    return closing;
  }

  findAll(query: ListClosingsQueryDto): Promise<DayClosing[]> {
    const qb = this.closingRepository
      .createQueryBuilder('closing')
      .where('closing.business = :businessId', { businessId: query.businessId });

    if (query.from) qb.andWhere('closing.closedDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('closing.closedDate <= :to', { to: query.to });

    return qb.orderBy('closing.closedDate', 'DESC').getMany();
  }
}
