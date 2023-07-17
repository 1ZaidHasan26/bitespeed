import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
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
      return this.contactRepository.find({
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
  private findByPhone(phone: string) {
    try {
      return this.contactRepository.find({
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

  private getPrimaryContact(contacts: Contact[]) {
    let primaryContact = contacts.filter(
      (contact) => contact.linkPrecedence === LinkPrecedenceType.Primary,
    );
    if (!primaryContact.length) {
      return [contacts[0].linked];
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
        : Promise.resolve([]);
      const contactsByPhonePromise = identifyContactDto.phoneNumber
        ? this.findByPhone(identifyContactDto.phoneNumber)
        : Promise.resolve([]);

      const [contactsByEmail, contactsByPhone] = await Promise.all([
        contactsByEmailPromise,
        contactsByPhonePromise,
      ]);
      console.log({ contactsByEmail, contactsByPhone });

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
      } else if (hasContactsByEmail && hasContactsByPhone) {
        const primaryContactByEmail = this.getPrimaryContact(contactsByEmail);
        const primaryContactByPhone = this.getPrimaryContact(contactsByPhone);
        console.log({ primaryContactByEmail, primaryContactByPhone });

        if (
          primaryContactByEmail.length &&
          primaryContactByPhone.length &&
          primaryContactByEmail[0]['id'] !== primaryContactByPhone[0]['id']
        ) {
          const primaryContact = await this.changePrimaryContact(
            primaryContactByEmail[0],
            primaryContactByPhone[0],
            [...contactsByEmail, ...contactsByPhone],
          );
          return this.mergeContacts(
            [...contactsByEmail, ...contactsByPhone],
            primaryContact,
          );
        } else {
          const primaryContact = primaryContactByEmail.length
            ? primaryContactByEmail[0]
            : primaryContactByPhone[0];
          return this.mergeContacts(
            [...contactsByEmail, ...contactsByPhone],
            primaryContact,
          );
        }
      } else if (hasContactsByEmail || hasContactsByPhone) {
        const existingContacts = contactsByEmail.length
          ? contactsByEmail
          : contactsByPhone;
        const primaryContact = this.getPrimaryContact(existingContacts);
        let { emails, phoneNumbers, secondaryContactIds } =
          this.prepareIdentifyPayload(
            contactsByEmail,
            contactsByPhone,
            primaryContact,
          );

        const identifiedContact: IdentifyContactResponseDto = {
          primaryContatctId: primaryContact[0]['id'],
          emails: emails,
          phoneNumbers: phoneNumbers,
          secondaryContactIds: secondaryContactIds,
        };
        return identifiedContact;
      }
    } catch (err) {
      console.error(err);
      if (err.status) throw err;
      else throw new HttpException(err, 500);
    }
  }

  private prepareIdentifyPayload(
    contactsByEmail: any[],
    contactsByPhone: any[],
    primaryContact: Contact[],
  ) {
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
    return { emails, phoneNumbers, secondaryContactIds };
  }

  private async createPrimaryContact(
    identifyContactDto: IdentifyContactDto,
  ): Promise<IdentifyContactResponseDto> {
    try {
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
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while creating Primary contact');
    }
  }

  private async createSecondaryContact(
    identifyContactDto: IdentifyContactDto,
    contactsByEmail: Contact[],
    contactsByPhone: Contact[], // : Promise<IdentifyContactResponseDto>
  ) {
    try {
      const existingContacts = contactsByEmail.length
        ? contactsByEmail
        : contactsByPhone;
      console.log(existingContacts);

      const primaryContact = this.getPrimaryContact(existingContacts);
      const secondaryContactPayload = this.contactRepository.create({
        email: identifyContactDto.email,
        phoneNumber: identifyContactDto.phoneNumber,
        linked: primaryContact[0],
        linkPrecedence: LinkPrecedenceType.Secondary,
      });
      const secondaryContact = await this.saveContact(secondaryContactPayload);
      let { emails, phoneNumbers, secondaryContactIds } =
        this.prepareIdentifyPayload(
          contactsByEmail,
          contactsByPhone,
          primaryContact,
        );
      const identifiedContact: IdentifyContactResponseDto = {
        primaryContatctId: primaryContact[0]['id'],
        emails: [...emails, identifyContactDto.email],
        phoneNumbers: [...phoneNumbers, identifyContactDto.phoneNumber],
        secondaryContactIds: [...secondaryContactIds, secondaryContact.id],
      };

      return identifiedContact;
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while creating secondary contact');
    }
  }

  private async changePrimaryContact(
    primaryContactA: Contact,
    primaryContactB: Contact,
    contacts: Contact[],
  ) {
    try {
      let earliestPrimaryContact =
        primaryContactA.createdAt > primaryContactB.createdAt
          ? primaryContactA
          : primaryContactB;
      let updateContactPayload = contacts.filter((contact) => {
        if (contact.linked.id !== earliestPrimaryContact.id) {
          contact.linkPrecedence = LinkPrecedenceType.Secondary;
          contact.linked = earliestPrimaryContact;
          return true;
        } else return false;
      });
      await this.bulkSaveContact(updateContactPayload);
      return earliestPrimaryContact;
    } catch (err) {
      console.error(err);
      throw new Error('Error occured while changing Primary Contact');
    }
  }
  private async mergeContacts(contacts: Contact[], primaryContact: Contact) {
    let emails = getUniqueValuesFromObjectArray(contacts, 'email');
    findAndUnshiftElement(emails, primaryContact.email);
    let phoneNumbers = getUniqueValuesFromObjectArray(contacts, 'phoneNumber');
    findAndUnshiftElement(phoneNumbers, primaryContact.phoneNumber);
    let secondaryContactIds = getUniqueValuesFromObjectArray(contacts, 'id');
    secondaryContactIds.splice(
      secondaryContactIds.indexOf(primaryContact['id']),
      1,
    );
    const identifiedContact: IdentifyContactResponseDto = {
      primaryContatctId: primaryContact['id'],
      emails: emails,
      phoneNumbers: phoneNumbers,
      secondaryContactIds: secondaryContactIds,
    };
    return identifiedContact;
  }
}
