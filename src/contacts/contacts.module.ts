import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { Contact } from './entities/contact.entity';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService],
  imports: [TypeOrmModule.forFeature([Contact])],
})
export class ContactsModule {}
