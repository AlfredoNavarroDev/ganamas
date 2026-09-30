import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { Expense } from '../entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  create(dto: CreateExpenseDto) {
    const expense = this.expenseRepository.create({
      business: { id: dto.businessId } as Business,
      amount: dto.amount,
      description: dto.description,
      expensedAt: dto.expensedAt ? new Date(dto.expensedAt) : undefined,
    });
    return this.expenseRepository.save(expense);
  }

  async findAll(query: ListExpensesQueryDto) {
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.business = :businessId', { businessId: query.businessId });

    if (query.from) {
      qb.andWhere('expense.expensedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('expense.expensedAt <= :to', { to: query.to });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await qb
      .orderBy('expense.expensedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
