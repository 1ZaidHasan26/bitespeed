import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  private findByEmail(email: string) {
    try {
      return this.contactRepository.findOne({
        where: {
          email: email,
          deletedAt: IsNull(),
        },
        relations: ['linked'],
      });
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while finding contact via email');
    }
  }

  private findByPrimaryContact(primaryContactId: number) {
    try {
      return this.contactRepository.find({
        where: {
          linked: {
            id: primaryContactId,
          },
          deletedAt: IsNull(),
        },
        relations: ['linked'],
      });
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while finding contact via email');
    }
  }

  private findByPhone(phone: string) {
    try {
      return this.contactRepository.findOne({
        where: {
          phoneNumber: phone,
          deletedAt: IsNull(),
        },
        relations: ['linked'],
      });
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while finding contact via phone');
    }
  }

  private saveContact(contact: Contact) {
    return this.contactRepository.save(contact);
  }

  private bulkSaveContact(contacts: Contact[]) {
    return this.contactRepository.save(contacts);
  }

  private getPrimaryContact(contact: Contact) {
    let primaryContact =
      contact.linkPrecedence === LinkPrecedenceType.Primary ? contact : null;

    if (!primaryContact) {
      return contact.linked;
    } else return primaryContact;
  }

  async identify(
    identifyContactDto: IdentifyContactDto,
  ): Promise<IdentifyContactResponseDto | any> {
    try {
      if (!identifyContactDto.email && !identifyContactDto.phoneNumber) {
        throw new BadRequestException('Invalid email and phone number found');
      }
      const contactsByEmailPromise = identifyContactDto.email
        ? this.findByEmail(identifyContactDto.email)
        : Promise.resolve(null);
      const contactsByPhonePromise = identifyContactDto.phoneNumber
        ? this.findByPhone(identifyContactDto.phoneNumber)
        : Promise.resolve(null);

      const [contactsByEmail, contactsByPhone]: Contact[] = await Promise.all([
        contactsByEmailPromise,
        contactsByPhonePromise,
      ]);
      let primaryContact: Contact;
      if (!contactsByEmail && !contactsByPhone) {
        primaryContact = await this.createPrimaryContact(identifyContactDto);
      } else if (
        (contactsByEmail &&
          !contactsByPhone &&
          identifyContactDto.phoneNumber) ||
        (contactsByPhone && !contactsByEmail && identifyContactDto.email)
      ) {
        const existingContact = contactsByEmail
          ? contactsByEmail
          : contactsByPhone;
        primaryContact = this.getPrimaryContact(existingContact);
        await this.createSecondaryContact(identifyContactDto, primaryContact);
      } else if (contactsByEmail && contactsByPhone) {
        const primaryContactByEmail = this.getPrimaryContact(contactsByEmail);
        const primaryContactByPhone = this.getPrimaryContact(contactsByPhone);
        if (
          primaryContactByEmail &&
          primaryContactByPhone &&
          primaryContactByEmail['id'] !== primaryContactByPhone['id']
        ) {
          primaryContact = await this.changePrimaryContact(
            primaryContactByEmail,
            primaryContactByPhone,
          );
        } else {
          primaryContact = primaryContactByEmail
            ? primaryContactByEmail
            : primaryContactByPhone;
        }
      } else if (contactsByEmail || contactsByPhone) {
        const existingContacts = contactsByEmail
          ? contactsByEmail
          : contactsByPhone;
        primaryContact = this.getPrimaryContact(existingContacts);
      }
      if (!primaryContact) {
        throw new NotFoundException('No Contacts found');
      }
      let secondaryContacts = await this.findByPrimaryContact(
        primaryContact.id,
      );
      return this.prepareIdentifyResponse(secondaryContacts, primaryContact);
    } catch (err) {
      console.error(err);
      if (err.status) throw err;
      else throw new HttpException(err, 500);
    }
  }

  private prepareIdentifyResponse(
    contacts: Contact[],
    primaryContact: Contact,
  ) {
    let emails = getUniqueValuesFromObjectArray(contacts, 'email');
    if (primaryContact.email) {
      emails.push(primaryContact.email);
      findAndUnshiftElement(emails, primaryContact.email);
    }
    let phoneNumbers = getUniqueValuesFromObjectArray(contacts, 'phoneNumber');
    if (primaryContact.phoneNumber) {
      phoneNumbers.push(primaryContact.phoneNumber);
      findAndUnshiftElement(phoneNumbers, primaryContact.phoneNumber);
    }
    let secondaryContactIds = getUniqueValuesFromObjectArray(contacts, 'id');
    const identifiedContact: IdentifyContactResponseDto = {
      primaryContatctId: primaryContact.id,
      emails: emails,
      phoneNumbers: phoneNumbers,
      secondaryContactIds: secondaryContactIds,
    };
    return identifiedContact;
  }

  private async createPrimaryContact(identifyContactDto: IdentifyContactDto) {
    try {
      const primaryContactPayload = this.contactRepository.create({
        email: identifyContactDto.email,
        phoneNumber: identifyContactDto.phoneNumber,
      });
      return await this.saveContact(primaryContactPayload);
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while creating Primary contact');
    }
  }

  private async createSecondaryContact(
    identifyContactDto: IdentifyContactDto,
    primaryContact: Contact,
  ) {
    try {
      const secondaryContactPayload = this.contactRepository.create({
        email: identifyContactDto.email,
        phoneNumber: identifyContactDto.phoneNumber,
        linked: primaryContact,
        linkPrecedence: LinkPrecedenceType.Secondary,
      });
      return await this.saveContact(secondaryContactPayload);
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while creating secondary contact');
    }
  }

  private async changePrimaryContact(
    primaryContactA: Contact,
    primaryContactB: Contact,
  ) {
    try {
      let selectedPrimaryContact: Contact, rejectedPrimaryContact: Contact;
      if (primaryContactA.createdAt < primaryContactB.createdAt) {
        selectedPrimaryContact = primaryContactA;
        rejectedPrimaryContact = primaryContactB;
      } else {
        selectedPrimaryContact = primaryContactB;
        rejectedPrimaryContact = primaryContactA;
      }
      const contacts = await this.findByPrimaryContact(
        rejectedPrimaryContact.id,
      );
      contacts.push(rejectedPrimaryContact);
      let updateContactPayload = contacts.map((contact) => {
        contact.linkPrecedence = LinkPrecedenceType.Secondary;
        contact.linked = selectedPrimaryContact;
        return contact;
      });
      await this.bulkSaveContact(updateContactPayload);
      return selectedPrimaryContact;
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while changing Primary Contact');
    }
  }
}
