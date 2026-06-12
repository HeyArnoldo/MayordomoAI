import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AdminUsageReport,
  AdminUser,
  BoxScope,
  BoxType,
  Locale,
  UserRole,
  UserStatus,
} from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { User } from '../users/user.entity';
import { PhoneNumber } from '../users/phone-number.entity';
import { Box } from '../boxes/box.entity';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { I18nService } from '../i18n/i18n.service';

// Cajas iniciales de una cuenta aprobada (suman 100%). Los nombres se
// resuelven en el idioma del usuario aprobado al crearlas (keys
// `defaultBoxes.*`): después son datos del usuario, no código.
const DEFAULT_BOXES = [
  { nameKey: 'defaultBoxes.savings', pct: 25, type: BoxType.FUND, scope: BoxScope.PERSONAL },
  { nameKey: 'defaultBoxes.misc', pct: 30, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { nameKey: 'defaultBoxes.transport', pct: 15, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { nameKey: 'defaultBoxes.leisure', pct: 15, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
  { nameKey: 'defaultBoxes.snacks', pct: 15, type: BoxType.EXPENSE, scope: BoxScope.PERSONAL },
];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PhoneNumber) private readonly phones: Repository<PhoneNumber>,
    @InjectRepository(Box) private readonly boxes: Repository<Box>,
    private readonly aiUsage: AiUsageService,
    private readonly i18n: I18nService,
  ) {}

  async list(status?: UserStatus): Promise<AdminUser[]> {
    const rows = await this.users.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    const phones = rows.length
      ? await this.phones.find({ where: rows.map((u) => ({ userId: u.id })) })
      : [];
    const phoneByUser = new Map(phones.map((p) => [p.userId, p]));
    return rows.map((u) => this.toAdminUser(u, phoneByUser.get(u.id)));
  }

  /**
   * Cambia el status. Al aprobar (→ active) se crean las cajas iniciales si
   * la cuenta no tiene ninguna — sin esto el usuario entra a un dashboard roto.
   */
  async updateStatus(actor: User, id: string, status: UserStatus): Promise<AdminUser> {
    if (actor.id === id) {
      throw new AppException(
        'admin.cannot_change_own_status',
        HttpStatus.BAD_REQUEST,
        'Cannot change your own status',
      );
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user)
      throw new AppException('admin.user_not_found', HttpStatus.NOT_FOUND, 'User not found');

    user.status = status;
    const saved = await this.users.save(user);

    if (status === UserStatus.ACTIVE) {
      // Idioma del usuario aprobado (no del admin que aprueba).
      await this.ensureDefaultBoxes(saved.id, saved.language);
    }
    this.logger.log(`status de ${user.email} → ${status} (por ${actor.email})`);
    const phone = await this.phones.findOne({ where: { userId: id } });
    return this.toAdminUser(saved, phone ?? undefined);
  }

  /** Cambia el rol. Guardas: no a uno mismo, y nunca dejar 0 admins. */
  async updateRole(actor: User, id: string, role: UserRole): Promise<AdminUser> {
    if (actor.id === id) {
      throw new AppException(
        'admin.cannot_change_own_role',
        HttpStatus.BAD_REQUEST,
        'Cannot change your own role',
      );
    }
    const user = await this.users.findOne({ where: { id } });
    if (!user)
      throw new AppException('admin.user_not_found', HttpStatus.NOT_FOUND, 'User not found');

    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const admins = await this.users.count({ where: { role: UserRole.ADMIN } });
      if (admins <= 1) {
        throw new AppException(
          'admin.last_admin',
          HttpStatus.CONFLICT,
          'Last admin — assign another before downgrading',
        );
      }
    }

    user.role = role;
    const saved = await this.users.save(user);
    this.logger.log(`rol de ${user.email} → ${role} (por ${actor.email})`);
    const phone = await this.phones.findOne({ where: { userId: id } });
    return this.toAdminUser(saved, phone ?? undefined);
  }

  /** Reporte de uso/costos de IA por usuario en los últimos N días. */
  async usageReport(days: number): Promise<AdminUsageReport> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const aggregates = await this.aiUsage.aggregateSince(from);

    const userIds = aggregates.map((a) => a.userId);
    const users = userIds.length ? await this.users.find({ where: { id: In(userIds) } }) : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const rows = aggregates.map((a) => {
      const u = byId.get(a.userId);
      return {
        userId: a.userId,
        name: u?.name ?? '(cuenta eliminada)',
        email: u?.email ?? '—',
        avatarUrl: u?.avatarUrl ?? null,
        requests: a.requests,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        costUsd: a.costUsd,
        kinds: a.kinds,
      };
    });

    return {
      days,
      totalCostUsd: rows.reduce((s, r) => s + r.costUsd, 0),
      totalRequests: rows.reduce((s, r) => s + r.requests, 0),
      rows,
    };
  }

  private async ensureDefaultBoxes(userId: string, locale: Locale): Promise<void> {
    const existing = await this.boxes.count({ where: { userId } });
    if (existing > 0) return;
    await this.boxes.save(
      DEFAULT_BOXES.map((b, i) =>
        this.boxes.create({
          userId,
          name: this.i18n.t(locale, b.nameKey),
          pct: b.pct.toFixed(2),
          type: b.type,
          scope: b.scope,
          sortOrder: i,
        }),
      ),
    );
  }

  private toAdminUser(u: User, phone?: PhoneNumber): AdminUser {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      role: u.role,
      status: u.status,
      phoneE164: phone?.e164 ?? null,
      phoneVerified: phone?.verified ?? false,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
