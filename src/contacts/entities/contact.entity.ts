import { Base } from 'src/Base';
import { LinkPrecedenceType } from 'src/utils/enums';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';

@Entity({ name: 'contacts' })
export class Contact extends Base {
  @Column({ nullable: true, type: 'varchar' })
  phone: string;

  @Column({ nullable: true, type: 'varchar' })
  email: string;

  @Column({
    type: 'enum',
    enum: LinkPrecedenceType,
    default: LinkPrecedenceType.Primary,
    nullable: false,
  })
  linkPrecedence: LinkPrecedenceType;

  @ManyToOne(() => Contact)
  linked: Contact;

  @OneToMany(() => Contact, (contact) => contact.linked)
  secondary: Contact[];
}
