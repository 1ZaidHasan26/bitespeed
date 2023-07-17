import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LinkPrecedenceType } from 'src/utils/enums';
import {
  findAndUnshiftElement,
  getUniqueValuesFromObjectArray,
} from 'src/utils/utils';
import { IsNull, Repository } from 'typeorm';
import { IdentifyContactResponseDto } from './dto/identify-contact-response.dto';
import { IdentifyContactDto } from './dto/identify-contact.dto';
import { Contact } from './entities/contact.entity';

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

  saveContact(contact: Contact) {
    return this.contactRepository.save(contact);
  }

  getPrimaryContact(contacts: Contact[]) {
    return contacts.filter(
      (contact) => contact.linkPrecedence === LinkPrecedenceType.Primary,
    );
  }

  async identify(
    identifyContactDto: IdentifyContactDto,
  ): Promise<IdentifyContactResponseDto> {
    try {
      const contactsByEmailPromise = identifyContactDto.email
        ? this.findByEmail(identifyContactDto.email)
        : Promise.resolve([]);
      const contactsByPhonePromise = identifyContactDto.phoneNumber
        ? this.findByPhone(identifyContactDto.phoneNumber)
        : Promise.resolve([]);

      const [contactsByEmail, contactsByPhone] = await Promise.all([
        contactsByEmailPromise,
        contactsByPhonePromise,
      ]);

      const hasContactsByEmail = contactsByEmail.length;
      const hasContactsByPhone = contactsByPhone.length;

      if (!hasContactsByEmail && !hasContactsByPhone) {
        return this.createPrimaryContact(identifyContactDto);
      } else if (
        (hasContactsByEmail &&
          !hasContactsByPhone &&
          identifyContactDto.phoneNumber) ||
        (hasContactsByPhone && !hasContactsByEmail && identifyContactDto.email)
      ) {
        return this.createSecondaryContact(
          identifyContactDto,
          contactsByEmail,
          contactsByPhone,
        );
      }
    } catch (err) {
      // Handle the error appropriately
    }
  }

  private async createPrimaryContact(
    identifyContactDto: IdentifyContactDto,
  ): Promise<IdentifyContactResponseDto> {
    const primaryContactPayload = this.contactRepository.create({
      email: identifyContactDto.email,
      phoneNumber: identifyContactDto.phoneNumber,
    });
    const primaryContact = await this.saveContact(primaryContactPayload);

    const identifiedContact: IdentifyContactResponseDto = {
      primaryContatctId: primaryContact.id,
      emails: primaryContact.email ? [primaryContact.email] : [],
      phoneNumbers: primaryContact.phoneNumber
        ? [primaryContact.phoneNumber]
        : [],
      secondaryContactIds: [],
    };

    return identifiedContact;
  }

  private async createSecondaryContact(
    identifyContactDto: IdentifyContactDto,
    contactsByEmail: Contact[],
    contactsByPhone: Contact[],
  ): Promise<IdentifyContactResponseDto> {
    const existingContacts = contactsByEmail.length
      ? contactsByEmail
      : contactsByPhone;

    const primaryContact = this.getPrimaryContact(existingContacts);

    const secondaryContactPayload = this.contactRepository.create({
      email: identifyContactDto.email,
      phoneNumber: identifyContactDto.phoneNumber,
      linked: primaryContact[0],
      linkPrecedence: LinkPrecedenceType.Secondary,
    });
    const secondaryContact = await this.saveContact(secondaryContactPayload);

    let emails = [];
    let phoneNumbers = [];
    let secondaryContactIds = getUniqueValuesFromObjectArray(
      [...contactsByEmail, ...contactsByPhone],
      'id',
    );
    secondaryContactIds.splice(
      secondaryContactIds.indexOf(primaryContact[0]['id']),
      1,
    );

    if (contactsByEmail.length) {
      emails = getUniqueValuesFromObjectArray(contactsByEmail, 'email');
      findAndUnshiftElement(emails, primaryContact[0]['email']);
    }
    if (contactsByPhone.length) {
      phoneNumbers = getUniqueValuesFromObjectArray(
        contactsByPhone,
        'phoneNumber',
      );
      findAndUnshiftElement(phoneNumbers, primaryContact[0]['phoneNumber']);
    }

    const identifiedContact: IdentifyContactResponseDto = {
      primaryContatctId: primaryContact[0]['id'],
      emails: [...emails, identifyContactDto.email],
      phoneNumbers: [...phoneNumbers, identifyContactDto.phoneNumber],
      secondaryContactIds: [...secondaryContactIds, secondaryContact.id],
    };

    return identifiedContact;
  }
}
