import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { IdentifyContactDto } from './dto/identify-contact.dto';
import { IdentifyContactResponseDto } from './dto/identify-contact-response.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('identify')
  identify(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    identifyContactDto: IdentifyContactDto,
  ) {
    return this.contactsService.identify(identifyContactDto);
  }
}
