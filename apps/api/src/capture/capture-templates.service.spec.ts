import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FinancialAccountRepository } from '../financial-accounts/financial-account.repository';
import { CategoryRepository } from '../categories/category.repository';
import { MovementTemplateRepository } from './movement-template.repository';
import { MovementTemplateDocument } from './movement-template.schema';
import { CaptureTemplatesService } from './capture-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

/** Builds a fake template document (only the fields the service reads). */
function template(id: string, type: 'income' | 'expense'): MovementTemplateDocument {
  return {
    id,
    name: 'Feria',
    type,
    accountId: { toString: () => 'acc1' },
    categoryId: { toString: () => 'cat1' },
    amount: null,
    note: null,
  } as unknown as MovementTemplateDocument;
}

describe('CaptureTemplatesService (UX-01)', () => {
  const templates = {
    create: jest.fn(),
    findInFamily: jest.fn(),
    listByFamily: jest.fn(),
    existsByName: jest.fn(),
    update: jest.fn(),
    deleteInFamily: jest.fn(),
  };
  const accounts = { findInFamily: jest.fn(), findManyInFamily: jest.fn() };
  const categories = { findVisible: jest.fn(), findManyVisible: jest.fn() };

  const service = new CaptureTemplatesService(
    templates as unknown as MovementTemplateRepository,
    accounts as unknown as FinancialAccountRepository,
    categories as unknown as CategoryRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('create · validation (FR-007/FR-009)', () => {
    const dto: CreateTemplateDto = {
      name: 'Feria semanal',
      type: 'expense',
      accountId: 'acc1',
      categoryId: 'cat1',
    };

    it('creates when references + kind + name are valid', async () => {
      templates.existsByName.mockResolvedValue(false);
      accounts.findInFamily.mockResolvedValue({ archivedAt: null });
      categories.findVisible.mockResolvedValue({ scope: 'family', kind: 'expense', archivedAt: null });
      templates.create.mockResolvedValue(template('t1', 'expense'));

      const result = await service.create('fam1', 'm1', dto);

      expect(templates.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        templateId: 't1',
        accountAvailable: true,
        categoryAvailable: true,
      });
    });

    it('rejects an income category on an expense template (400)', async () => {
      templates.existsByName.mockResolvedValue(false);
      accounts.findInFamily.mockResolvedValue({ archivedAt: null });
      categories.findVisible.mockResolvedValue({ scope: 'system', kind: 'income', archivedAt: null });

      await expect(service.create('fam1', 'm1', dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(templates.create).not.toHaveBeenCalled();
    });

    it('rejects an archived account (400)', async () => {
      templates.existsByName.mockResolvedValue(false);
      accounts.findInFamily.mockResolvedValue({ archivedAt: new Date() });

      await expect(service.create('fam1', 'm1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a foreign/unknown account (findInFamily null → 400)', async () => {
      templates.existsByName.mockResolvedValue(false);
      accounts.findInFamily.mockResolvedValue(null);

      await expect(service.create('fam1', 'm1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate name (409) before touching references', async () => {
      templates.existsByName.mockResolvedValue(true);

      await expect(service.create('fam1', 'm1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(accounts.findInFamily).not.toHaveBeenCalled();
      expect(templates.create).not.toHaveBeenCalled();
    });
  });

  describe('update · guards (FR-005/FR-009)', () => {
    it('rejects an empty patch (400)', async () => {
      templates.findInFamily.mockResolvedValue(template('t1', 'expense'));

      await expect(service.update('fam1', 't1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a rename that collides with another template (409)', async () => {
      templates.findInFamily.mockResolvedValue(template('t1', 'expense'));
      templates.existsByName.mockResolvedValue(true);

      await expect(service.update('fam1', 't1', { name: 'Bencina' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(templates.existsByName).toHaveBeenCalledWith('fam1', 'Bencina', 't1');
    });

    it('404 when the template is not in the family', async () => {
      templates.findInFamily.mockResolvedValue(null);

      await expect(service.update('fam1', 't1', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('404 when nothing was removed', async () => {
      templates.deleteInFamily.mockResolvedValue(false);

      await expect(service.delete('fam1', 't1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves when a row was removed', async () => {
      templates.deleteInFamily.mockResolvedValue(true);

      await expect(service.delete('fam1', 't1')).resolves.toBeUndefined();
    });
  });
});
