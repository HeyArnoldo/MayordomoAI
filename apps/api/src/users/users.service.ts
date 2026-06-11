import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@app/contracts';
import { User } from './user.entity';

export interface GoogleProfileData {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  create(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /** Nombre con el que el mayordomo se dirige al usuario (editable en Configuración). */
  updateName(user: User, name: string): Promise<User> {
    user.name = name;
    return this.repo.save(user);
  }

  /**
   * Borrado definitivo de la cuenta. Toda tabla con userId tiene FK
   * ON DELETE CASCADE: un solo DELETE limpia datos y libera el número
   * (el unique de e164 muere con la fila de phone_numbers).
   */
  async deleteAccount(user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      const admins = await this.repo.count({ where: { role: UserRole.ADMIN } });
      if (admins <= 1) {
        throw new ConflictException(
          'Eres el último admin — asigna otro antes de eliminar tu cuenta',
        );
      }
    }
    await this.repo.delete(user.id);
    this.logger.warn(`cuenta eliminada: ${user.email} (${user.id})`);
  }

  /**
   * Login con Google: busca por googleId; si no existe pero hay un usuario
   * local con el mismo email, vincula la cuenta; si no, lo crea.
   */
  async upsertFromGoogle(profile: GoogleProfileData): Promise<User> {
    let user = await this.repo.findOne({ where: { googleId: profile.googleId } });
    if (!user) {
      user = await this.findByEmail(profile.email);
      if (user) {
        user.googleId = profile.googleId;
      } else {
        user = this.repo.create({
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          role: UserRole.USER,
        });
      }
    }
    user.avatarUrl = profile.avatarUrl;
    return this.repo.save(user);
  }
}
