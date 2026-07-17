import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Family, FamilyDocument } from './family.schema';

@Injectable()
export class FamilyRepository {
  constructor(@InjectModel(Family.name) private readonly model: Model<FamilyDocument>) {}

  async create(name: string, ownerId: string): Promise<FamilyDocument> {
    return this.model.create({ name, ownerId: new Types.ObjectId(ownerId) });
  }

  async findById(id: string): Promise<FamilyDocument | null> {
    return this.model.findById(id).exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }
}
