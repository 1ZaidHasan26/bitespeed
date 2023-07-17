import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { ContactsModule } from './contacts/contacts.module';
import { toBool } from './utils/utils';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env['TYPEORM_DB_HOST'],
      port: parseInt(process.env['TYPEORM_DB_PORT']),
      username: process.env['TYPEORM_DB_USERNAME'],
      password: process.env['TYPEORM_DB_PASSWORD'],
      database: process.env['TYPEORM_DB_DATABASE'],
      entities: [join(__dirname, '**/**.entity{.ts,.js}')],
      synchronize: toBool(process.env['TYPEORM_DB_SYNCHRONIZE']),
      subscribers: [join(__dirname, '**/**.subscriber{.ts,.js}')],
    }),
    ContactsModule,
  ],
})
export class AppModule {}
