import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IdentifyContactDto } from './dto/identify-contact.dto';
import { Contact } from './entities/contact.entity';
import { IdentifyContactResponseDto } from './dto/identify-contact-response.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  findByEmail(email: string) {
    return this.contactRepository.find({
      where: {
        email: email,
        deletedAt: IsNull(),
      },
    });
  }
  findByPhone(phone: string) {
    return this.contactRepository.find({
      where: {
        email: phone,
        deletedAt: IsNull(),
      },
    });
  }

  create(contact: Contact) {
    return this.contactRepository.save(contact);
  }

  async identify(
    identifyContactDto: IdentifyContactDto,
  ): Promise<IdentifyContactResponseDto> {
    try {
      let contactsByEmailPromise: Promise<Contact[]>;
      let contactsByPhonePromise: Promise<Contact[]>;
      if (identifyContactDto.email) {
        contactsByEmailPromise = this.findByEmail(identifyContactDto.email);
      }
      if (identifyContactDto.phoneNumber) {
        contactsByPhonePromise = this.findByPhone(
          identifyContactDto.phoneNumber,
        );
      }
      const [contactsByEmail, contactsByPhone] = await Promise.all([
        contactsByEmailPromise,
        contactsByPhonePromise,
      ]);
      const hasContactsByEmail = contactsByEmail.length;
      const hasContactsByPhone = contactsByPhone.length;
      /**
       * If no contact is found using email and phone, then create a new contact
       */
      let identifiedContact: IdentifyContactResponseDto;
      if (!hasContactsByEmail && !hasContactsByPhone) {
        const primaryContactPayload = this.contactRepository.create({
          email: identifyContactDto.email,
          phoneNumber: identifyContactDto.phoneNumber,
        });
        const primaryContact = await this.create(primaryContactPayload);
        identifiedContact = {
          primaryContatctId: primaryContact.id,
          emails: primaryContact.email ? [primaryContact.email] : [],
          phoneNumbers: primaryContact.phoneNumber
            ? [primaryContact.phoneNumber]
            : [],
          secondaryContactIds: [],
        };
        return identifiedContact;
      } 
    } catch (err) {}
  }
}
